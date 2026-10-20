package sqlite

import (
	"context"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/require"
)

func newStashDBChangesDBCustom(t *testing.T) (context.Context, *sqlx.Tx) {
	t.Helper()
	db, err := sqlx.Open(sqlite3Driver, ":memory:?_foreign_keys=on")
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	_, err = db.Exec(`CREATE TABLE scenes(id INTEGER PRIMARY KEY);
CREATE TABLE performers(id INTEGER PRIMARY KEY);
CREATE TABLE scene_stash_ids(scene_id INTEGER, endpoint TEXT, stash_id TEXT, updated_at DATETIME);
CREATE TABLE performer_stash_ids(performer_id INTEGER, endpoint TEXT, stash_id TEXT, updated_at DATETIME);
INSERT INTO scenes VALUES (1), (2), (3);
INSERT INTO performers VALUES (1), (7);
INSERT INTO scene_stash_ids VALUES
  (2, 'https://stashdb.org/graphql', 'b', NULL),
  (1, 'https://stashdb.org/graphql', 'a2', NULL),
  (1, 'https://stashdb.org/graphql', 'a1', NULL),
  (1, 'https://stashdb.org/graphql', 'a1', NULL),
  (3, 'https://fansdb.cc/graphql', 'c', NULL);
INSERT INTO performer_stash_ids VALUES (7, 'https://stashdb.org/graphql', 'p7', NULL), (7, 'https://stashdb.org/graphql', 'p7', NULL);`)
	require.NoError(t, err)

	database := &Database{writeDB: db}
	require.NoError(t, database.ensureStashDBChangesSchemaCustom(context.Background()))
	require.NoError(t, database.ensureStashDBChangesSchemaCustom(context.Background()), "bootstrap must be idempotent")

	tx, err := db.BeginTxx(context.Background(), nil)
	require.NoError(t, err)
	t.Cleanup(func() { _ = tx.Rollback() })
	return context.WithValue(context.Background(), txnKey, tx), tx
}

func TestStashDBChangesStoreCustom(t *testing.T) {
	ctx, tx := newStashDBChangesDBCustom(t)
	store := StashDBChangesStoreCustom{}
	const endpoint = "https://stashdb.org/graphql"

	targets, err := store.Targets(ctx, models.StashDBChangesKindSceneCustom, endpoint)
	require.NoError(t, err)
	require.Equal(t, []models.StashDBChangesTargetCustom{
		{ID: 1, StashID: "a1"}, {ID: 1, StashID: "a2"}, {ID: 2, StashID: "b"},
	}, targets, "only this endpoint's links, ordered, each once")
	targets, err = store.Targets(ctx, models.StashDBChangesKindPerformerCustom, endpoint)
	require.NoError(t, err)
	require.Equal(t, []models.StashDBChangesTargetCustom{{ID: 7, StashID: "p7"}}, targets, "a link saved twice is checked once")
	_, err = store.Targets(ctx, "studio", endpoint)
	require.Error(t, err)

	run, err := store.GetRun(ctx, models.StashDBChangesKindSceneCustom)
	require.NoError(t, err)
	require.Nil(t, run, "no report before the first check")

	started := time.Date(2026, 10, 16, 14, 0, 0, 0, time.UTC)
	remote, local, merged := "New", "Old", "z"
	scenes := models.StashDBChangesRunCustom{
		Kind: models.StashDBChangesKindSceneCustom, StartedAt: started, FinishedAt: started.Add(time.Minute),
		Endpoint: endpoint, Checked: 3, Failed: 1, Cancelled: true,
		Changes: []models.StashDBChangeCustom{
			{ID: 2, StashID: "b", Status: models.StashDBChangeStatusMergedCustom, MergedIntoID: &merged},
			{ID: 1, StashID: "a1", Status: models.StashDBChangeStatusChangedCustom, Fields: []models.StashDBFieldChangeCustom{
				{Field: "title", Local: &local, Remote: &remote},
				{Field: "tags", Added: []string{"Kissing"}, Removed: []string{"Dropped"}},
			}},
			{ID: 3, StashID: "gone", Status: models.StashDBChangeStatusNotFoundCustom},
		},
	}
	require.NoError(t, store.SaveRun(ctx, scenes))
	_, err = tx.Exec(`DELETE FROM scenes WHERE id = 3`)
	require.NoError(t, err)

	got, err := store.GetRun(ctx, models.StashDBChangesKindSceneCustom)
	require.NoError(t, err)
	require.True(t, got.StartedAt.Equal(scenes.StartedAt))
	require.True(t, got.FinishedAt.Equal(scenes.FinishedAt))
	got.StartedAt, got.FinishedAt = scenes.StartedAt, scenes.FinishedAt
	want := scenes
	want.Changes = []models.StashDBChangeCustom{scenes.Changes[1], scenes.Changes[0]}
	require.Equal(t, &want, got, "ordered by entity; locally deleted scenes drop out")

	performers := models.StashDBChangesRunCustom{
		Kind: models.StashDBChangesKindPerformerCustom, StartedAt: started, FinishedAt: started,
		Endpoint: endpoint, Checked: 1,
		Changes: []models.StashDBChangeCustom{{ID: 7, StashID: "p7", Status: models.StashDBChangeStatusDeletedCustom}},
	}
	require.NoError(t, store.SaveRun(ctx, performers))

	// A new scene check replaces only the scene report.
	scenes.Changes, scenes.Cancelled = nil, false
	require.NoError(t, store.SaveRun(ctx, scenes))
	got, err = store.GetRun(ctx, models.StashDBChangesKindSceneCustom)
	require.NoError(t, err)
	require.False(t, got.Cancelled)
	require.Empty(t, got.Changes)
	got, err = store.GetRun(ctx, models.StashDBChangesKindPerformerCustom)
	require.NoError(t, err)
	require.Len(t, got.Changes, 1)
	require.Equal(t, models.StashDBChangeStatusDeletedCustom, got.Changes[0].Status)
	require.Nil(t, got.Changes[0].Fields)
}

func TestStashDBChangesStoreApplyCustom(t *testing.T) {
	ctx, _ := newStashDBChangesDBCustom(t)
	store := StashDBChangesStoreCustom{}
	const endpoint = "https://stashdb.org/graphql"
	scene := models.StashDBChangesKindSceneCustom

	change, gotEndpoint, err := store.GetChange(ctx, scene, 1, "a1")
	require.NoError(t, err)
	require.Nil(t, change, "no entry before the first check")
	require.Empty(t, gotEndpoint)

	remote, studioID, merged := "New", "s1", "z"
	tags := models.StashDBFieldChangeCustom{Field: "tags", Added: []string{"Kissing"}, AddedIDs: []string{"t1"}, Removed: []string{"Dropped"}}
	require.NoError(t, store.SaveRun(ctx, models.StashDBChangesRunCustom{
		Kind: scene, Endpoint: endpoint, Checked: 2,
		Changes: []models.StashDBChangeCustom{
			{ID: 1, StashID: "a1", Status: models.StashDBChangeStatusChangedCustom, Fields: []models.StashDBFieldChangeCustom{
				{Field: "studio", Remote: &remote, RemoteID: &studioID}, tags,
			}},
			{ID: 2, StashID: "b", Status: models.StashDBChangeStatusMergedCustom, MergedIntoID: &merged, Fields: []models.StashDBFieldChangeCustom{
				{Field: "title", Remote: &remote},
			}},
		},
	}))

	change, gotEndpoint, err = store.GetChange(ctx, scene, 1, "a1")
	require.NoError(t, err)
	require.Equal(t, endpoint, gotEndpoint)
	require.Equal(t, &models.StashDBChangeCustom{ID: 1, StashID: "a1", Status: models.StashDBChangeStatusChangedCustom, Fields: []models.StashDBFieldChangeCustom{
		{Field: "studio", Remote: &remote, RemoteID: &studioID}, tags,
	}}, change, "StashDB IDs round-trip for applying")
	change, _, err = store.GetChange(ctx, scene, 1, "other")
	require.NoError(t, err)
	require.Nil(t, change)
	change, _, err = store.GetChange(ctx, models.StashDBChangesKindPerformerCustom, 1, "a1")
	require.NoError(t, err)
	require.Nil(t, change, "kinds are separate")

	require.NoError(t, store.UpdateChangeFields(ctx, scene, models.StashDBChangeCustom{
		ID: 1, StashID: "a1", Status: models.StashDBChangeStatusChangedCustom, Fields: []models.StashDBFieldChangeCustom{tags},
	}))
	change, _, err = store.GetChange(ctx, scene, 1, "a1")
	require.NoError(t, err)
	require.Equal(t, []models.StashDBFieldChangeCustom{tags}, change.Fields)

	require.NoError(t, store.UpdateChangeFields(ctx, scene, models.StashDBChangeCustom{ID: 1, StashID: "a1", Status: models.StashDBChangeStatusChangedCustom}))
	require.NoError(t, store.UpdateChangeFields(ctx, scene, models.StashDBChangeCustom{ID: 2, StashID: "b", Status: models.StashDBChangeStatusMergedCustom}))
	run, err := store.GetRun(ctx, scene)
	require.NoError(t, err)
	require.Equal(t, []models.StashDBChangeCustom{
		{ID: 2, StashID: "b", Status: models.StashDBChangeStatusMergedCustom, MergedIntoID: &merged},
	}, run.Changes, "a fully applied changed entry drops out; a merged one stays listed")
	require.Equal(t, 2, run.Checked)
}
