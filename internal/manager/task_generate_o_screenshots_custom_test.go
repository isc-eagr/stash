package manager

import (
	"database/sql"
	"path/filepath"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestOScreenshotEventsQueryIncludesReleaseOCustom(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	sep := string(filepath.Separator)
	if _, err := db.Exec(`
CREATE TABLE folders(id INTEGER PRIMARY KEY, path TEXT);
CREATE TABLE files(id INTEGER PRIMARY KEY, parent_folder_id INTEGER, basename TEXT);
CREATE TABLE scenes(id INTEGER PRIMARY KEY);
CREATE TABLE scenes_files(scene_id INTEGER, file_id INTEGER);
CREATE TABLE scenes_o_dates(scene_id INTEGER, o_date TEXT, video_timestamp REAL);
CREATE TABLE scene_releases(id INTEGER PRIMARY KEY, scene_id INTEGER);
CREATE TABLE scene_release_files(release_id INTEGER, file_id INTEGER);
CREATE TABLE scene_release_o_dates(release_id INTEGER, o_date TEXT, video_timestamp REAL);
INSERT INTO folders VALUES (1, 'C:` + sep + `scenes'), (2, 'C:` + sep + `releases');
INSERT INTO files VALUES (10, 1, 'scene.mp4'), (20, 2, 'release.mp4');
INSERT INTO scenes VALUES (1), (2);
INSERT INTO scenes_files VALUES (1, 10);
INSERT INTO scenes_o_dates VALUES (1, '2026-01-01', 5), (1, '2026-01-02', NULL), (2, '2026-01-03', 7);
INSERT INTO scene_releases VALUES (8, 1);
INSERT INTO scene_release_files VALUES (8, 20);
INSERT INTO scene_release_o_dates VALUES (8, '2026-01-04', 9), (8, '2026-01-05', NULL);`); err != nil {
		t.Fatal(err)
	}

	count := func(sceneIDs []int, paths []string, releaseReady bool) (scene, release int) {
		t.Helper()
		query, args := oScreenshotEventsQueryCustom(sceneIDs, paths, releaseReady)
		rows, err := db.Query(query, args...)
		if err != nil {
			t.Fatal(err)
		}
		defer rows.Close()
		for rows.Next() {
			var rowID, sceneID, releaseID int
			var timestamp float64
			if err := rows.Scan(&rowID, &sceneID, &releaseID, &timestamp); err != nil {
				t.Fatal(err)
			}
			if releaseID != 0 {
				release++
			} else {
				scene++
			}
		}
		return
	}

	if s, r := count(nil, nil, true); s != 2 || r != 1 {
		t.Fatalf("all events: %d scene, %d release", s, r)
	}
	if s, r := count([]int{1}, nil, true); s != 1 || r != 1 {
		t.Fatalf("scene 1 cluster: %d scene, %d release", s, r)
	}
	if s, r := count(nil, []string{"C:" + sep + "releases"}, true); s != 0 || r != 1 {
		t.Fatalf("release path: %d scene, %d release", s, r)
	}
	if s, r := count(nil, nil, false); s != 2 || r != 0 {
		t.Fatalf("without release tables: %d scene, %d release", s, r)
	}
}
