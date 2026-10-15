package sqlite

import (
	"context"
	"os"
	"testing"

	"github.com/jmoiron/sqlx"
	"github.com/stashapp/stash/pkg/models"
)

func TestClearReleaseRatingsCustom(t *testing.T) {
	db := openRatingScriptDatabaseCustom(t)
	if _, err := db.Exec(`CREATE TABLE scene_releases(id INTEGER PRIMARY KEY, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
INSERT INTO scenes(id,rating) VALUES (1,87);
INSERT INTO scene_releases(id) VALUES (5);`); err != nil {
		t.Fatal(err)
	}
	upgrade, err := os.ReadFile("../../scene_releases_rating_v2.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(string(upgrade)); err != nil {
		t.Fatalf("rating upgrade SQL: %v", err)
	}
	if _, err := db.Exec(`CREATE TABLE scene_release_metadata(release_id INTEGER PRIMARY KEY, rating INTEGER);
INSERT INTO scene_release_metadata VALUES (5, 60);
INSERT INTO rating_criteria_scores(entity_type,entity_id,key,raw_value,weighted_value) VALUES ('scene',1,'chemistry',4,7.5), ('scene_release',5,'chemistry',3,6);
INSERT INTO rating_bonus_scores(entity_type,entity_id,key,raw_value,weighted_value) VALUES ('scene_release',5,'bonus',2,1.5);`); err != nil {
		t.Fatal(err)
	}
	store := &Database{writeDB: sqlx.NewDb(db, "sqlite3")}
	for i := 0; i < 2; i++ { // reruns are a no-op
		if err := store.clearReleaseRatingsCustom(context.Background()); err != nil {
			t.Fatal(err)
		}
	}
	checks := map[string]int{
		`SELECT COUNT(*) FROM rating_criteria_scores WHERE entity_type = 'scene_release'`: 0,
		`SELECT COUNT(*) FROM rating_bonus_scores WHERE entity_type = 'scene_release'`:    0,
		`SELECT COUNT(*) FROM rating_criteria_scores WHERE entity_type = 'scene'`:         1,
		`SELECT COUNT(*) FROM scene_release_metadata WHERE rating IS NOT NULL`:            0,
		`SELECT rating FROM scenes WHERE id = 1`:                                          87,
	}
	for query, want := range checks {
		var got int
		if err := db.QueryRow(query).Scan(&got); err != nil {
			t.Fatal(err)
		}
		if got != want {
			t.Fatalf("%s: got %d, want %d", query, got, want)
		}
	}
	if _, err := normalizeRatingEntityType("scene_release"); err == nil {
		t.Fatal("releases must not take rating scores")
	}
}

func TestSceneOBonusCountsReleaseOCustom(t *testing.T) {
	db, err := sqlx.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(`CREATE TABLE scenes_o_dates(scene_id INTEGER, o_date DATETIME);
CREATE TABLE scene_releases(id INTEGER PRIMARY KEY, scene_id INTEGER);
CREATE TABLE scene_release_o_dates(release_id INTEGER, o_date DATETIME);
INSERT INTO scenes_o_dates VALUES (3,'2024-01-01'), (8,'2024-01-01');
INSERT INTO scene_releases VALUES (4,3), (5,3), (6,8);
INSERT INTO scene_release_o_dates VALUES (4,'2024-01-02'), (5,NULL), (6,'2024-01-03');`); err != nil {
		t.Fatal(err)
	}
	tx, err := db.BeginTxx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	ctx := context.WithValue(context.Background(), txnKey, tx)
	bonus, err := NewRatingScoreStore().countOrgasmRatingBonus(ctx, models.RatingEntityScene, 3)
	if err != nil {
		t.Fatal(err)
	}
	if want := calculateOrgasmRatingBonus(models.RatingEntityScene, 3); bonus != want || want == 0 {
		t.Fatalf("scene bonus = %d, want %d", bonus, want)
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
