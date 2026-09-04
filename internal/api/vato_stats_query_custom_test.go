package api

import (
	"database/sql"
	"fmt"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

func TestVatoStatsPerformersQueryCustomAggregatesSceneOsAndCareerOnce(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	statements := []string{
		`CREATE TABLE studios (id INTEGER PRIMARY KEY, parent_id INTEGER)`,
		`CREATE TABLE performers (
      id INTEGER PRIMARY KEY,
      name TEXT,
      rating INTEGER,
      ethnicity TEXT,
      country TEXT,
      hair_color TEXT,
      eye_color TEXT,
      height INTEGER,
      penis_length REAL,
      circumcised TEXT,
      image_blob TEXT,
      created_at DATETIME
    )`,
		`CREATE TABLE performers_scenes (performer_id INTEGER, scene_id INTEGER)`,
		`CREATE TABLE scenes (id INTEGER PRIMARY KEY, date TEXT, rating INTEGER, studio_id INTEGER)`,
		`CREATE TABLE scenes_o_dates (scene_id INTEGER, o_date TEXT)`,
		`INSERT INTO performers(id, name, rating, created_at) VALUES
      (1, 'Alpha', 80, datetime('now', '-6 months')),
      (2, 'Bravo', 60, datetime('now', '-2 years'))`,
		`INSERT INTO studios(id, parent_id) VALUES (1, NULL), (2, 1), (3, NULL)`,
		`INSERT INTO scenes(id, date, studio_id) VALUES (10, '2020-01-01', 1), (11, '2021-01-01', 2), (12, '2022-06-15', 3)`,
		`INSERT INTO performers_scenes(performer_id, scene_id) VALUES (1, 10), (1, 11), (2, 12)`,
		`INSERT INTO scenes_o_dates(scene_id, o_date) VALUES
      (10, '2024-01-02 08:00:00'),
      (10, '2024-01-03 09:00:00'),
      (11, '2024-02-04 10:00:00'),
      (11, NULL),
      (10, datetime('now', '-6 months'))`,
	}
	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			t.Fatalf("execute %q: %v", statement, err)
		}
	}

	globalScope, _ := activityStatsSceneScopeCustom(nil, nil)
	rows, err := db.Query(vatoStatsPerformersQueryCustom(globalScope, "rating >= 0", "0", "0", "0"))
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()

	type aggregate struct {
		sceneCount     int
		oCount         int
		mostRecentDate string
		careerSpanDays int
		oCountPastYear int
		isPastYear     bool
	}
	got := map[string]aggregate{}
	for rows.Next() {
		values := make([]interface{}, 18)
		destinations := make([]interface{}, len(values))
		for i := range values {
			destinations[i] = &values[i]
		}
		if err := rows.Scan(destinations...); err != nil {
			t.Fatal(err)
		}
		mostRecentDate := ""
		if values[14] != nil {
			mostRecentDate = customStringValue(values[14])
		}

		got[fmt.Sprint(values[1])] = aggregate{
			sceneCount:     customIntValue(values[12]),
			oCount:         customIntValue(values[13]),
			mostRecentDate: mostRecentDate,
			careerSpanDays: customIntValue(values[15]),
			oCountPastYear: customIntValue(values[16]),
			isPastYear:     customIntValue(values[17]) != 0,
		}
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	if err := rows.Close(); err != nil {
		t.Fatal(err)
	}

	if got["Alpha"] != (aggregate{
		sceneCount:     2,
		oCount:         4,
		mostRecentDate: time.Now().UTC().AddDate(0, -6, 0).Format("2006-01-02"),
		careerSpanDays: 366,
		oCountPastYear: 1,
		isPastYear:     true,
	}) {
		t.Fatalf("Alpha aggregate = %#v", got["Alpha"])
	}
	if got["Bravo"] != (aggregate{sceneCount: 1}) {
		t.Fatalf("Bravo aggregate = %#v", got["Bravo"])
	}

	studioID := 1
	depth := 0
	studioScope, studioArgs := activityStatsSceneScopeCustom(&studioID, &depth)
	studioRows, err := db.Query(
		vatoStatsPerformersQueryCustom(studioScope, "rating >= 0", "0", "0", "0"),
		studioArgs...,
	)
	if err != nil {
		t.Fatal(err)
	}
	defer studioRows.Close()

	studioSceneCounts := map[string]int{}
	for studioRows.Next() {
		values := make([]interface{}, 18)
		destinations := make([]interface{}, len(values))
		for i := range values {
			destinations[i] = &values[i]
		}
		if err := studioRows.Scan(destinations...); err != nil {
			t.Fatal(err)
		}
		studioSceneCounts[fmt.Sprint(values[1])] = customIntValue(values[12])
	}
	if err := studioRows.Err(); err != nil {
		t.Fatal(err)
	}
	if len(studioSceneCounts) != 1 || studioSceneCounts["Alpha"] != 1 {
		t.Fatalf("studio aggregate = %#v, want Alpha with one direct scene", studioSceneCounts)
	}
}

func TestVatoStatsRoleCountsQueryCustomCombinesRoleMarkerScans(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	statements := []string{
		`CREATE TABLE scenes (id INTEGER PRIMARY KEY)`,
		`CREATE TABLE tags_relations (parent_id INTEGER, child_id INTEGER)`,
		`CREATE TABLE scene_markers (id INTEGER PRIMARY KEY, scene_id INTEGER, primary_tag_id INTEGER)`,
		`CREATE TABLE scene_markers_tags (scene_marker_id INTEGER, tag_id INTEGER)`,
		`CREATE TABLE scene_marker_performers (scene_marker_id INTEGER, performer_id INTEGER, role TEXT)`,
		`INSERT INTO scenes(id) VALUES (10), (11)`,
		`INSERT INTO tags_relations(parent_id, child_id) VALUES (100, 101), (200, 201), (300, 301)`,
		`INSERT INTO scene_markers(id, scene_id, primary_tag_id) VALUES
      (1, 10, 101),
      (2, 10, 200),
      (3, 10, 301),
      (4, 11, 999),
      (5, 11, 999)`,
		`INSERT INTO scene_markers_tags(scene_marker_id, tag_id) VALUES
      (3, 300),
      (4, 301),
      (5, 101)`,
		`INSERT INTO scene_marker_performers(scene_marker_id, performer_id, role) VALUES
      (1, 1, 'top'),
      (2, 1, 'bottom'),
      (3, 1, 'top'),
      (4, 1, 'bottom'),
      (5, 1, 'top'),
      (1, 2, 'bottom')`,
	}
	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			t.Fatalf("execute %q: %v", statement, err)
		}
	}

	globalScope, _ := activityStatsSceneScopeCustom(nil, nil)
	query, args := vatoStatsRoleCountsQueryCustom(globalScope, []int{1}, 100, 200, 300)
	rows, err := db.Query(query, args...)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()

	if !rows.Next() {
		t.Fatal("expected one performer role row")
	}
	values := make([]int, 7)
	destinations := make([]interface{}, len(values))
	for i := range values {
		destinations[i] = &values[i]
	}
	if err := rows.Scan(destinations...); err != nil {
		t.Fatal(err)
	}
	want := []int{1, 1, 0, 0, 1, 1, 1}
	for i := range want {
		if values[i] != want[i] {
			t.Fatalf("combined role row = %v, want %v", values, want)
		}
	}
	if rows.Next() {
		t.Fatal("performer ID filter returned an unrelated performer")
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
}
