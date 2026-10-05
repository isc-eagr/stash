package api

import (
	"database/sql"
	"fmt"
	"math"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestStudioListRoleStatsQueryCustom(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	defer db.Close()
	_, err = db.Exec(`
CREATE TABLE scenes(id INTEGER PRIMARY KEY, studio_id INTEGER);
CREATE TABLE scene_markers(id INTEGER PRIMARY KEY, scene_id INTEGER, primary_tag_id INTEGER);
CREATE TABLE scene_markers_tags(scene_marker_id INTEGER, tag_id INTEGER);
CREATE TABLE tags_relations(parent_id INTEGER, child_id INTEGER);
INSERT INTO scenes VALUES(1, 10), (2, 10), (3, 10), (4, 20), (5, 30);
INSERT INTO tags_relations VALUES(1, 11), (11, 12);
INSERT INTO scene_markers VALUES(1, 1, 12), (2, 2, 2), (3, 3, 3), (4, 4, 4), (5, 5, 1);
INSERT INTO scene_markers_tags VALUES(1, 2), (1, 4), (1, 12), (2, 3);`)
	require.NoError(t, err)
	rows, err := db.Query(fmt.Sprintf(studioListRoleStatsQueryCustom, "(?),(?),(?)"), 10, 20, 99, 1, 2, 3, 4)
	require.NoError(t, err)
	defer rows.Close()
	got := map[int][4]int{}
	for rows.Next() {
		var id int
		var counts [4]int
		require.NoError(t, rows.Scan(&id, &counts[0], &counts[1], &counts[2], &counts[3]))
		got[id] = counts
	}
	require.NoError(t, rows.Err())
	// Precedence remains sex > oral > solo; facial is independent. Descendants
	// and primary/secondary duplicates count once, with no out-of-scope leakage.
	require.Equal(t, map[int][4]int{10: {1, 1, 1, 1}, 20: {0, 0, 0, 1}, 99: {}}, got)
}

func TestApplyStudioListRoleRowsCustom(t *testing.T) {
	statsByID := map[int]*StudioListStats{
		10: {
			StudioID:         "10",
			StudioRoleCounts: &StudioRoleCounts{},
		},
	}

	applyStudioListRoleRowsCustom([][]interface{}{
		{int64(10), int64(8), int64(5), int64(3), int64(2)},
		{int64(99), int64(1), int64(1), int64(1), int64(1)},
		{int64(10)},
	}, statsByID)

	got := statsByID[10].StudioRoleCounts
	if got.SexSceneCount != 8 || got.OralSceneCount != 5 || got.SoloSceneCount != 3 || got.FacialSceneCount != 2 {
		t.Fatalf("unexpected role counts: %+v", got)
	}
}

func TestCalculateStudioListActivityStatsCustom(t *testing.T) {
	sceneDurations := map[int]float64{1: 100, 2: 50, 3: 200}
	markers := []studioListActivityMarkerCustom{
		{sceneID: 1, start: 0, end: 20, primaryTagID: 11},
		{sceneID: 1, start: 20, end: 30, primaryTagID: 22, isGoat: true},
		{sceneID: 1, start: 15, end: 35, primaryTagID: 99},
		{sceneID: 1, start: 40, end: 50, primaryTagID: 99},
		{sceneID: 2, start: -5, end: 10, primaryTagID: 33},
	}
	negativeMarkers := []studioListNegativeMarkerCustom{
		{sceneID: 1, start: 60, end: 70},
		{sceneID: 2, start: 55, end: 70},
		{sceneID: 3, start: 0, end: 200},
	}

	got := calculateStudioListActivityStatsCustom(
		sceneDurations,
		markers,
		negativeMarkers,
		11,
		22,
		33,
	)

	assertStudioListFloatCustom(t, "total seconds", got.TotalSeconds, 150)
	assertStudioListFloatCustom(t, "sex seconds", got.SexSeconds, 20)
	assertStudioListFloatCustom(t, "oral seconds", got.OralSeconds, 10)
	assertStudioListFloatCustom(t, "solo seconds", got.SoloSeconds, 10)
	assertStudioListFloatCustom(t, "sex percent", got.SexPercent, 50)
	assertStudioListFloatCustom(t, "oral percent", got.OralPercent, 25)
	assertStudioListFloatCustom(t, "solo percent", got.SoloPercent, 25)
	assertStudioListFloatCustom(t, "unusable seconds", got.UnusableSeconds, 10)
	assertStudioListFloatCustom(t, "outstanding seconds", got.OutstandingSeconds, 30)
	assertStudioListFloatCustom(t, "standard seconds", got.StandardSeconds, 25)
	assertStudioListFloatCustom(t, "unclassified seconds", got.OtherSeconds, 85)
	if got.SexSceneCount != 1 || got.OralSceneCount != 1 || got.SoloSceneCount != 1 {
		t.Fatalf("unexpected activity scene counts: sex=%d oral=%d solo=%d", got.SexSceneCount, got.OralSceneCount, got.SoloSceneCount)
	}
}

func TestCalculateStudioListActivityStatsCustomScene9836(t *testing.T) {
	got := calculateStudioListActivityStatsCustom(
		map[int]float64{9836: 561.45},
		[]studioListActivityMarkerCustom{
			{sceneID: 9836, start: 65.521034, end: 480.17501, primaryTagID: 24},
			{sceneID: 9836, start: 447.626705, end: 460.807515, primaryTagID: 15, isOrgasm: true},
		},
		nil, 268, 196, 24,
	)
	assertStudioListFloatCustom(t, "outstanding seconds", got.OutstandingSeconds, 0)
	assertStudioListFloatCustom(t, "outstanding percent", got.OutstandingPercent, 0)
	assertStudioListFloatCustom(t, "standard seconds", got.StandardSeconds, 480.17501-65.521034)
	assertStudioListFloatCustom(t, "unclassified seconds", got.OtherSeconds, 561.45-(480.17501-65.521034))
}

func TestCalculateStudioListActivityStatsCustomExcludesScenesWithoutTimedRoleMarkers(t *testing.T) {
	got := calculateStudioListActivityStatsCustom(
		map[int]float64{1: 100, 2: 250, 3: 300},
		[]studioListActivityMarkerCustom{
			{sceneID: 1, start: 10, end: 40, primaryTagID: 11},
			{sceneID: 2, start: 20, end: 60, primaryTagID: 99},
			{sceneID: 3, start: 50, end: 50, primaryTagID: 22},
		},
		[]studioListNegativeMarkerCustom{{sceneID: 2, start: 0, end: 250}},
		11,
		22,
		33,
	)

	assertStudioListFloatCustom(t, "meaningful total seconds", got.TotalSeconds, 100)
	assertStudioListFloatCustom(t, "meaningful sex percent", got.SexPercent, 100)
	assertStudioListFloatCustom(t, "excluded unusable seconds", got.UnusableSeconds, 0)
}

func TestStudioListClampedIntervalCustom(t *testing.T) {
	got, ok := studioListClampedIntervalCustom(7, -5, 120, 100)
	if !ok || got.sceneID != 7 || got.start != 0 || got.end != 100 {
		t.Fatalf("unexpected clamped interval: %+v, ok=%v", got, ok)
	}

	if _, ok := studioListClampedIntervalCustom(7, 100, 100, 100); ok {
		t.Fatal("expected an empty interval to be rejected")
	}
}

func assertStudioListFloatCustom(t *testing.T, name string, got, want float64) {
	t.Helper()
	if math.Abs(got-want) > 0.0001 {
		t.Fatalf("%s: got %f, want %f", name, got, want)
	}
}

func TestStudioListSupportedMetricsCustom(t *testing.T) {
	got := studioListSupportedMetricsCustom([]string{
		"scenes_duration",
		"name",
		"latest_scene",
		"scenes_duration",
		"not_a_metric",
		"o_count",
	})
	require.Equal(t, []string{"scenes_duration", "latest_scene", "o_count"}, got)
}

func TestStudioListMetricStringCustom(t *testing.T) {
	require.Nil(t, studioListMetricStringCustom(nil))
	require.Equal(t, "2024-01-02", *studioListMetricStringCustom([]byte("2024-01-02")))
	require.Equal(t, "42", *studioListMetricStringCustom(int64(42)))
}
