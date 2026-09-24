package sqlite

import (
	"context"
	"os"
	"testing"

	"github.com/jmoiron/sqlx"
	"github.com/stashapp/stash/pkg/models"
)

func TestReleaseRatingUpgradePreservesScoresCustom(t *testing.T) {
	db := openRatingScriptDatabaseCustom(t)
	if _, err := db.Exec(`CREATE TABLE scene_releases(id INTEGER PRIMARY KEY, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
INSERT INTO scenes(id,rating) VALUES (1,87);
INSERT INTO scene_releases(id) VALUES (5);
INSERT INTO rating_criteria_scores
 (id,entity_type,entity_id,key,raw_value,weighted_value,label,created_at,updated_at)
 VALUES (77,'scene',1,'chemistry',4,7.5,'Original label','2020-01-02','2020-03-04');
INSERT INTO rating_bonus_scores(entity_type,entity_id,key,raw_value,weighted_value)
 VALUES ('scene',1,'bonus',2,1.5);
INSERT INTO rating_penalty_scores(entity_type,entity_id,key,raw_value,weighted_value)
 VALUES ('scene',1,'penalty',1,0.5);`); err != nil {
		t.Fatal(err)
	}
	upgrade, err := os.ReadFile("../../scene_releases_rating_v2.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(string(upgrade)); err != nil {
		t.Fatalf("rating upgrade SQL: %v", err)
	}
	for _, table := range []string{ratingCriteriaScoresTable, ratingBonusScoresTable, ratingPenaltyScoresTable} {
		if _, err := db.Exec(`UPDATE ` + table + ` SET entity_type='scene_release',entity_id=5 WHERE entity_type='scene' AND entity_id=1`); err != nil {
			t.Fatalf("%s rejected release ownership: %v", table, err)
		}
		var count int
		if err := db.QueryRow(`SELECT COUNT(*) FROM ` + table + ` WHERE entity_type='scene_release' AND entity_id=5`).Scan(&count); err != nil {
			t.Fatal(err)
		}
		if count != 1 {
			t.Fatalf("%s has %d transferred rows, want 1", table, count)
		}
	}
	var score struct {
		ID        int
		Label     string
		CreatedAt string
		UpdatedAt string
	}
	if err := db.QueryRow(`SELECT id,label,CAST(created_at AS TEXT),CAST(updated_at AS TEXT) FROM rating_criteria_scores WHERE entity_id=5`).Scan(
		&score.ID, &score.Label, &score.CreatedAt, &score.UpdatedAt,
	); err != nil {
		t.Fatal(err)
	}
	if score.ID != 77 || score.Label != "Original label" || score.CreatedAt != "2020-01-02" || score.UpdatedAt != "2020-03-04" {
		t.Fatalf("rating row changed during ownership transfer: %+v", score)
	}
	if _, err := db.Exec(`INSERT INTO rating_criteria_scores(entity_type,entity_id,key) VALUES ('scene_release',999,'invalid')`); err == nil {
		t.Fatal("rating upgrade accepted a missing release owner")
	}
	if _, err := db.Exec(`CREATE TABLE scene_release_metadata(release_id INTEGER PRIMARY KEY, rating INTEGER, organized BOOLEAN DEFAULT 0, resume_time REAL DEFAULT 0, play_duration REAL DEFAULT 0);
CREATE TABLE scene_release_performers(release_id INTEGER, performer_id INTEGER);
CREATE TABLE scene_release_o_dates(release_id INTEGER, o_date DATETIME);
INSERT INTO scene_release_o_dates VALUES (5,CURRENT_TIMESTAMP),(5,CURRENT_TIMESTAMP),(5,CURRENT_TIMESTAMP);`); err != nil {
		t.Fatal(err)
	}
	xdb := sqlx.NewDb(db, "sqlite3")
	tx, err := xdb.BeginTxx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.WithValue(context.Background(), txnKey, tx)
	gotRating, err := NewRatingScoreStore().RecalculateRating(ctx, models.RatingEntityRelease, 5)
	if err != nil {
		t.Fatal(err)
	}
	wantRating := 16 + calculateOrgasmRatingBonus(models.RatingEntityRelease, 3)
	if gotRating != wantRating {
		t.Fatalf("release rating = %d, want %d", gotRating, wantRating)
	}
	var storedRating int
	if err := tx.Get(&storedRating, `SELECT rating FROM scene_release_metadata WHERE release_id=5`); err != nil {
		t.Fatal(err)
	}
	if storedRating != wantRating {
		t.Fatalf("stored release rating = %d, want %d", storedRating, wantRating)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`DELETE FROM scene_releases WHERE id=5`); err != nil {
		t.Fatal(err)
	}
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM rating_criteria_scores WHERE entity_type='scene_release'`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatal("release deletion left orphan rating rows")
	}
}

func TestPerformerOBonusUsesReleaseCastCustom(t *testing.T) {
	db, err := sqlx.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(`CREATE TABLE performers_scenes(performer_id INTEGER, scene_id INTEGER);
CREATE TABLE scenes_o_dates(scene_id INTEGER, o_date DATETIME);
CREATE TABLE scene_release_performers(release_id INTEGER, performer_id INTEGER);
CREATE TABLE scene_release_o_dates(release_id INTEGER, o_date DATETIME);
INSERT INTO performers_scenes VALUES (1,3);
INSERT INTO scenes_o_dates VALUES (3,'2024-01-01');
INSERT INTO scene_release_performers VALUES (4,2);
INSERT INTO scene_release_o_dates VALUES (4,'2024-01-01'),(4,'2024-01-01'),(4,'2024-01-01');`); err != nil {
		t.Fatal(err)
	}
	tx, err := db.BeginTxx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	ctx := context.WithValue(context.Background(), txnKey, tx)
	store := NewRatingScoreStore()
	if bonus, err := store.countOrgasmRatingBonus(ctx, models.RatingEntityPerformer, 1); err != nil || bonus != 0 {
		t.Fatalf("parent performer bonus = %d, err = %v", bonus, err)
	}
	if bonus, err := store.countOrgasmRatingBonus(ctx, models.RatingEntityPerformer, 2); err != nil || bonus != calculateOrgasmRatingBonus(models.RatingEntityPerformer, 3) {
		t.Fatalf("release performer bonus = %d, err = %v", bonus, err)
	}
}
