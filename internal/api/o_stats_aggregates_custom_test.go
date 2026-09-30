package api

import (
	"database/sql"
	"fmt"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"
)

func openOStatsAggregateDBCustom(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	_, err = db.Exec(`
CREATE TABLE studios (id INTEGER PRIMARY KEY, parent_id INTEGER);
CREATE TABLE scenes (id INTEGER PRIMARY KEY, title TEXT, rating INTEGER, studio_id INTEGER);
CREATE TABLE scenes_tags (scene_id INTEGER, tag_id INTEGER);
CREATE TABLE performers (id INTEGER PRIMARY KEY, name TEXT, image_blob TEXT, rating INTEGER);
CREATE TABLE performers_scenes (performer_id INTEGER, scene_id INTEGER);
CREATE TABLE rating_bonus_scores (entity_type TEXT, entity_id INTEGER, key TEXT, raw_value REAL);
CREATE TABLE scenes_o_dates (scene_id INTEGER, o_date TEXT, video_timestamp REAL);
INSERT INTO studios(id, parent_id) VALUES (1, NULL);
INSERT INTO scenes(id, title, rating, studio_id) VALUES
  (1, 'Alpha', 90, 1),
  (2, 'Bravo', NULL, NULL),
  (3, 'No O', 50, 1);
INSERT INTO scenes_tags(scene_id, tag_id) VALUES (1, 7), (1, 8);
INSERT INTO performers(id, name) VALUES (10, 'Uno'), (20, 'Dos');
INSERT INTO performers_scenes(performer_id, scene_id) VALUES (10, 1), (20, 1), (20, 2);
INSERT INTO rating_bonus_scores(entity_type, entity_id, key, raw_value) VALUES ('scene', 1, 'godTierOrgasm', 1);
INSERT INTO scenes_o_dates(scene_id, o_date) VALUES
  (1, '2025-03-01T12:00:00Z'),
  (1, '2025-03-01T13:00:00Z'),
  (1, '2025-04-02T12:00:00Z'),
  (2, '2025-03-05T12:00:00Z'),
  (2, '2023-01-01T12:00:00Z');
`)
	require.NoError(t, err)
	return db
}

func TestSceneOCountsBySceneQueryCustom(t *testing.T) {
	db := openOStatsAggregateDBCustom(t)
	rows, err := db.Query(sceneOCountsBySceneQueryCustom(""))
	require.NoError(t, err)
	defer rows.Close()

	var got []string
	for rows.Next() {
		var id, count, bonus int
		var title string
		var rating sql.NullInt64
		var tags sql.NullString
		require.NoError(t, rows.Scan(&id, &title, &rating, &count, &tags, &bonus))
		got = append(got, fmt.Sprintf("%d:%s:%d:%d:%v:%d", id, title, rating.Int64, count, sceneOCountTagIDsCustom(tags.String), bonus))
	}
	require.NoError(t, rows.Err())
	require.Equal(t, []string{
		"1:Alpha:90:3:[7 8]:1",
		"2:Bravo:0:2:[]:0",
	}, got)
}

func TestSceneOCountsByPerformerQueryCustomCountsEachOOncePerVato(t *testing.T) {
	db := openOStatsAggregateDBCustom(t)
	from := "2025-01-01"
	scope, args, err := sceneOStatsScopeCustom(nil, nil, &StatsDateRangeInput{From: &from})
	require.NoError(t, err)
	rows, err := db.Query(sceneOCountsByPerformerQueryCustom(scope), args...)
	require.NoError(t, err)
	defer rows.Close()

	var got []string
	for rows.Next() {
		var id, count, hasImage int
		var name string
		var rating sql.NullInt64
		require.NoError(t, rows.Scan(&id, &name, &count, &hasImage, &rating))
		got = append(got, fmt.Sprintf("%s:%d", name, count))
	}
	require.NoError(t, rows.Err())
	require.Equal(t, []string{"Dos:4", "Uno:3"}, got)
}

func TestSceneOCalendarDayCountsQueryCustomUsesLocalDays(t *testing.T) {
	db := openOStatsAggregateDBCustom(t)
	rows, err := db.Query(sceneOCalendarDayCountsQueryCustom(""), sceneODateTrackingStart, "2025")
	require.NoError(t, err)
	defer rows.Close()

	got := map[string]int{}
	for rows.Next() {
		var date string
		var day, count int
		require.NoError(t, rows.Scan(&date, &day, &count))
		got[date] += count
	}
	require.NoError(t, rows.Err())

	want := map[string]int{}
	for _, value := range []string{"2025-03-01T12:00:00Z", "2025-03-01T13:00:00Z", "2025-04-02T12:00:00Z", "2025-03-05T12:00:00Z"} {
		parsed, err := time.Parse(time.RFC3339, value)
		require.NoError(t, err)
		want[parsed.Local().Format("2006-01-02")]++
	}
	require.Equal(t, want, got)
}

func TestSceneOMostOsInDayQueryCustomUsesLocalDays(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	// Pick UTC times on either side of local midnight so the local and UTC
	// groupings disagree in every non-UTC timezone.
	localMidnight := time.Date(2025, 6, 10, 0, 0, 0, 0, time.Local)
	before := localMidnight.Add(-30 * time.Minute).UTC().Format(time.RFC3339)
	after := localMidnight.Add(30 * time.Minute).UTC().Format(time.RFC3339)
	afterAgain := localMidnight.Add(45 * time.Minute).UTC().Format(time.RFC3339)
	_, err = db.Exec(`CREATE TABLE scenes_o_dates (scene_id INTEGER, o_date TEXT)`)
	require.NoError(t, err)
	_, err = db.Exec(`INSERT INTO scenes_o_dates(scene_id, o_date) VALUES (1, ?), (1, ?), (1, ?)`, before, after, afterAgain)
	require.NoError(t, err)

	var day string
	var count int
	require.NoError(t, db.QueryRow(sceneOMostOsInDayQueryCustom(""), sceneODateTrackingStart, sceneODateMostOsExcludedDay).Scan(&day, &count))
	require.Equal(t, "2025-06-10", day)
	require.Equal(t, 2, count)
}

func TestSceneOSceneIDsJSONCustom(t *testing.T) {
	encoded, err := sceneOSceneIDsJSONCustom([]string{"3", "12"})
	require.NoError(t, err)
	require.Equal(t, "[3,12]", encoded)

	_, err = sceneOSceneIDsJSONCustom([]string{"3", "x"})
	require.Error(t, err)
}

func TestSceneOTopListsBreakTiesByMostRecentO(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	_, err = db.Exec(`
CREATE TABLE scenes (id INTEGER PRIMARY KEY, title TEXT, rating INTEGER, studio_id INTEGER);
CREATE TABLE scenes_tags (scene_id INTEGER, tag_id INTEGER);
CREATE TABLE performers (id INTEGER PRIMARY KEY, name TEXT, image_blob TEXT, rating INTEGER);
CREATE TABLE performers_scenes (performer_id INTEGER, scene_id INTEGER);
CREATE TABLE rating_bonus_scores (entity_type TEXT, entity_id INTEGER, key TEXT, raw_value REAL);
CREATE TABLE scenes_o_dates (scene_id INTEGER, o_date TEXT, video_timestamp REAL);
INSERT INTO scenes(id, title) VALUES (1, 'Alpha'), (2, 'Bravo');
INSERT INTO performers(id, name) VALUES (10, 'Aaron'), (20, 'Zed');
INSERT INTO performers_scenes(performer_id, scene_id) VALUES (10, 1), (20, 2);
INSERT INTO scenes_o_dates(scene_id, o_date) VALUES
  (1, '2025-01-01T10:00:00Z'),
  (1, '2025-02-01T10:00:00Z'),
  (2, '2025-01-15T10:00:00Z'),
  (2, '2025-03-01T10:00:00Z');
`)
	require.NoError(t, err)

	// Both scenes and both vatos have 2 O's; Bravo/Zed reached it later, so
	// they rank first even though they sort last by name.
	var sceneID, sceneCount, bonus int
	var firstScene, firstVato string
	var sceneRating sql.NullInt64
	var tags sql.NullString
	require.NoError(t, db.QueryRow(sceneOCountsBySceneQueryCustom("")).Scan(&sceneID, &firstScene, &sceneRating, &sceneCount, &tags, &bonus))
	require.Equal(t, "Bravo", firstScene)

	rows, err := db.Query(sceneOCountsByPerformerQueryCustom(""))
	require.NoError(t, err)
	defer rows.Close()
	require.True(t, rows.Next())
	var id, count, hasImage int
	var rating sql.NullInt64
	require.NoError(t, rows.Scan(&id, &firstVato, &count, &hasImage, &rating))
	require.Equal(t, "Zed", firstVato)
}
