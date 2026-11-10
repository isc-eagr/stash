package api

import (
	"database/sql"
	"fmt"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestVatoStatsRolePairsQueryCustom(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	for _, statement := range []string{
		`CREATE TABLE studios (id INTEGER PRIMARY KEY, parent_id INTEGER)`,
		`CREATE TABLE scenes (id INTEGER PRIMARY KEY, studio_id INTEGER, organized INTEGER)`,
		`CREATE TABLE tags (id INTEGER PRIMARY KEY)`,
		`CREATE TABLE tags_relations (parent_id INTEGER, child_id INTEGER)`,
		`CREATE TABLE scene_markers (id INTEGER PRIMARY KEY, scene_id INTEGER, primary_tag_id INTEGER)`,
		`CREATE TABLE scene_marker_performers (scene_marker_id INTEGER, performer_id INTEGER, role TEXT)`,
		`INSERT INTO studios(id) VALUES (1), (2)`,
		// Scene 3 is not organized but still counts; scene 4 belongs to another studio.
		`INSERT INTO scenes(id, studio_id, organized) VALUES (1, 1, 1), (2, 1, 1), (3, 1, 0), (4, 2, 1)`,
		// 10 sex, 11 its subtag, 20 oral, 30 unrelated; 10 and 11 also form a cycle.
		`INSERT INTO tags(id) VALUES (10), (11), (20), (30)`,
		`INSERT INTO tags_relations(parent_id, child_id) VALUES (10, 11), (11, 10)`,
		`INSERT INTO scene_markers(id, scene_id, primary_tag_id) VALUES
      (100, 1, 10), (101, 1, 11), (102, 1, 20), (103, 1, 30),
      (104, 2, 10), (105, 3, 10), (106, 4, 20), (107, NULL, 10)`,
		`INSERT INTO scene_marker_performers(scene_marker_id, performer_id, role) VALUES
      (100, 1, 'top'), (100, 2, 'bottom'),
      (101, 1, 'top'), (101, 2, 'bottom'), (101, 3, 'bottom'),
      (102, 2, 'top'), (102, 1, 'bottom'),
      (103, 1, 'top'), (103, 2, 'bottom'),
      (104, 1, 'top'), (104, 1, 'bottom'), (104, 2, 'top'),
      (105, 1, 'top'), (105, 2, 'bottom'),
      (106, 3, 'top'), (106, 1, 'bottom'),
      (107, 1, 'top'), (107, 2, 'bottom')`,
	} {
		if _, err := db.Exec(statement); err != nil {
			t.Fatalf("execute %q: %v", statement, err)
		}
	}

	pairs := func(t *testing.T, studioID *int, sexTagID, oralTagID int) []string {
		t.Helper()
		scope, scopeArgs := activityStatsSceneScopeCustom(studioID, nil, nil)
		query, tagArgs := vatoStatsRolePairsQueryCustom(scope, sexTagID, oralTagID)
		if query == "" {
			return nil
		}
		rows, err := db.Query(query, append(scopeArgs, tagArgs...)...)
		if err != nil {
			t.Fatal(err)
		}
		defer rows.Close()

		var got []string
		for rows.Next() {
			var category string
			var sceneID, topID, bottomID int
			if err := rows.Scan(&category, &sceneID, &topID, &bottomID); err != nil {
				t.Fatal(err)
			}
			got = append(got, fmt.Sprintf("%s:%d:%d>%d", category, sceneID, topID, bottomID))
		}
		if err := rows.Err(); err != nil {
			t.Fatal(err)
		}
		return got
	}
	assertPairs := func(t *testing.T, got []string, want ...string) {
		t.Helper()
		if fmt.Sprint(got) != fmt.Sprint(want) {
			t.Fatalf("pairs = %v, want %v", got, want)
		}
	}

	// A pair repeated across markers and subtags counts once per scene; a vato
	// paired with himself and release markers are left out.
	assertPairs(t, pairs(t, nil, 10, 20),
		"oral:1:2>1", "oral:4:3>1",
		"sex:1:1>2", "sex:1:1>3", "sex:2:2>1", "sex:3:1>2",
	)

	studioID := 1
	assertPairs(t, pairs(t, &studioID, 10, 20),
		"oral:1:2>1", "sex:1:1>2", "sex:1:1>3", "sex:2:2>1", "sex:3:1>2",
	)
	assertPairs(t, pairs(t, nil, 0, 20), "oral:1:2>1", "oral:4:3>1")
	assertPairs(t, pairs(t, nil, 0, 0))
}
