package sqlite

import (
	"database/sql"
	"fmt"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func facialCountTestDBCustom(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })

	statements := []string{
		`CREATE TABLE studios (id INTEGER PRIMARY KEY)`,
		`CREATE TABLE performers (id INTEGER PRIMARY KEY)`,
		`CREATE TABLE scenes (id INTEGER PRIMARY KEY, studio_id INTEGER)`,
		`CREATE TABLE scene_markers (id INTEGER PRIMARY KEY, scene_id INTEGER, primary_tag_id INTEGER)`,
		`CREATE TABLE scene_markers_tags (scene_marker_id INTEGER, tag_id INTEGER)`,
		`CREATE TABLE scene_marker_performers (scene_marker_id INTEGER, performer_id INTEGER, role TEXT)`,
		`CREATE TABLE tags_relations (parent_id INTEGER, child_id INTEGER)`,
		`INSERT INTO studios(id) VALUES (1), (2), (3)`,
		`INSERT INTO performers(id) VALUES (1), (2), (3)`,
		`INSERT INTO scenes(id, studio_id) VALUES (1, 1), (2, 1), (3, 2)`,
		// 1: facial with two tops; 2: facial subtag as secondary, no vatos;
		// 3: 2nd-camera facial; 4: unrelated; 5: other studio.
		`INSERT INTO scene_markers(id, scene_id, primary_tag_id) VALUES
      (1, 1, 100), (2, 1, 50), (3, 2, 100), (4, 2, 200), (5, 3, 100)`,
		`INSERT INTO scene_markers_tags(scene_marker_id, tag_id) VALUES (2, 101), (3, 301)`,
		`INSERT INTO scene_marker_performers(scene_marker_id, performer_id, role) VALUES
      (1, 1, 'top'), (1, 2, 'top'), (1, 3, 'bottom'),
      (3, 1, 'top'), (4, 1, 'top'),
      (5, 1, 'top'), (5, 2, 'bottom')`,
		`INSERT INTO tags_relations(parent_id, child_id) VALUES (100, 101), (300, 301)`,
	}
	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			t.Fatalf("execute %q: %v", statement, err)
		}
	}
	return db
}

func facialCountQueryCustom(t *testing.T, db *sql.DB, query string) map[int]int {
	t.Helper()
	rows, err := db.Query(query)
	if err != nil {
		t.Fatalf("%v\nquery: %s", err, query)
	}
	defer rows.Close()

	ret := map[int]int{}
	for rows.Next() {
		var id, value int
		if err := rows.Scan(&id, &value); err != nil {
			t.Fatal(err)
		}
		ret[id] = value
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	return ret
}

func assertFacialCountsCustom(t *testing.T, label string, got map[int]int, want map[int]int) {
	t.Helper()
	for id, value := range want {
		if got[id] != value {
			t.Fatalf("%s %d = %d, want %d (all: %v)", label, id, got[id], value, got)
		}
	}
}

func TestStudioFacialCountWeightsTopsAndSkipsSecondCameraCustom(t *testing.T) {
	db := facialCountTestDBCustom(t)

	got := facialCountQueryCustom(t, db, fmt.Sprintf(`SELECT studios.id, %s FROM studios`,
		studioFacialCountExprForTagsCustom(100, 300)))
	assertFacialCountsCustom(t, "studio", got, map[int]int{1: 3, 2: 1, 3: 0})

	got = facialCountQueryCustom(t, db, fmt.Sprintf(`SELECT studios.id, %s FROM studios`,
		studioFacialCountExprForTagsCustom(100, 0)))
	assertFacialCountsCustom(t, "studio without 2nd camera tag", got, map[int]int{1: 4, 2: 1})

	if expr := studioFacialCountExprForTagsCustom(0, 300); expr != "0" {
		t.Fatalf("expression without a facial tag = %q, want 0", expr)
	}
}

func TestPerformerFacialCountCountsBothRolesCustom(t *testing.T) {
	db := facialCountTestDBCustom(t)

	got := facialCountQueryCustom(t, db, fmt.Sprintf(`SELECT performers.id, %s FROM performers`,
		performerFacialCountExprForTagsCustom(100, 300, "")))
	assertFacialCountsCustom(t, "performer", got, map[int]int{1: 2, 2: 2, 3: 1})

	studioSQL := " AND sm.scene_id IN (SELECT id FROM scenes WHERE studio_id = 1)"
	got = facialCountQueryCustom(t, db, fmt.Sprintf(`SELECT performers.id, %s FROM performers`,
		performerFacialCountExprForTagsCustom(100, 300, studioSQL)))
	assertFacialCountsCustom(t, "studio-scoped performer", got, map[int]int{1: 1, 2: 1, 3: 1})
}

func TestFacialCountSortsRegisteredCustom(t *testing.T) {
	if err := studioSortOptions.validateSort("facial_count"); err != nil {
		t.Fatalf("Studio sort facial_count is not allowed: %v", err)
	}
	if err := performerSortOptions.validateSort("facial_count"); err != nil {
		t.Fatalf("Performer sort facial_count is not allowed: %v", err)
	}
}
