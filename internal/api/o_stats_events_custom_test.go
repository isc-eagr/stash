package api

import (
	"database/sql"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestSceneOEventOrdinalsQueryRanksEventsChronologicallyPerScene(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	statements := []string{
		`CREATE TABLE scenes_o_dates (scene_id INTEGER, o_date TEXT, video_timestamp REAL)`,
		`INSERT INTO scenes_o_dates(scene_id, o_date, video_timestamp) VALUES
      (1, '2024-03-10 09:00:00', 30),
      (1, '2024-03-09 09:00:00', 90),
      (1, '2024-03-09 09:00:00', 15),
      (2, NULL, 5),
      (2, '2024-04-01 12:00:00', 20),
      (3, '2024-01-01 00:00:00', 1)`,
	}
	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			t.Fatalf("execute %q: %v", statement, err)
		}
	}

	rows, err := db.Query(sceneOEventOrdinalsQuery("?, ?"), 1, 2)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()

	got := map[int]map[int64]int{}
	for rows.Next() {
		var sceneID int
		var eventID int64
		var ordinal int
		if err := rows.Scan(&sceneID, &eventID, &ordinal); err != nil {
			t.Fatal(err)
		}
		if got[sceneID] == nil {
			got[sceneID] = map[int64]int{}
		}
		got[sceneID][eventID] = ordinal
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}

	want := map[int]map[int64]int{
		1: {3: 1, 2: 2, 1: 3},
		2: {5: 1},
	}
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for sceneID, ordinals := range want {
		for eventID, ordinal := range ordinals {
			if got[sceneID][eventID] != ordinal {
				t.Fatalf("scene %d event %d ordinal = %d, want %d", sceneID, eventID, got[sceneID][eventID], ordinal)
			}
		}
	}
}

func TestSceneOStatsSceneID(t *testing.T) {
	got, err := sceneOStatsSceneID("42")
	if err != nil {
		t.Fatalf("sceneOStatsSceneID returned error: %v", err)
	}
	if got != 42 {
		t.Fatalf("sceneOStatsSceneID = %d, want 42", got)
	}

	for _, value := range []string{"", "0", "-1", "scene"} {
		if _, err := sceneOStatsSceneID(value); err == nil {
			t.Fatalf("sceneOStatsSceneID(%q) returned nil error", value)
		}
	}
}
