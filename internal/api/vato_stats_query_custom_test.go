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
		`CREATE TABLE scenes (id INTEGER PRIMARY KEY, date TEXT, rating INTEGER)`,
		`CREATE TABLE scenes_o_dates (scene_id INTEGER, o_date TEXT)`,
		`INSERT INTO performers(id, name, rating, created_at) VALUES
      (1, 'Alpha', 80, datetime('now', '-6 months')),
      (2, 'Bravo', 60, datetime('now', '-2 years'))`,
		`INSERT INTO scenes(id, date) VALUES (10, '2020-01-01'), (11, '2021-01-01'), (12, '2022-06-15')`,
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

	rows, err := db.Query(vatoStatsPerformersQueryCustom("rating >= 0", "0", "0", "0"))
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
}
