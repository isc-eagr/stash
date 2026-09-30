package api

import (
	"database/sql"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestSceneOStatsScopeCustomFiltersStudioTree(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	statements := []string{
		`CREATE TABLE studios (id INTEGER PRIMARY KEY, parent_id INTEGER)`,
		`CREATE TABLE scenes (id INTEGER PRIMARY KEY, studio_id INTEGER)`,
		`CREATE TABLE scenes_o_dates (scene_id INTEGER, o_date TEXT)`,
		`INSERT INTO studios(id, parent_id) VALUES (1, NULL), (2, 1), (3, 2), (4, NULL)`,
		`INSERT INTO scenes(id, studio_id) VALUES (10, 1), (20, 2), (30, 3), (40, 4)`,
		`INSERT INTO scenes_o_dates(scene_id, o_date) VALUES (10, '2026-01-01'), (20, '2026-01-02'), (30, '2026-01-03'), (40, '2026-01-04')`,
	}
	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			t.Fatalf("execute %q: %v", statement, err)
		}
	}

	studioID := "1"
	for _, test := range []struct {
		name  string
		depth int
		want  int
	}{
		{name: "direct studio only", depth: 0, want: 1},
		{name: "recursive child studios", depth: -1, want: 3},
	} {
		t.Run(test.name, func(t *testing.T) {
			scope, args, err := sceneOStatsScopeCustom(&studioID, &test.depth, nil)
			if err != nil {
				t.Fatal(err)
			}
			var count int
			query := "SELECT COUNT(*) FROM scenes_o_dates od WHERE 1 = 1" + scope
			if err := db.QueryRow(query, args...).Scan(&count); err != nil {
				t.Fatal(err)
			}
			if count != test.want {
				t.Fatalf("scoped O count = %d, want %d", count, test.want)
			}
		})
	}
}

func TestSceneOStatsScopeCustomRejectsInvalidStudio(t *testing.T) {
	studioID := "nope"
	if _, _, err := sceneOStatsScopeCustom(&studioID, nil, nil); err == nil {
		t.Fatal("expected invalid studio ID to fail")
	}
}

func TestSceneOStatsScopeCustomFiltersLocalODateRange(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	for _, statement := range []string{
		`CREATE TABLE studios (id INTEGER PRIMARY KEY, parent_id INTEGER)`,
		`CREATE TABLE scenes (id INTEGER PRIMARY KEY, studio_id INTEGER)`,
		`CREATE TABLE scenes_o_dates (scene_id INTEGER, o_date TEXT)`,
		`INSERT INTO studios(id, parent_id) VALUES (1, NULL)`,
		`INSERT INTO scenes(id, studio_id) VALUES (10, 1), (20, NULL)`,
		`INSERT INTO scenes_o_dates(scene_id, o_date) VALUES (10, '2025-01-15 12:00:00'), (10, '2025-03-01 12:00:00'), (20, '2025-02-01 12:00:00')`,
	} {
		if _, err := db.Exec(statement); err != nil {
			t.Fatalf("execute %q: %v", statement, err)
		}
	}

	from := "2025-01-01"
	to := "2025-02-28"
	studioID := "1"
	for _, test := range []struct {
		name     string
		studioID *string
		want     int
	}{
		{name: "global range", want: 2},
		{name: "studio and range", studioID: &studioID, want: 1},
	} {
		t.Run(test.name, func(t *testing.T) {
			// The field is ignored: O Stats always filters by O date.
			field := StatsDateFieldRelease
			scope, args, err := sceneOStatsScopeCustom(test.studioID, nil, &StatsDateRangeInput{From: &from, To: &to, Field: &field})
			if err != nil {
				t.Fatal(err)
			}
			var count int
			if err := db.QueryRow("SELECT COUNT(*) FROM scenes_o_dates od WHERE 1 = 1"+scope, args...).Scan(&count); err != nil {
				t.Fatal(err)
			}
			if count != test.want {
				t.Fatalf("ranged O count = %d, want %d", count, test.want)
			}
		})
	}

	bad := "2025-02-30"
	if _, _, err := sceneOStatsScopeCustom(nil, nil, &StatsDateRangeInput{From: &bad}); err == nil {
		t.Fatal("expected an invalid date to fail")
	}
}
