package sqlite

import (
	"database/sql"
	"fmt"
	"testing"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"

	"github.com/stashapp/stash/internal/manager/config"
	"github.com/stashapp/stash/pkg/models"
)

func TestOralPercentFilterUsesClassifiedActivityTotalCustom(t *testing.T) {
	uiConfig := config.InitializeEmpty()
	previousUIConfig := uiConfig.GetUIConfiguration()
	t.Cleanup(func() { uiConfig.SetUIConfiguration(previousUIConfig) })
	uiConfig.SetUIConfiguration(map[string]interface{}{
		"roleTagIds": map[string]interface{}{
			"sexTagId":  "268",
			"oralTagId": "196",
			"soloTagId": "24",
		},
	})

	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	_, err = db.Exec(`
CREATE TABLE scenes (id INTEGER PRIMARY KEY);
CREATE TABLE scenes_files (scene_id INTEGER, file_id INTEGER);
CREATE TABLE video_files (file_id INTEGER, duration REAL);
CREATE TABLE scene_markers (id INTEGER PRIMARY KEY, scene_id INTEGER, primary_tag_id INTEGER, seconds REAL, end_seconds REAL);
CREATE TABLE scene_markers_tags (scene_marker_id INTEGER, tag_id INTEGER);

INSERT INTO scenes (id) VALUES (5992);
INSERT INTO scenes_files (scene_id, file_id) VALUES (5992, 1);
INSERT INTO video_files (file_id, duration) VALUES (1, 764.11);
INSERT INTO scene_markers (id, scene_id, primary_tag_id, seconds, end_seconds)
  VALUES (17012, 5992, 196, 5.513121, 762.924137);
`)
	require.NoError(t, err)

	percentExpr := activityPercentScenePercentExprCustom(activityPercentOralCustom)
	var percent float64
	err = db.QueryRow("SELECT " + percentExpr + " FROM scenes").Scan(&percent)
	require.NoError(t, err)
	require.InDelta(t, 100, percent, 0.000001)

	whereClause, args := getIntCriterionWhereClause(activityPercentFilterExprCustom(percentExpr), models.IntCriterionInput{
		Modifier: models.CriterionModifierLessThan,
		Value:    100,
	})
	var matchingScenes int
	err = db.QueryRow("SELECT COUNT(*) FROM scenes WHERE "+whereClause, args...).Scan(&matchingScenes)
	require.NoError(t, err)
	require.Zero(t, matchingScenes, "an exact 100% Oral share must not match Oral < 100%")
}

func TestSceneQualityPercentExpressionsCustom(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	_, err = db.Exec(`
CREATE TABLE scenes (id INTEGER PRIMARY KEY);
CREATE TABLE scenes_files (scene_id INTEGER, file_id INTEGER);
CREATE TABLE video_files (file_id INTEGER, duration REAL);
CREATE TABLE scene_markers (id INTEGER PRIMARY KEY, scene_id INTEGER, primary_tag_id INTEGER, seconds REAL, end_seconds REAL);
CREATE TABLE scene_markers_tags (scene_marker_id INTEGER, tag_id INTEGER);
CREATE TABLE scene_negative_markers (scene_id INTEGER, start_seconds REAL, end_seconds REAL);
CREATE TABLE tags_relations (parent_id INTEGER, child_id INTEGER);

INSERT INTO scenes (id) VALUES (1);
INSERT INTO scenes_files (scene_id, file_id) VALUES (1, 1);
INSERT INTO video_files (file_id, duration) VALUES (1, 100);

-- A plain role marker is Standard.
INSERT INTO scene_markers (id, scene_id, primary_tag_id, seconds, end_seconds) VALUES (1, 1, 10, 0, 20);
-- A role marker with a secondary tag is Outstanding.
INSERT INTO scene_markers (id, scene_id, primary_tag_id, seconds, end_seconds) VALUES (2, 1, 10, 20, 50);
INSERT INTO scene_markers_tags (scene_marker_id, tag_id) VALUES (2, 99);
-- A non-role marker is Outstanding across its full range, including overlap.
INSERT INTO scene_markers (id, scene_id, primary_tag_id, seconds, end_seconds) VALUES (3, 1, 99, 40, 70);
-- A plain role marker whose primary tag descends from GOAT is Outstanding.
INSERT INTO scene_markers (id, scene_id, primary_tag_id, seconds, end_seconds) VALUES (4, 1, 20, 70, 80);
INSERT INTO tags_relations (parent_id, child_id) VALUES (500, 20);
-- A standalone non-role marker is Outstanding.
INSERT INTO scene_markers (id, scene_id, primary_tag_id, seconds, end_seconds) VALUES (5, 1, 99, 80, 95);
-- Unusable takes precedence over Outstanding from 45 through 60.
INSERT INTO scene_negative_markers (scene_id, start_seconds, end_seconds) VALUES (1, 45, 60);
-- Overlapping Unusable ranges count their shared time only once.
INSERT INTO scene_negative_markers (scene_id, start_seconds, end_seconds) VALUES (1, 55, 65);
`)
	require.NoError(t, err)

	activitySource := `SELECT sm.scene_id,
MAX(0, sm.seconds) AS seconds,
MIN(100, sm.end_seconds) AS end_seconds
FROM scene_markers sm
WHERE sm.scene_id = scenes.id
AND sm.primary_tag_id IN (10, 20, 30)
AND sm.end_seconds > sm.seconds`
	rawOutstandingSource := activityPercentSceneOutstandingSourceForTagIDsSQLCustom("scenes.id", []int{10, 20, 30}, 500, 700, 701)
	unusableSource := activityPercentSceneNegativeSourceSQLCustom("scenes.id")
	outstandingExpr := activityPercentOutstandingSecondsFromSourcesExprCustom(rawOutstandingSource, unusableSource)
	standardExpr := activityPercentStandardSecondsFromSourcesExprCustom(
		activitySource,
		rawOutstandingSource,
		unusableSource,
	)
	qualityCoveredSource := fmt.Sprintf(
		"%s\nUNION ALL\n%s\nUNION ALL\n%s",
		activitySource,
		rawOutstandingSource,
		unusableSource,
	)
	unclassifiedExpr := activityPercentNonNegativeDifferenceExprCustom(
		activityPercentSceneDurationExprCustom("scenes.id"),
		activityPercentMergedSecondsExprCustom(qualityCoveredSource),
	)
	unusableExpr := activityPercentSceneUnusableSecondsExprCustom("scenes.id")

	row := db.QueryRow("SELECT " + outstandingExpr + ", " + standardExpr + ", " + unclassifiedExpr + ", " + unusableExpr + " FROM scenes WHERE scenes.id = 1")
	var outstanding, standard, unclassified, unusable float64
	require.NoError(t, row.Scan(&outstanding, &standard, &unclassified, &unusable))
	require.InDelta(t, 55, outstanding, 0.001)
	require.InDelta(t, 20, standard, 0.001)
	require.InDelta(t, 5, unclassified, 0.001)
	require.InDelta(t, 20, unusable, 0.001)
	require.InDelta(t, 100, outstanding+standard+unclassified+unusable, 0.001)
}

func TestOutstandingMarkerConditionCustomCountsEveryNonRoleMarker(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	_, err = db.Exec(`
CREATE TABLE scene_markers (id INTEGER PRIMARY KEY, scene_id INTEGER, primary_tag_id INTEGER, seconds REAL, end_seconds REAL);
CREATE TABLE scene_markers_tags (scene_marker_id INTEGER, tag_id INTEGER);
CREATE TABLE tags_relations (parent_id INTEGER, child_id INTEGER);
CREATE TABLE scenes (id INTEGER PRIMARY KEY);
CREATE TABLE scenes_files (scene_id INTEGER, file_id INTEGER);
CREATE TABLE video_files (file_id INTEGER, duration REAL);

INSERT INTO scenes (id) VALUES (1);
INSERT INTO scenes_files (scene_id, file_id) VALUES (1, 1);
INSERT INTO video_files (file_id, duration) VALUES (1, 100);

INSERT INTO scene_markers (id, scene_id, primary_tag_id, seconds, end_seconds) VALUES
  (1, 1, 700, 0, 10),
  (2, 1, 700, 10, 20),
  (3, 1, 99, 20, 30),
  (4, 1, 10, 25, 35);
INSERT INTO scene_markers_tags (scene_marker_id, tag_id) VALUES (2, 701);
`)
	require.NoError(t, err)

	condition := activityPercentOutstandingMarkerConditionForTagIDsCustom(
		"sm", []int{10, 20, 30}, 500, 700, 701,
	)
	rows, err := db.Query("SELECT sm.id FROM scene_markers sm WHERE " + condition + " ORDER BY sm.id")
	require.NoError(t, err)
	defer rows.Close()

	var ids []int
	for rows.Next() {
		var id int
		require.NoError(t, rows.Scan(&id))
		ids = append(ids, id)
	}
	require.NoError(t, rows.Err())
	require.Equal(t, []int{1, 2, 3}, ids)
	require.NoError(t, rows.Close())

	condition = activityPercentOutstandingMarkerConditionForTagIDsCustom(
		"sm", nil, 500, 700, 701,
	)
	rows, err = db.Query("SELECT sm.id FROM scene_markers sm WHERE " + condition + " ORDER BY sm.id")
	require.NoError(t, err)
	defer rows.Close()

	ids = nil
	for rows.Next() {
		var id int
		require.NoError(t, rows.Scan(&id))
		ids = append(ids, id)
	}
	require.NoError(t, rows.Err())
	require.Equal(t, []int{1, 2, 3, 4}, ids)
}
