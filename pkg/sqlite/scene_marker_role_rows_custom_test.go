package sqlite

import (
	"context"
	"testing"

	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
	"github.com/stashapp/stash/pkg/models"
)

// Release-owned markers have a NULL scene_id; performer role stats used to
// fail scanning them after a scene was converted into a release.
func TestPerformerRoleRowsSkipReleaseMarkersCustom(t *testing.T) {
	db, err := sqlx.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(`
CREATE TABLE scene_markers(id INTEGER PRIMARY KEY, primary_tag_id INTEGER NOT NULL, scene_id INTEGER, release_id INTEGER, seconds REAL NOT NULL, end_seconds REAL);
CREATE TABLE scene_markers_tags(scene_marker_id INTEGER, tag_id INTEGER);
CREATE TABLE scene_marker_performers(scene_marker_id INTEGER, performer_id INTEGER, role TEXT);
INSERT INTO scene_markers VALUES (1, 21, 5, NULL, 0, 30), (2, 21, NULL, 9, 0, 30);
INSERT INTO scene_marker_performers VALUES (1, 11, 'top'), (1, 12, 'bottom'), (2, 11, 'top'), (2, 13, 'bottom');`); err != nil {
		t.Fatal(err)
	}
	tx, err := db.BeginTxx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	ctx := context.WithValue(context.Background(), txnKey, tx)
	store := &SceneMarkerStore{}

	for _, tagIDs := range [][]int{nil, {21}} {
		rows, err := store.FindPerformerMarkerRoleRows(ctx, []int{11}, tagIDs, "")
		if err != nil {
			t.Fatalf("role rows with tags %v: %v", tagIDs, err)
		}
		if len(rows) != 1 || rows[0].SceneMarkerID != 1 || rows[0].SceneID != 5 {
			t.Fatalf("role rows with tags %v = %+v; want only scene marker 1", tagIDs, rows)
		}

		partners, err := store.FindPerformerPartnerRoleRows(ctx, []int{11}, tagIDs)
		if err != nil {
			t.Fatalf("partner rows with tags %v: %v", tagIDs, err)
		}
		if len(partners) != 1 || partners[0].PartnerID != 12 {
			t.Fatalf("partner rows with tags %v = %+v; want only partner 12", tagIDs, partners)
		}
	}
}

// A tracker event for a converted marker links to the parent scene with the
// release selected instead of failing to scan its NULL scene_id.
func TestTaskProgressReleaseMarkerURLCustom(t *testing.T) {
	db, err := sqlx.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(`
CREATE TABLE scene_releases(id INTEGER PRIMARY KEY, scene_id INTEGER NOT NULL);
CREATE TABLE scene_markers(id INTEGER PRIMARY KEY, scene_id INTEGER, release_id INTEGER, seconds REAL NOT NULL);
INSERT INTO scene_releases VALUES (9, 5);
INSERT INTO scene_markers VALUES (1, 5, NULL, 12.5), (2, NULL, 9, 30);`); err != nil {
		t.Fatal(err)
	}
	tx, err := db.BeginTxx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	ctx := context.WithValue(context.Background(), txnKey, tx)

	for id, want := range map[int]string{1: "/scenes/5?t=12.5", 2: "/scenes/5?t=30&release=9"} {
		got, err := taskProgressEventURLCustom(ctx, &models.TaskProgressEvent{ItemType: "scene_marker", ItemID: id})
		if err != nil || got != want {
			t.Fatalf("marker %d URL = %q, %v; want %q", id, got, err, want)
		}
	}
}
