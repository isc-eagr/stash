package api

import (
	"database/sql"
	"fmt"
	"testing"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stashapp/stash/pkg/sqlite"
	"github.com/stretchr/testify/require"
)

// Scene-only fixtures still need the release tables read by the shared O source.
const oStatsReleaseTablesSchemaCustom = `
CREATE TABLE IF NOT EXISTS scene_releases (id INTEGER PRIMARY KEY, scene_id INTEGER, studio_id INTEGER, date DATETIME);
CREATE TABLE IF NOT EXISTS scene_release_o_dates (release_id INTEGER, o_date DATETIME, video_timestamp REAL);
CREATE TABLE IF NOT EXISTS scene_release_performers (release_id INTEGER, performer_id INTEGER);
`

// openOStatsReleaseDBCustom: scene 1 (studio 1, cast Uno) has 2 O's; its
// release 9 (studio 2, cast Dos) has 2 O's, one inside a release marker.
func openOStatsReleaseDBCustom(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })
	_, err = db.Exec(`
CREATE TABLE studios (id INTEGER PRIMARY KEY, parent_id INTEGER);
CREATE TABLE scenes (id INTEGER PRIMARY KEY, title TEXT, rating INTEGER, studio_id INTEGER);
CREATE TABLE performers (id INTEGER PRIMARY KEY, name TEXT, image_blob TEXT, rating INTEGER);
CREATE TABLE performers_scenes (performer_id INTEGER, scene_id INTEGER);
CREATE TABLE scenes_o_dates (scene_id INTEGER, o_date TEXT, video_timestamp REAL);
CREATE TABLE scene_releases (id INTEGER PRIMARY KEY, scene_id INTEGER, studio_id INTEGER);
CREATE TABLE scene_release_o_dates (release_id INTEGER, o_date TEXT, video_timestamp REAL);
CREATE TABLE scene_release_performers (release_id INTEGER, performer_id INTEGER);
CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE scene_markers (id INTEGER PRIMARY KEY, scene_id INTEGER, release_id INTEGER, primary_tag_id INTEGER, seconds REAL, end_seconds REAL);
CREATE TABLE scene_markers_tags (scene_marker_id INTEGER, tag_id INTEGER);
INSERT INTO studios VALUES (1, NULL), (2, NULL);
INSERT INTO scenes VALUES (1, 'Alpha', 80, 1);
INSERT INTO performers(id, name) VALUES (10, 'Uno'), (20, 'Dos');
INSERT INTO performers_scenes VALUES (10, 1);
INSERT INTO scenes_o_dates VALUES (1, '2025-03-01T12:00:00Z', 30), (1, '2025-03-03T12:00:00Z', NULL);
INSERT INTO scene_releases VALUES (9, 1, 2);
INSERT INTO scene_release_o_dates VALUES (9, '2025-03-02T12:00:00Z', 15), (9, '2025-03-04T12:00:00Z', NULL);
INSERT INTO scene_release_performers VALUES (9, 20);
INSERT INTO tags VALUES (5, 'Kiss'), (6, 'Ride');
-- The scene marker covers 30s on the scene; the release marker covers 15s.
INSERT INTO scene_markers VALUES (100, 1, NULL, 5, 25, 35), (101, NULL, 9, 6, 10, 20);
`)
	require.NoError(t, err)
	return db
}

func TestSceneOStatsCountsReleaseOAtReleaseStudioCustom(t *testing.T) {
	db := openOStatsReleaseDBCustom(t)
	for studioID, want := range map[string]int{"1": 2, "2": 2} {
		id := studioID
		scope, args, err := sceneOStatsScopeCustom(&id, nil, nil)
		require.NoError(t, err)
		var count int
		require.NoError(t, db.QueryRow("SELECT COUNT(*) FROM "+sqlite.SceneOEventsSQLCustom()+" od WHERE 1 = 1"+scope, args...).Scan(&count))
		require.Equal(t, want, count, "studio %s", studioID)
	}
	var total int
	require.NoError(t, db.QueryRow("SELECT COUNT(*) FROM "+sqlite.SceneOEventsSQLCustom()+" od").Scan(&total))
	require.Equal(t, 4, total)
}

func TestSceneOCountsByPerformerUsesOwnerCastCustom(t *testing.T) {
	db := openOStatsReleaseDBCustom(t)
	scope, args, err := sceneOStatsScopeCustom(nil, nil, nil)
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
	require.ElementsMatch(t, []string{"Uno:2", "Dos:2"}, got)
}

func TestSceneOEventOrdinalsNumberTheSceneClusterCustom(t *testing.T) {
	db := openOStatsReleaseDBCustom(t)
	rows, err := db.Query(sceneOEventOrdinalsQuery("?"), 1)
	require.NoError(t, err)
	defer rows.Close()
	got := map[int64]int{}
	for rows.Next() {
		var sceneID int
		var eventID int64
		var ordinal int
		require.NoError(t, rows.Scan(&sceneID, &eventID, &ordinal))
		got[eventID] = ordinal
	}
	require.NoError(t, rows.Err())
	// Release O's have negated IDs and number in date order with the scene's.
	require.Equal(t, map[int64]int{1: 1, -1: 2, 2: 3, -2: 4}, got)
}

func TestSceneOEventAssociatedTagsUseOwnerMarkersCustom(t *testing.T) {
	db := openOStatsReleaseDBCustom(t)
	rows, err := db.Query(sceneOEventAssociatedTagsQuery("?, ?", false), 1, -1, 1, -1)
	require.NoError(t, err)
	defer rows.Close()
	got := map[int64]string{}
	for rows.Next() {
		var oID int64
		var markerID, isOrgasm, tagID int
		var tagName string
		require.NoError(t, rows.Scan(&oID, &markerID, &isOrgasm, &tagID, &tagName))
		got[oID] = tagName
	}
	require.NoError(t, rows.Err())
	require.Equal(t, map[int64]string{1: "Kiss", -1: "Ride"}, got)
}

func TestSceneOEventReleaseRowIDCustom(t *testing.T) {
	require.Equal(t, 0, sceneOEventReleaseRowIDCustom("12"))
	require.Equal(t, 7, sceneOEventReleaseRowIDCustom("-7"))
	require.Equal(t, 0, sceneOEventReleaseRowIDCustom("x"))
}
