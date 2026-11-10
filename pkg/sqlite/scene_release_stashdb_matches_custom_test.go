package sqlite

import (
	"context"
	"testing"

	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"

	"github.com/stashapp/stash/pkg/models"
)

func TestReleaseStashDBMatchesCustom(t *testing.T) {
	const endpoint = "https://stashdb.org/graphql"
	db, err := sqlx.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	defer db.Close()
	db.SetMaxOpenConns(1)
	_, err = db.Exec(`
CREATE TABLE scenes(id INTEGER PRIMARY KEY);
CREATE TABLE scene_releases(id INTEGER PRIMARY KEY, scene_id INTEGER NOT NULL);
CREATE TABLE scene_stash_ids(scene_id INTEGER, endpoint TEXT, stash_id TEXT);
CREATE TABLE scene_release_stash_ids(release_id INTEGER, endpoint TEXT, stash_id TEXT, updated_at TEXT);
INSERT INTO scenes VALUES (5), (6);
INSERT INTO scene_releases VALUES (9, 5);
INSERT INTO scene_stash_ids VALUES (5, '` + endpoint + `', 'scene-a'), (6, 'https://other.example/graphql', 'other');
INSERT INTO scene_release_stash_ids VALUES (9, '` + endpoint + `', 'release-a', '2026-01-01');` +
		sceneStashDBMatchesSchemaCustom + sceneReleaseStashDBMatchesSchemaCustom + `
INSERT INTO scene_stashdb_matches VALUES (5, 4);
INSERT INTO scene_release_stashdb_matches VALUES (9, 7);`)
	require.NoError(t, err)
	tx, err := db.BeginTxx(context.Background(), nil)
	require.NoError(t, err)
	defer tx.Rollback()
	ctx := context.WithValue(context.Background(), txnKey, tx)
	scenes, releases := &SceneStore{}, &SceneReleaseStore{}

	// Releases refresh with their own link, listed after the parent scene.
	targets, err := scenes.FindStashDBMatchTargetsCustom(ctx, endpoint)
	require.NoError(t, err)
	releaseID, four, seven := 9, 4, 7
	require.Equal(t, []models.StashDBMatchTargetCustom{
		{SceneID: 5, StashID: "scene-a", Matches: &four},
		{SceneID: 5, ReleaseID: &releaseID, StashID: "release-a", Matches: &seven},
	}, targets)

	// Release report rows are stored by release and read under the parent scene.
	report := models.StashDBMatchesReportCustom{
		Endpoint: ptrStringCustom(endpoint),
		Changes: []models.StashDBMatchesChangeCustom{
			{SceneID: 5, Previous: &four, Current: 6},
			{SceneID: 5, ReleaseID: &releaseID, Previous: &seven, Current: 8},
		},
		Unsubmitted: []models.StashDBUnsubmittedSceneCustom{{SceneID: 5, ReleaseID: &releaseID, StashID: "release-a", Matches: 8}},
	}
	require.NoError(t, scenes.SaveStashDBMatchesReportCustom(ctx, report))
	loaded, err := scenes.GetStashDBMatchesReportCustom(ctx)
	require.NoError(t, err)
	require.Equal(t, report.Changes, loaded.Changes)
	require.Equal(t, report.Unsubmitted, loaded.Unsubmitted)

	// Keeping the link keeps the count; replacing it resets to 0 like scenes.
	before := []models.StashID{{Endpoint: endpoint, StashID: "release-a"}}
	require.NoError(t, resetReleaseStashDBMatchesCustom(ctx, 9, before, before))
	got, err := releases.GetStashDBMatchesCustom(ctx, 9)
	require.NoError(t, err)
	require.Equal(t, 7, *got)
	require.NoError(t, resetReleaseStashDBMatchesCustom(ctx, 9, before, []models.StashID{{Endpoint: endpoint, StashID: "release-b"}}))
	got, err = releases.GetStashDBMatchesCustom(ctx, 9)
	require.NoError(t, err)
	require.Equal(t, 0, *got)

	// Conversions carry the count with the Stash IDs in both directions.
	_, err = tx.Exec(`INSERT INTO scene_releases VALUES (10, 6); INSERT INTO scenes VALUES (11)`)
	require.NoError(t, err)
	require.NoError(t, copyStashDBMatchesCustom(ctx,
		`INSERT INTO scene_release_stashdb_matches(release_id,matches) SELECT ?,matches FROM scene_stashdb_matches WHERE scene_id = ?`, 10, 5))
	got, err = releases.GetStashDBMatchesCustom(ctx, 10)
	require.NoError(t, err)
	require.Equal(t, 4, *got)
	require.NoError(t, copyStashDBMatchesCustom(ctx,
		`INSERT INTO scene_stashdb_matches(scene_id,matches) SELECT ?,matches FROM scene_release_stashdb_matches WHERE release_id = ?`, 11, 10))
	got, err = scenes.GetStashDBMatchesCustom(ctx, 11)
	require.NoError(t, err)
	require.Equal(t, 4, *got)
}

func ptrStringCustom(s string) *string { return &s }
