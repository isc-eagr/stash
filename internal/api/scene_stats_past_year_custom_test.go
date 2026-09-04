package api

import (
	"database/sql"
	"fmt"
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
CREATE TABLE rating_bonus_scores (entity_type TEXT, entity_id INTEGER, key TEXT, raw_value REAL);
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
INSERT INTO rating_bonus_scores(entity_type, entity_id, key, raw_value) VALUES
  ('scene', 1, 'goatElement', 0.5),
  ('scene', 2, 'godTierOrgasm', 0);
INSERT INTO performers(id, created_at) VALUES
  (10, datetime('now', '-3 months')),
  (20, datetime('now', '-2 years'));
INSERT INTO performers_scenes(performer_id, scene_id) VALUES (10, 1), (20, 1);
`)
	require.NoError(t, err)

	sceneScope, _ := activityStatsSceneScopeCustom(nil, nil)
	baseQuery := sceneStatsBaseScopedQueryCustom(sceneOStatsEffectiveDateExpr("s"), sceneScope)
	require.Contains(t, baseQuery, "WHERE sf.scene_id IN (SELECT id FROM selected_scenes)")
	require.Contains(t, baseQuery, "WHERE scene_id IN (SELECT id FROM selected_scenes)")
	require.Contains(t, baseQuery, "royal_sapphire_bonus_scenes AS")
	rows, err := db.Query(baseQuery)
	require.NoError(t, err)
	defer rows.Close()

	type result struct {
		oCount            int
		oCountPastYear    int
		isPastYear        bool
		isReleasePastYear bool
		hasSapphireBonus  bool
	}
	results := map[int]result{}
	for rows.Next() {
		values := make([]interface{}, 15)
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
			hasSapphireBonus:  customIntValue(values[14]) != 0,
		}
	}
	require.NoError(t, rows.Err())

	require.Equal(t, result{
		oCount:            2,
		oCountPastYear:    1,
		isPastYear:        true,
		isReleasePastYear: true,
		hasSapphireBonus:  true,
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

func TestSceneStatsScopedMarkerQueryCustomOnlyReturnsDashboardTags(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	_, err = db.Exec(`
CREATE TABLE scenes (id INTEGER PRIMARY KEY);
CREATE TABLE scene_markers (id INTEGER PRIMARY KEY, scene_id INTEGER, primary_tag_id INTEGER);
CREATE TABLE scene_markers_tags (scene_marker_id INTEGER, tag_id INTEGER);
CREATE TABLE tags_relations (parent_id INTEGER, child_id INTEGER);
INSERT INTO scenes(id) VALUES (1);
INSERT INTO tags_relations(parent_id, child_id) VALUES (100, 101), (101, 102);
INSERT INTO scene_markers(id, scene_id, primary_tag_id) VALUES
  (1, 1, 100),
  (2, 1, 200),
  (3, 1, 200),
  (4, 1, 101),
  (5, 1, 102);
INSERT INTO scene_markers_tags(scene_marker_id, tag_id) VALUES
  (1, 200),
  (2, 101),
  (3, 200),
  (4, 100),
  (4, 200),
  (5, 200);
`)
	require.NoError(t, err)

	sceneScope, _ := activityStatsSceneScopeCustom(nil, nil)
	query, args := sceneStatsScopedMarkerQueryCustom(sceneScope, []int{100, 100, 0})
	require.Equal(t, []interface{}{100}, args)
	rows, err := db.Query(query, args...)
	require.NoError(t, err)
	defer rows.Close()

	var got []string
	for rows.Next() {
		var sceneID, markerID int
		var primaryTagID, secondaryTagID sql.NullInt64
		require.NoError(t, rows.Scan(&sceneID, &markerID, &primaryTagID, &secondaryTagID))
		got = append(got, fmt.Sprintf(
			"%d:%d:%d:%d",
			sceneID,
			markerID,
			primaryTagID.Int64,
			secondaryTagID.Int64,
		))
	}
	require.NoError(t, rows.Err())
	require.Equal(t, []string{
		"1:1:100:0",
		"1:2:0:101",
		"1:4:101:100",
	}, got)
}
