package sqlite

import (
	"context"
	"testing"

	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
)

func TestGlobalSceneHistoryIncludesReleaseEventsOnceCustom(t *testing.T) {
	db, err := sqlx.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(`CREATE TABLE scenes_view_dates(scene_id INTEGER, view_date DATETIME);
CREATE TABLE scenes_o_dates(scene_id INTEGER, o_date DATETIME);
CREATE TABLE scene_releases(id INTEGER PRIMARY KEY, scene_id INTEGER);
CREATE TABLE scene_release_view_dates(release_id INTEGER, view_date DATETIME);
CREATE TABLE scene_release_o_dates(release_id INTEGER, o_date DATETIME);
INSERT INTO scenes_view_dates VALUES (1,'2024-01-01');
INSERT INTO scenes_o_dates VALUES (1,'2024-01-01');
INSERT INTO scene_releases VALUES (4,1),(5,2);
INSERT INTO scene_release_view_dates VALUES (4,'2024-01-01'),(4,'2024-01-01'),(5,'2024-02-01');
INSERT INTO scene_release_o_dates VALUES (4,'2024-01-01'),(4,'2024-01-01');`); err != nil {
		t.Fatal(err)
	}
	tx, err := db.BeginTxx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	ctx := context.WithValue(context.Background(), txnKey, tx)
	store := &SceneStore{
		viewDateManager: viewDateManager{scenesViewTableMgr},
		oDateManager:    oDateManager{scenesOTableMgr},
	}
	if count, err := store.CountAllViews(ctx); err != nil || count != 4 {
		t.Fatalf("total plays = %d, err = %v", count, err)
	}
	if count, err := store.CountUniqueViews(ctx); err != nil || count != 2 {
		t.Fatalf("unique played families = %d, err = %v", count, err)
	}
	if count, err := store.GetAllOCount(ctx); err != nil || count != 3 {
		t.Fatalf("total O count = %d, err = %v", count, err)
	}
}

func TestPerformerHistoryUsesReleaseCastCustom(t *testing.T) {
	db, err := sqlx.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(`CREATE TABLE performers(id INTEGER PRIMARY KEY);
CREATE TABLE scenes(id INTEGER PRIMARY KEY);
CREATE TABLE performers_scenes(performer_id INTEGER, scene_id INTEGER);
CREATE TABLE performers_images(performer_id INTEGER, image_id INTEGER);
CREATE TABLE images(id INTEGER PRIMARY KEY, o_counter INTEGER);
CREATE TABLE scenes_view_dates(scene_id INTEGER, view_date DATETIME);
CREATE TABLE scenes_o_dates(scene_id INTEGER, o_date DATETIME);
CREATE TABLE scene_release_performers(release_id INTEGER, performer_id INTEGER);
CREATE TABLE scene_release_view_dates(release_id INTEGER, view_date DATETIME);
CREATE TABLE scene_release_o_dates(release_id INTEGER, o_date DATETIME);
INSERT INTO performers VALUES (1),(2);
INSERT INTO scenes VALUES (3);
INSERT INTO performers_scenes VALUES (1,3);
INSERT INTO scenes_view_dates VALUES (3,'2024-01-01');
INSERT INTO scenes_o_dates VALUES (3,'2024-01-01');
INSERT INTO scene_release_performers VALUES (4,2);
INSERT INTO scene_release_view_dates VALUES (4,'2024-01-01'),(4,'2024-01-01');
INSERT INTO scene_release_o_dates VALUES (4,'2024-01-01'),(4,'2024-01-01');`); err != nil {
		t.Fatal(err)
	}
	for _, check := range []struct {
		name, query string
		performerID, want int
	}{
		{"parent plays", selectPerformerPlayCountSQL, 1, 1},
		{"release plays", selectPerformerPlayCountSQL, 2, 2},
		{"parent O", selectPerformerOCountSQL, 1, 1},
		{"release O", selectPerformerOCountSQL, 2, 2},
	} {
		var got int
		if err := db.Get(&got, `SELECT (`+check.query+`) FROM performers WHERE id=?`, check.performerID); err != nil {
			t.Fatalf("%s query failed: %v", check.name, err)
		}
		if got != check.want {
			t.Fatalf("%s = %d, want %d", check.name, got, check.want)
		}
	}
}
