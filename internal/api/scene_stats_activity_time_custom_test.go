package api

import (
	"database/sql"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestSceneStatsActivityTimeQueryCustom(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	statements := []string{
		`CREATE TABLE scenes (id INTEGER PRIMARY KEY)`,
		`CREATE TABLE scenes_files (scene_id INTEGER, file_id INTEGER)`,
		`CREATE TABLE video_files (file_id INTEGER, duration FLOAT)`,
		`CREATE TABLE scene_markers (id INTEGER PRIMARY KEY, scene_id INTEGER, primary_tag_id INTEGER, seconds FLOAT, end_seconds FLOAT)`,
		`CREATE TABLE scene_marker_performers (scene_marker_id INTEGER, performer_id INTEGER, role TEXT)`,
		`INSERT INTO scenes(id) VALUES (1), (2), (3)`,
		`INSERT INTO scenes_files(scene_id, file_id) VALUES (1, 101), (2, 102)`,
		`INSERT INTO video_files(file_id, duration) VALUES (101, 100), (102, 100)`,
		`INSERT INTO scene_markers(id, scene_id, primary_tag_id, seconds, end_seconds) VALUES
      (1, 1, 11, 10, 40),
      (2, 1, 11, 20, 50),
      (3, 1, 11, 60, NULL),
      (4, 1, 11, 90, 80),
      (5, 1, 22, 5, 25),
      (6, 1, 11, 90, 120),
      (7, 2, 11, 0, 10),
      (8, 3, 11, 0, 20)`,
		`INSERT INTO scene_marker_performers(scene_marker_id, performer_id, role) VALUES
      (1, 101, 'top'),
      (1, 102, 'bottom'),
      (1, 103, 'bottom')`,
	}
	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			t.Fatalf("execute %q: %v", statement, err)
		}
	}

	for _, test := range []struct {
		name  string
		tagID int
		want  float64
	}{
		{name: "sex merges overlaps, clips ranges, and keeps scenes separate", tagID: 11, want: 60},
		{name: "oral uses only oral markers", tagID: 22, want: 20},
		{name: "unconfigured tag has zero time", tagID: 99, want: 0},
	} {
		t.Run(test.name, func(t *testing.T) {
			query := sceneStatsActivityTimeQueryCustom(`WITH selected_scenes(id) AS (SELECT id FROM scenes)`)
			queryRows, err := db.Query(query, test.tagID)
			if err != nil {
				t.Fatal(err)
			}
			defer queryRows.Close()

			var rows [][]interface{}
			for queryRows.Next() {
				var sceneID int
				var start, end, duration float64
				if err := queryRows.Scan(&sceneID, &start, &end, &duration); err != nil {
					t.Fatal(err)
				}
				rows = append(rows, []interface{}{sceneID, start, end, duration})
			}
			if err := queryRows.Err(); err != nil {
				t.Fatal(err)
			}

			got := sceneStatsActivityTimeFromRowsCustom(rows)
			if got != test.want {
				t.Fatalf("activity time = %v, want %v", got, test.want)
			}
		})
	}
}
