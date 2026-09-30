package api

import (
	"database/sql"
	"fmt"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"
)

func statsDateRangeInputCustom(from string, to string, field StatsDateField) *StatsDateRangeInput {
	ret := &StatsDateRangeInput{Field: &field}
	if from != "" {
		ret.From = &from
	}
	if to != "" {
		ret.To = &to
	}
	return ret
}

func TestParseStatsDateRangeCustom(t *testing.T) {
	parsed, err := parseStatsDateRangeCustom(nil)
	require.NoError(t, err)
	require.Nil(t, parsed)

	parsed, err = parseStatsDateRangeCustom(statsDateRangeInputCustom("", "", StatsDateFieldAdded))
	require.NoError(t, err)
	require.Nil(t, parsed, "a range without bounds is unfiltered")

	parsed, err = parseStatsDateRangeCustom(statsDateRangeInputCustom("2025-01-01", "", StatsDateFieldODate))
	require.NoError(t, err)
	require.Equal(t, &statsDateRangeCustom{from: "2025-01-01", field: StatsDateFieldODate}, parsed)

	_, err = parseStatsDateRangeCustom(statsDateRangeInputCustom("2025-13-01", "", StatsDateFieldRelease))
	require.Error(t, err)
	_, err = parseStatsDateRangeCustom(statsDateRangeInputCustom("2025-02-01", "2025-01-01", StatsDateFieldRelease))
	require.Error(t, err)

	today := time.Date(2026, 9, 30, 0, 0, 0, 0, time.UTC)
	require.Equal(t, today, (*statsDateRangeCustom)(nil).endDate(today))
	require.Equal(t, "2025-12-31", (&statsDateRangeCustom{to: "2025-12-31"}).endDate(today).Format("2006-01-02"))
	require.Equal(t, today, (&statsDateRangeCustom{to: "2027-01-01"}).endDate(today))
}

func openSceneStatsDateRangeDBCustom(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	_, err = db.Exec(`
CREATE TABLE studios (id INTEGER PRIMARY KEY, parent_id INTEGER);
CREATE TABLE scenes (
  id INTEGER PRIMARY KEY,
  title TEXT,
  date TEXT,
  rating INTEGER,
  studio_id INTEGER,
  created_at DATETIME
);
CREATE TABLE scenes_files (scene_id INTEGER, file_id INTEGER, "primary" BOOLEAN);
CREATE TABLE files (id INTEGER PRIMARY KEY, size INTEGER);
CREATE TABLE video_files (file_id INTEGER, duration REAL, width INTEGER, height INTEGER);
CREATE TABLE scene_releases (scene_id INTEGER, date DATETIME);
CREATE TABLE scenes_o_dates (scene_id INTEGER, o_date DATETIME);
CREATE TABLE rating_bonus_scores (entity_type TEXT, entity_id INTEGER, key TEXT, raw_value REAL);
INSERT INTO studios(id, parent_id) VALUES (1, NULL);
INSERT INTO scenes(id, title, date, rating, studio_id, created_at) VALUES
  (1, 'Released 2024, added 2025', '2024-06-01', 90, 1, '2025-02-01 12:00:00'),
  (2, 'Released 2025 via release row', NULL, 70, 1, '2024-01-01 12:00:00'),
  (3, 'Undated', NULL, 50, NULL, '2023-01-01 12:00:00');
INSERT INTO scene_releases(scene_id, date) VALUES (2, '2025-03-01');
INSERT INTO scenes_o_dates(scene_id, o_date) VALUES
  (1, '2025-01-10 12:00:00'),
  (1, '2026-01-10 12:00:00'),
  (2, '2024-05-05 12:00:00'),
  (3, '2025-07-07 12:00:00');
INSERT INTO rating_bonus_scores(entity_type, entity_id, key, raw_value) VALUES
  ('scene', 1, 'goatElement', 0.5),
  ('scene', 2, 'godTierOrgasm', 0);
`)
	require.NoError(t, err)
	return db
}

func sceneStatsScopedIDsCustom(t *testing.T, db *sql.DB, studioID *int, dateRange *statsDateRangeCustom) []int {
	t.Helper()
	scope, args := activityStatsSceneScopeCustom(studioID, nil, dateRange)
	rows, err := db.Query(scope+"\nSELECT id FROM selected_scenes ORDER BY id", args...)
	require.NoError(t, err)
	defer rows.Close()
	var ids []int
	for rows.Next() {
		var id int
		require.NoError(t, rows.Scan(&id))
		ids = append(ids, id)
	}
	require.NoError(t, rows.Err())
	return ids
}

func TestActivityStatsSceneScopeCustomDateRangeFields(t *testing.T) {
	db := openSceneStatsDateRangeDBCustom(t)
	studioID := 1

	for _, test := range []struct {
		name      string
		studioID  *int
		dateRange *statsDateRangeCustom
		want      []int
	}{
		{name: "unfiltered", want: []int{1, 2, 3}},
		{name: "effective release date", dateRange: &statsDateRangeCustom{from: "2025-01-01", to: "2025-12-31", field: StatsDateFieldRelease}, want: []int{2}},
		{name: "date added", dateRange: &statsDateRangeCustom{from: "2025-01-01", field: StatsDateFieldAdded}, want: []int{1}},
		{name: "O date", dateRange: &statsDateRangeCustom{from: "2025-01-01", to: "2025-12-31", field: StatsDateFieldODate}, want: []int{1, 3}},
		{name: "studio and O date", studioID: &studioID, dateRange: &statsDateRangeCustom{to: "2024-12-31", field: StatsDateFieldODate}, want: []int{2}},
	} {
		t.Run(test.name, func(t *testing.T) {
			require.Equal(t, test.want, sceneStatsScopedIDsCustom(t, db, test.studioID, test.dateRange))
		})
	}
}

func TestSceneStatsBaseQueryCustomLimitsOCountsOnlyForODateRanges(t *testing.T) {
	db := openSceneStatsDateRangeDBCustom(t)

	oCounts := func(dateRange *statsDateRangeCustom) map[int][2]int {
		scope, scopeArgs := activityStatsSceneScopeCustom(nil, nil, dateRange)
		oDateWhere, oDateArgs := dateRange.oDateWhereSQL("od")
		query := sceneStatsBaseScopedQueryCustom(sceneOStatsEffectiveDateExpr("s"), scope, oDateWhere)
		rows, err := db.Query(query, append(scopeArgs, oDateArgs...)...)
		require.NoError(t, err)
		defer rows.Close()

		ret := map[int][2]int{}
		for rows.Next() {
			values := make([]interface{}, 12)
			destinations := make([]interface{}, len(values))
			for i := range values {
				destinations[i] = &values[i]
			}
			require.NoError(t, rows.Scan(destinations...))
			ret[customIntValue(values[0])] = [2]int{customIntValue(values[5]), customIntValue(values[11])}
		}
		require.NoError(t, rows.Err())
		return ret
	}

	require.Equal(t, map[int][2]int{1: {2, 1}, 2: {1, 0}, 3: {1, 0}}, oCounts(nil))
	require.Equal(t,
		map[int][2]int{1: {1, 1}, 3: {1, 0}},
		oCounts(&statsDateRangeCustom{from: "2025-01-01", to: "2025-12-31", field: StatsDateFieldODate}),
		"O-date ranges count only O's inside the range",
	)
	require.Equal(t,
		map[int][2]int{2: {1, 0}},
		oCounts(&statsDateRangeCustom{from: "2025-01-01", to: "2025-12-31", field: StatsDateFieldRelease}),
		"release ranges keep all-time O counts",
	)
}

func TestSceneStatsAddPerformerCustomTracksPerformerIDs(t *testing.T) {
	scene := &SceneStatsScene{}
	sceneStatsAddPerformerCustom(scene, 10, "A", "MX")
	sceneStatsAddPerformerCustom(scene, 20, "B", "US")
	require.Equal(t, 2, scene.PerformerCount)
	require.Equal(t, []string{"10", "20"}, scene.PerformerIds)
	require.Equal(t, []string{"A", "B"}, scene.PerformerEthnicities)
	require.Equal(t, []string{"MX", "US"}, scene.PerformerCountries)
}

func TestSceneStatsScopedMarkerQueryCustomRollsDescendantsUpToRoots(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	_, err = db.Exec(`
CREATE TABLE scenes (id INTEGER PRIMARY KEY, date TEXT, created_at DATETIME);
CREATE TABLE scene_markers (id INTEGER PRIMARY KEY, scene_id INTEGER, primary_tag_id INTEGER);
CREATE TABLE scene_markers_tags (scene_marker_id INTEGER, tag_id INTEGER);
CREATE TABLE tags_relations (parent_id INTEGER, child_id INTEGER);
INSERT INTO scenes(id) VALUES (1);
INSERT INTO tags_relations(parent_id, child_id) VALUES (100, 101), (101, 102), (300, 301);
INSERT INTO scene_markers(id, scene_id, primary_tag_id) VALUES
  (1, 1, 100),
  (2, 1, 200),
  (3, 1, 200),
  (4, 1, 101),
  (5, 1, 102),
  (6, 1, 301);
INSERT INTO scene_markers_tags(scene_marker_id, tag_id) VALUES
  (1, 200),
  (2, 101),
  (3, 200),
  (4, 100),
  (4, 200),
  (5, 200),
  (6, 102);
`)
	require.NoError(t, err)

	sceneScope, _ := activityStatsSceneScopeCustom(nil, nil, nil)
	query, args := sceneStatsScopedMarkerQueryCustom(sceneScope, []int{100, 100, 300, 0})
	require.Equal(t, []interface{}{100, 300}, args)
	rows, err := db.Query(query, args...)
	require.NoError(t, err)
	defer rows.Close()

	var got []string
	for rows.Next() {
		var sceneID, markerID, rootID int
		require.NoError(t, rows.Scan(&sceneID, &markerID, &rootID))
		got = append(got, fmt.Sprintf("%d:%d:%d", sceneID, markerID, rootID))
	}
	require.NoError(t, rows.Err())
	// Grandchild 102 rolls up to 100; marker 6 belongs to both families.
	require.Equal(t, []string{
		"1:1:100",
		"1:2:100",
		"1:4:100",
		"1:5:100",
		"1:6:100",
		"1:6:300",
	}, got)
}
