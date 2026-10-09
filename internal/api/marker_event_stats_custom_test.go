package api

import (
	"database/sql"
	"testing"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"
)

func markerEventStatsRunnerCustomForTest(db *sql.DB) markerEventStatsRunnerCustom {
	return func(query string, args []interface{}) ([][]interface{}, error) {
		rows, err := db.Query(query, args...)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		columns, err := rows.Columns()
		if err != nil {
			return nil, err
		}
		ret := [][]interface{}{}
		for rows.Next() {
			values := make([]interface{}, len(columns))
			pointers := make([]interface{}, len(columns))
			for i := range values {
				pointers[i] = &values[i]
			}
			if err := rows.Scan(pointers...); err != nil {
				return nil, err
			}
			ret = append(ret, values)
		}
		return ret, rows.Err()
	}
}

func openMarkerEventStatsDBCustom(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { db.Close() })
	_, err = db.Exec(`
CREATE TABLE scenes (id INTEGER PRIMARY KEY, studio_id INTEGER, title TEXT, rating INTEGER, date TEXT, created_at TEXT);
CREATE TABLE scene_releases (scene_id INTEGER, date TEXT);
CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE tags_relations (parent_id INTEGER, child_id INTEGER);
CREATE TABLE scene_markers (id INTEGER PRIMARY KEY, scene_id INTEGER, primary_tag_id INTEGER, seconds REAL, end_seconds REAL);
CREATE TABLE scene_markers_tags (scene_marker_id INTEGER, tag_id INTEGER);
CREATE TABLE scene_marker_performers (scene_marker_id INTEGER, performer_id INTEGER, role TEXT);
CREATE TABLE performers (id INTEGER PRIMARY KEY, name TEXT, rating INTEGER, ethnicity TEXT, country TEXT, image_blob TEXT, birthdate TEXT);
CREATE TABLE scenes_o_dates (scene_id INTEGER, o_date TEXT, video_timestamp REAL);

INSERT INTO tags(id, name) VALUES
  (1, 'orgasm'), (3, 'RHOrgasm'), (8, 'facial'), (27, 'selffacial'), (45, 'handsfree'),
  (40, 'GOAT'), (37, '2nd camera'), (30, 'sex'), (50, 'anal'), (31, 'oral'), (23, 'solo');
INSERT INTO tags_relations(parent_id, child_id) VALUES (1, 3), (1, 8), (8, 27), (1, 45), (30, 50);
INSERT INTO performers(id, name, rating, ethnicity, country, image_blob, birthdate) VALUES
  (101, 'Beto', 90, 'Latino', 'MX', 'x', '1990-01-01'),
  (102, 'Andre', NULL, 'Black', 'US', NULL, '2000-06-01'),
  (103, 'Zed', NULL, '', NULL, NULL, NULL);
INSERT INTO scenes(id, title, rating, date) VALUES (1, 'Pool Party', 80, '2020-01-01');

-- m1: nut while getting fucked; Really Hot, hands-free, no end (20s window).
INSERT INTO scene_markers VALUES (1, 1, 1, 100, NULL);
INSERT INTO scene_markers_tags VALUES (1, 45), (1, 3);
INSERT INTO scene_marker_performers VALUES (1, 101, 'top'), (1, 102, 'bottom');
-- m2: facial from two tops; GOAT wins over Really Hot; self-facial rolls up to facial.
INSERT INTO scene_markers VALUES (2, 1, 8, 200, 210);
INSERT INTO scene_markers_tags VALUES (2, 40), (2, 3), (2, 27);
INSERT INTO scene_marker_performers VALUES (2, 101, 'top'), (2, 102, 'top'), (2, 103, 'bottom');
-- m3: second camera repeat is skipped.
INSERT INTO scene_markers VALUES (3, 1, 1, 300, 305);
INSERT INTO scene_markers_tags VALUES (3, 37);
-- m4: no tops still counts once.
INSERT INTO scene_markers VALUES (4, 1, 1, 400, 410);

-- Activity markers.
INSERT INTO scene_markers VALUES (10, 1, 50, 90, 110);
INSERT INTO scene_marker_performers VALUES (10, 102, 'top'), (10, 101, 'bottom');
INSERT INTO scene_markers VALUES (11, 1, 31, 205, 215);
INSERT INTO scene_marker_performers VALUES (11, 101, 'top'), (11, 103, 'bottom');
INSERT INTO scene_markers VALUES (12, 1, 23, 395, 420);
-- Starts exactly when m1's window ends, so it does not overlap.
INSERT INTO scene_markers VALUES (13, 1, 30, 120, 130);
INSERT INTO scene_marker_performers VALUES (13, 101, 'top');

INSERT INTO scenes_o_dates(scene_id, o_date, video_timestamp) VALUES
  (1, '2026-01-01T12:00:00Z', 105),
  (1, '2025-01-01T12:00:00Z', 120),
  (1, '2025-01-01T12:00:00Z', 205),
  (1, '2025-01-01T12:00:00Z', 500),
  (1, '2025-01-01T12:00:00Z', NULL);
`)
	require.NoError(t, err)
	return db
}

func markerEventStatsTestTagsCustom(root int) markerEventStatsTagsCustom {
	return markerEventStatsTagsCustom{root: root, secondCamera: 37, reallyHot: 3, goat: 40, sex: 30, oral: 31, solo: 23}
}

func loadMarkerEventStatsForTestCustom(t *testing.T, db *sql.DB, root int, dateRangeInput *StatsDateRangeInput) *MarkerEventStatsResult {
	t.Helper()
	scope, scopeArgs, dateRange, err := sceneStatsInputScopeCustom(nil, nil, dateRangeInput)
	require.NoError(t, err)
	ret, err := loadMarkerEventStatsCustom(markerEventStatsRunnerCustomForTest(db), scope, scopeArgs, dateRange, markerEventStatsTestTagsCustom(root), "http://stash")
	require.NoError(t, err)
	return ret
}

func TestMarkerEventStatsNutEventsCustom(t *testing.T) {
	db := openMarkerEventStatsDBCustom(t)
	ret := loadMarkerEventStatsForTestCustom(t, db, 1, nil)

	// Events follow the weighted total: once per top, minimum one, no 2nd camera.
	scope, scopeArgs := activityStatsSceneScopeCustom(nil, nil, nil)
	var weighted int
	require.NoError(t, db.QueryRow(statsWeightedMarkerCountScopedQueryCustom(scope), append(scopeArgs, 1, 37)...).Scan(&weighted))
	require.Len(t, ret.Events, weighted)
	require.Len(t, ret.Events, 4)

	ageOf := func(vato *MarkerEventStatsVato) *int {
		require.NotNil(t, vato)
		return vato.Age
	}
	thirty, nineteen := 30, 19

	m1 := ret.Events[0]
	require.Equal(t, "1", m1.MarkerID)
	require.Equal(t, "Pool Party", *m1.SceneTitle)
	require.Equal(t, 80, *m1.SceneRating100)
	require.Equal(t, "2020-01-01", *m1.SceneDate)
	require.Equal(t, "2026-01-01T12:00:00Z", *m1.LatestODate)
	require.Equal(t, 20.0, m1.Duration)
	require.Equal(t, "101", m1.Giver.PerformerID)
	require.Equal(t, &thirty, ageOf(m1.Giver))
	require.Equal(t, "102", m1.Receivers[0].PerformerID)
	require.Equal(t, 2, m1.OCount, "O's at the start and the inclusive 20s end count")
	require.Equal(t, []string{"45"}, m1.TypeTagIds)
	require.Equal(t, MarkerEventQualityReallyHot, m1.Quality)
	require.Equal(t, []MarkerEventActivity{MarkerEventActivityGettingFucked}, m1.Activities, "a sex marker starting at the window end does not overlap")

	m2a, m2b := ret.Events[1], ret.Events[2]
	require.Equal(t, "2", m2a.MarkerID)
	require.Equal(t, "2", m2b.MarkerID)
	require.Equal(t, "102", m2a.Giver.PerformerID, "tops are ordered by name")
	require.Equal(t, "101", m2b.Giver.PerformerID)
	require.Equal(t, &nineteen, ageOf(m2a.Giver))
	require.Nil(t, ageOf(m2a.Receivers[0]))
	require.Equal(t, []string{"8"}, m2a.TypeTagIds, "self-facial rolls up to facial")
	require.Equal(t, MarkerEventQualityGoat, m2a.Quality)
	require.Equal(t, 1, m2a.OCount)
	require.Empty(t, m2a.Activities)
	require.Equal(t, []MarkerEventActivity{MarkerEventActivityGettingSucked}, m2b.Activities)

	m4 := ret.Events[3]
	require.Equal(t, "4", m4.MarkerID)
	require.Nil(t, m4.Giver)
	require.Empty(t, m4.Receivers)
	require.Empty(t, m4.TypeTagIds)
	require.Equal(t, MarkerEventQualityRegular, m4.Quality)
	require.Empty(t, m4.Activities, "no giver means no activity, even inside a solo marker")

	require.Equal(t, []*MarkerEventStatsType{{ID: "8", Name: "facial"}, {ID: "45", Name: "handsfree"}}, ret.Types)
	require.Len(t, ret.Performers, 3)
	require.Equal(t, "Andre", ret.Performers[0].Name)
	require.Equal(t, "http://stash/performer/102/image?t=0&default=true", *ret.Performers[0].ImagePath)
	require.Nil(t, ret.Performers[2].Ethnicity, "blank ethnicity is unknown")
}

func TestMarkerEventStatsFacialEventsCustom(t *testing.T) {
	db := openMarkerEventStatsDBCustom(t)
	ret := loadMarkerEventStatsForTestCustom(t, db, 8, nil)
	require.Len(t, ret.Events, 2)
	require.Equal(t, []string{"27"}, ret.Events[0].TypeTagIds, "facial sub-types roll up below the facial tag")
	require.Equal(t, []*MarkerEventStatsType{{ID: "27", Name: "selffacial"}}, ret.Types)
}

func TestMarkerEventStatsSoloWithoutVatosCustom(t *testing.T) {
	db := openMarkerEventStatsDBCustom(t)
	_, err := db.Exec(`INSERT INTO scene_marker_performers VALUES (4, 101, 'top')`)
	require.NoError(t, err)
	ret := loadMarkerEventStatsForTestCustom(t, db, 1, nil)
	require.Equal(t, []MarkerEventActivity{MarkerEventActivitySolo}, ret.Events[3].Activities)
}

func TestMarkerEventStatsSurroundingActivityCustom(t *testing.T) {
	db := openMarkerEventStatsDBCustom(t)
	_, err := db.Exec(`
INSERT INTO scene_markers VALUES (20, 1, 1, 600, 610);
INSERT INTO scene_marker_performers VALUES (20, 101, 'top');
-- Oral ends 5s before and starts 5s after: he was getting sucked.
INSERT INTO scene_markers VALUES (21, 1, 31, 580, 595), (22, 1, 31, 615, 630);
INSERT INTO scene_marker_performers VALUES (21, 101, 'top'), (22, 101, 'top');
-- Sex only before the nut does not count.
INSERT INTO scene_markers VALUES (23, 1, 30, 570, 592);
INSERT INTO scene_marker_performers VALUES (23, 101, 'bottom');`)
	require.NoError(t, err)
	ret := loadMarkerEventStatsForTestCustom(t, db, 1, nil)
	last := ret.Events[len(ret.Events)-1]
	require.Equal(t, "20", last.MarkerID)
	require.Equal(t, []MarkerEventActivity{MarkerEventActivityGettingSucked}, last.Activities)

	// Beyond the 10-second leniency the surrounding marker no longer counts.
	_, err = db.Exec(`UPDATE scene_markers SET seconds = 621 WHERE id = 22`)
	require.NoError(t, err)
	ret = loadMarkerEventStatsForTestCustom(t, db, 1, nil)
	require.Empty(t, ret.Events[len(ret.Events)-1].Activities)
}

func TestMarkerEventStatsODateRangeCustom(t *testing.T) {
	db := openMarkerEventStatsDBCustom(t)
	from, to := "2026-01-01", "2026-12-31"
	field := StatsDateFieldODate
	ret := loadMarkerEventStatsForTestCustom(t, db, 1, &StatsDateRangeInput{From: &from, To: &to, Field: &field})
	require.Len(t, ret.Events, 4)
	require.Equal(t, 1, ret.Events[0].OCount, "O date ranges also limit O counts")
	require.Zero(t, ret.Events[1].OCount)

	from, to = "2021-01-01", "2021-12-31"
	release := StatsDateFieldRelease
	ret = loadMarkerEventStatsForTestCustom(t, db, 1, &StatsDateRangeInput{From: &from, To: &to, Field: &release})
	require.Empty(t, ret.Events)
}

func TestMarkerEventStatsUnconfiguredCustom(t *testing.T) {
	db := openMarkerEventStatsDBCustom(t)
	ret := loadMarkerEventStatsForTestCustom(t, db, 0, nil)
	require.Empty(t, ret.Events)
	require.NotNil(t, ret.Performers)
	require.NotNil(t, ret.Types)
}
