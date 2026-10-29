package sqlite

import (
	"database/sql"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestStudioAverageStashDBMatchesCustom(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	statements := []string{
		`CREATE TABLE studios (id INTEGER PRIMARY KEY)`,
		`CREATE TABLE scenes (id INTEGER PRIMARY KEY, studio_id INTEGER)`,
		`CREATE TABLE scene_stashdb_matches (scene_id INTEGER PRIMARY KEY, matches INTEGER NOT NULL)`,
		`CREATE TABLE scene_releases (id INTEGER PRIMARY KEY, scene_id INTEGER)`,
		`CREATE TABLE scene_release_stashdb_matches (release_id INTEGER PRIMARY KEY, matches INTEGER NOT NULL)`,
		`INSERT INTO studios(id) VALUES (1), (2), (3)`,
		// Studio 1: 10, 0, and one unscraped scene. Studio 2: 30 plus a
		// release's 20. Studio 3: only unscraped scenes.
		`INSERT INTO scenes(id, studio_id) VALUES (1, 1), (2, 1), (3, 1), (4, 2), (5, 3)`,
		`INSERT INTO scene_stashdb_matches(scene_id, matches) VALUES (1, 10), (2, 0), (4, 30)`,
		`INSERT INTO scene_releases(id, scene_id) VALUES (1, 4)`,
		`INSERT INTO scene_release_stashdb_matches(release_id, matches) VALUES (1, 20)`,
	}
	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			t.Fatalf("execute %q: %v", statement, err)
		}
	}

	expr, ok := StudioSortMetricExpressionCustom(studioAverageStashDBMatchesSortCustom)
	if !ok {
		t.Fatal("average StashDB Matches has no metric expression")
	}
	values := map[int]sql.NullFloat64{}
	rows, err := db.Query(`SELECT studios.id, ` + expr + ` FROM studios`)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var id int
		var value sql.NullFloat64
		if err := rows.Scan(&id, &value); err != nil {
			t.Fatal(err)
		}
		values[id] = value
	}
	rows.Close()

	if got := values[1]; !got.Valid || got.Float64 != 5 {
		t.Errorf("studio 1 average = %v, want 5", got)
	}
	if got := values[2]; !got.Valid || got.Float64 != 50 {
		t.Errorf("studio 2 average = %v, want 50", got)
	}
	if got := values[3]; got.Valid {
		t.Errorf("studio 3 average = %v, want NULL", got)
	}

	qb := &StudioStore{}
	for _, tc := range []struct {
		direction string
		want      []int
	}{
		{"DESC", []int{2, 1, 3}},
		{"ASC", []int{1, 2, 3}},
	} {
		rows, err := db.Query(`SELECT studios.id FROM studios` + qb.sortByAverageStashDBMatchesCustom(tc.direction))
		if err != nil {
			t.Fatal(err)
		}
		var got []int
		for rows.Next() {
			var id int
			if err := rows.Scan(&id); err != nil {
				t.Fatal(err)
			}
			got = append(got, id)
		}
		rows.Close()
		if len(got) != len(tc.want) {
			t.Fatalf("%s order = %v, want %v", tc.direction, got, tc.want)
		}
		for i := range got {
			if got[i] != tc.want[i] {
				t.Fatalf("%s order = %v, want %v", tc.direction, got, tc.want)
			}
		}
	}
}
