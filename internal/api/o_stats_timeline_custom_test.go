package api

import (
	"database/sql"
	"testing"

	"github.com/stretchr/testify/require"
)

func oStatsTimelineIDsCustom(t *testing.T, db *sql.DB, scope string, args []interface{}, page, size int) []int {
	t.Helper()
	rows, err := db.Query(sceneOEventPageQueryCustom(scope), append(append([]interface{}{}, args...), size, (page-1)*size)...)
	require.NoError(t, err)
	defer rows.Close()
	ids := []int{}
	for rows.Next() {
		var id, sceneID int
		var date string
		var timestamp sql.NullFloat64
		require.NoError(t, rows.Scan(&id, &sceneID, &date, &timestamp))
		ids = append(ids, id)
	}
	require.NoError(t, rows.Err())
	return ids
}

func TestOStatsTimelinePagesCustom(t *testing.T) {
	db := openOStatsAggregateDBCustom(t)
	_, err := db.Exec(`DELETE FROM scenes_o_dates;
INSERT INTO studios VALUES (2, 1);
UPDATE scenes SET studio_id = 2 WHERE id = 2;
INSERT INTO scenes_o_dates(scene_id, o_date, video_timestamp) VALUES
 (1, '2026-01-02T12:00:00Z', 5),
 (1, '2026-01-02T12:00:00Z', 5),
 (2, '2026-01-02T12:00:00Z', 10),
 (1, '2026-01-01T12:00:00Z', NULL),
 (2, '2023-01-01T12:00:00Z', NULL),
 (1, NULL, NULL),
 (999, '2026-01-03T12:00:00Z', NULL);`)
	require.NoError(t, err)
	// Stable ties are broken by video timestamp, then event ID; no duplicates at page boundaries.
	require.Equal(t, []int{3, 2}, oStatsTimelineIDsCustom(t, db, "", nil, 1, 2))
	require.Equal(t, []int{1, 4}, oStatsTimelineIDsCustom(t, db, "", nil, 2, 2))
	require.Equal(t, []int{5}, oStatsTimelineIDsCustom(t, db, "", nil, 3, 2))
	require.Empty(t, oStatsTimelineIDsCustom(t, db, "", nil, 4, 2))
	var count int
	require.NoError(t, db.QueryRow("SELECT COUNT(*)"+sceneOEventPageFromCustom("")).Scan(&count))
	require.Equal(t, 5, count, "all dated events are included, even before reliable calendar tracking; null dates and orphan scenes are omitted")

	studioID := "1"
	depth := 0
	from, to := "2026-01-01", "2026-01-02"
	scope, args, err := sceneOStatsScopeCustom(&studioID, &depth, &StatsDateRangeInput{From: &from, To: &to})
	require.NoError(t, err)
	require.Equal(t, []int{2, 1, 4}, oStatsTimelineIDsCustom(t, db, scope, args, 1, 25))
	depth = -1
	scope, args, err = sceneOStatsScopeCustom(&studioID, &depth, &StatsDateRangeInput{From: &from, To: &to})
	require.NoError(t, err)
	require.Equal(t, []int{3, 2, 1, 4}, oStatsTimelineIDsCustom(t, db, scope, args, 1, 25))

	from = "2027-01-01"
	scope, args, err = sceneOStatsScopeCustom(nil, nil, &StatsDateRangeInput{From: &from})
	require.NoError(t, err)
	require.Empty(t, oStatsTimelineIDsCustom(t, db, scope, args, 1, 25))
	require.NoError(t, db.QueryRow("SELECT COUNT(*)"+sceneOEventPageFromCustom(scope), args...).Scan(&count))
	require.Zero(t, count)
}

func TestOStatsTimelinePageBoundsCustom(t *testing.T) {
	for _, pair := range [][2]int{{0, 25}, {-1, 25}, {1, 0}, {1, 101}} {
		require.Error(t, validateSceneOEventPageCustom(pair[0], pair[1]))
	}
	require.NoError(t, validateSceneOEventPageCustom(1, 5))
	require.Equal(t, 1, sceneOEventPageNumberCustom(99, 25, 0))
	require.Equal(t, 1, sceneOEventPageNumberCustom(99, 25, 25))
	require.Equal(t, 2, sceneOEventPageNumberCustom(99, 25, 26))
	require.Equal(t, 2, sceneOEventPageNumberCustom(2, 25, 76))
}

func TestOStatsTimelineUsesFullEventTimeCustom(t *testing.T) {
	db := openOStatsAggregateDBCustom(t)
	_, err := db.Exec(`DELETE FROM scenes_o_dates;
INSERT INTO scenes_o_dates(scene_id, o_date, video_timestamp) VALUES
 (1, '2026-01-01T12:00:00.100Z', 9),
 (1, '2026-01-01T12:00:00.200Z', 0),
 (1, '2026-01-01T06:00:00.200-06:00', 0);`)
	require.NoError(t, err)
	require.Equal(t, []int{3, 2, 1}, oStatsTimelineIDsCustom(t, db, "", nil, 1, 5), "sub-second O dates take priority over video timestamps; timezone offsets describe the same instant")
}
