package api

import (
	"database/sql"
	"testing"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"
)

func TestSceneStatsBaseQueryCustomPastYearMetrics(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	_, err = db.Exec(`
CREATE TABLE scenes (
  id INTEGER PRIMARY KEY,
  title TEXT,
  date TEXT,
  rating INTEGER,
  created_at DATETIME
);
CREATE TABLE scenes_files (scene_id INTEGER, file_id INTEGER, "primary" BOOLEAN);
CREATE TABLE files (id INTEGER PRIMARY KEY, size INTEGER);
CREATE TABLE video_files (file_id INTEGER, duration REAL, width INTEGER, height INTEGER);
CREATE TABLE scene_releases (scene_id INTEGER, date DATETIME);
CREATE TABLE scenes_o_dates (scene_id INTEGER, o_date DATETIME);
CREATE TABLE performers (id INTEGER PRIMARY KEY, ethnicity TEXT, country TEXT, created_at DATETIME);
CREATE TABLE performers_scenes (performer_id INTEGER, scene_id INTEGER);
INSERT INTO scenes(id, title, date, rating, created_at) VALUES
  (1, 'Recent release', NULL, 90, datetime('now', '-6 months')),
  (2, 'Old effective release', datetime('now', '-2 years'), 70, datetime('now', '-2 years'));
INSERT INTO scene_releases(scene_id, date) VALUES
  (1, datetime('now', '-6 months')),
  (2, datetime('now', '-3 months'));
INSERT INTO scenes_o_dates(scene_id, o_date) VALUES
  (1, datetime('now', '-3 months')),
  (1, datetime('now', '-2 years')),
  (2, datetime('now', '-2 years'));
INSERT INTO performers(id, created_at) VALUES
  (10, datetime('now', '-3 months')),
  (20, datetime('now', '-2 years'));
INSERT INTO performers_scenes(performer_id, scene_id) VALUES (10, 1), (20, 1);
`)
	require.NoError(t, err)

	sceneScope, _ := activityStatsSceneScopeCustom(nil, nil)
	rows, err := db.Query(sceneStatsBaseScopedQueryCustom(sceneOStatsEffectiveDateExpr("s"), sceneScope))
	require.NoError(t, err)
	defer rows.Close()

	type result struct {
		oCount            int
		oCountPastYear    int
		isPastYear        bool
		isReleasePastYear bool
	}
	results := map[int]result{}
	for rows.Next() {
		values := make([]interface{}, 14)
		destinations := make([]interface{}, len(values))
		for i := range values {
			destinations[i] = &values[i]
		}
		require.NoError(t, rows.Scan(destinations...))
		results[customIntValue(values[0])] = result{
			oCount:            customIntValue(values[5]),
			oCountPastYear:    customIntValue(values[11]),
			isPastYear:        customIntValue(values[12]) != 0,
			isReleasePastYear: customIntValue(values[13]) != 0,
		}
	}
	require.NoError(t, rows.Err())

	require.Equal(t, result{
		oCount:            2,
		oCountPastYear:    1,
		isPastYear:        true,
		isReleasePastYear: true,
	}, results[1])
	require.Equal(t, result{oCount: 1}, results[2])

	recentRelease := &SceneStatsScene{IsReleasePastYear: true}
	sceneStatsAddPerformerCustom(recentRelease, "A", "MX")
	sceneStatsAddPerformerCustom(recentRelease, "B", "US")
	require.Equal(t, 2, recentRelease.PerformerCount)
	require.Equal(t, 2, recentRelease.PerformerCountPastYear)

	oldRelease := &SceneStatsScene{}
	sceneStatsAddPerformerCustom(oldRelease, "A", "MX")
	require.Equal(t, 1, oldRelease.PerformerCount)
	require.Zero(t, oldRelease.PerformerCountPastYear)
}
