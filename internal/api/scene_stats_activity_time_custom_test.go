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
		`CREATE TABLE scene_markers (id INTEGER PRIMARY KEY, primary_tag_id INTEGER, seconds FLOAT, end_seconds FLOAT)`,
		`CREATE TABLE scene_marker_performers (scene_marker_id INTEGER, performer_id INTEGER, role TEXT)`,
		`INSERT INTO scene_markers(id, primary_tag_id, seconds, end_seconds) VALUES
      (1, 11, 10, 40),
      (2, 11, 20, 50),
      (3, 11, 60, NULL),
      (4, 11, 90, 80),
      (5, 22, 5, 25)`,
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
		{name: "sex sums each completed marker once", tagID: 11, want: 60},
		{name: "oral uses only oral markers", tagID: 22, want: 20},
		{name: "unconfigured tag has zero time", tagID: 99, want: 0},
	} {
		t.Run(test.name, func(t *testing.T) {
			var got float64
			if err := db.QueryRow(sceneStatsActivityTimeQueryCustom, test.tagID).Scan(&got); err != nil {
				t.Fatal(err)
			}
			if got != test.want {
				t.Fatalf("activity time = %v, want %v", got, test.want)
			}
		})
	}
}
