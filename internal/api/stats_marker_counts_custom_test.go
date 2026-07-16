package api

import (
	"database/sql"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestStatsWeightedMarkerCountQueryCustomCountsTopsPerMarker(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	statements := []string{
		`CREATE TABLE tags (id INTEGER PRIMARY KEY)`,
		`CREATE TABLE tags_relations (parent_id INTEGER, child_id INTEGER)`,
		`CREATE TABLE scene_markers (id INTEGER PRIMARY KEY, primary_tag_id INTEGER)`,
		`CREATE TABLE scene_markers_tags (scene_marker_id INTEGER, tag_id INTEGER)`,
		`CREATE TABLE scene_marker_performers (scene_marker_id INTEGER, performer_id INTEGER, role TEXT)`,
		`INSERT INTO tags(id) VALUES (1), (2), (3), (9), (10)`,
		`INSERT INTO tags_relations(parent_id, child_id) VALUES (1, 2), (9, 10)`,
		`INSERT INTO scene_markers(id, primary_tag_id) VALUES (1, 2), (2, 3), (3, 1), (4, 9), (5, 1)`,
		`INSERT INTO scene_markers_tags(scene_marker_id, tag_id) VALUES (2, 1), (3, 10), (4, 1)`,
		`INSERT INTO scene_marker_performers(scene_marker_id, performer_id, role) VALUES (1, 101, 'top'), (1, 102, 'top')`,
	}
	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			t.Fatalf("execute %q: %v", statement, err)
		}
	}

	var count int
	if err := db.QueryRow(statsWeightedMarkerCountQueryCustom, 1, 9).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 4 {
		t.Fatalf("weighted marker count = %d, want 4", count)
	}
}

func TestPerformerRoleTagCountQueryCustomMatchesSubtagsAndSecondaryTags(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	statements := []string{
		`CREATE TABLE tags (id INTEGER PRIMARY KEY)`,
		`CREATE TABLE tags_relations (parent_id INTEGER, child_id INTEGER)`,
		`CREATE TABLE scene_markers (id INTEGER PRIMARY KEY, primary_tag_id INTEGER)`,
		`CREATE TABLE scene_markers_tags (scene_marker_id INTEGER, tag_id INTEGER)`,
		`CREATE TABLE scene_marker_performers (scene_marker_id INTEGER, performer_id INTEGER, role TEXT)`,
		`INSERT INTO tags(id) VALUES (1), (2), (3)`,
		`INSERT INTO tags_relations(parent_id, child_id) VALUES (1, 2)`,
		`INSERT INTO scene_markers(id, primary_tag_id) VALUES (1, 2), (2, 3)`,
		`INSERT INTO scene_markers_tags(scene_marker_id, tag_id) VALUES (2, 1)`,
		`INSERT INTO scene_marker_performers(scene_marker_id, performer_id, role) VALUES (1, 101, 'top'), (1, 102, 'top'), (2, 103, 'bottom')`,
	}
	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			t.Fatalf("execute %q: %v", statement, err)
		}
	}

	for _, test := range []struct {
		role string
		want int
	}{
		{role: "top", want: 2},
		{role: "bottom", want: 1},
	} {
		var count int
		if err := db.QueryRow(performerRoleTagCountQueryCustom, 1, test.role).Scan(&count); err != nil {
			t.Fatal(err)
		}
		if count != test.want {
			t.Fatalf("%s performer count = %d, want %d", test.role, count, test.want)
		}
	}
}
