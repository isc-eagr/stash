package sqlite

import (
	"database/sql"
	"testing"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"
)

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
-- A non-role marker is Outstanding and overlaps the prior marker.
INSERT INTO scene_markers (id, scene_id, primary_tag_id, seconds, end_seconds) VALUES (3, 1, 99, 40, 70);
-- A plain role marker whose primary tag descends from GOAT is Outstanding.
INSERT INTO scene_markers (id, scene_id, primary_tag_id, seconds, end_seconds) VALUES (4, 1, 20, 70, 80);
INSERT INTO tags_relations (parent_id, child_id) VALUES (500, 20);
-- Unusable takes precedence over Outstanding from 45 through 60.
INSERT INTO scene_negative_markers (scene_id, start_seconds, end_seconds) VALUES (1, 45, 60);
`)
	require.NoError(t, err)

	outstandingSource := activityPercentSceneOutstandingSourceForTagIDsSQLCustom("scenes.id", []int{10, 20, 30}, 500)
	unusableSource := activityPercentSceneNegativeSourceSQLCustom("scenes.id")
	outstandingExpr := activityPercentOutstandingSecondsFromSourcesExprCustom(outstandingSource, unusableSource)
	standardExpr := activityPercentStandardSecondsFromSourcesExprCustom(
		activityPercentSceneDurationExprCustom("scenes.id"),
		outstandingSource,
		unusableSource,
	)
	unusableExpr := activityPercentSceneUnusableSecondsExprCustom("scenes.id")

	row := db.QueryRow("SELECT " + outstandingExpr + ", " + standardExpr + ", " + unusableExpr + " FROM scenes WHERE scenes.id = 1")
	var outstanding, standard, unusable float64
	require.NoError(t, row.Scan(&outstanding, &standard, &unusable))
	require.InDelta(t, 45, outstanding, 0.001)
	require.InDelta(t, 40, standard, 0.001)
	require.InDelta(t, 15, unusable, 0.001)
	require.InDelta(t, 100, outstanding+standard+unusable, 0.001)
}
