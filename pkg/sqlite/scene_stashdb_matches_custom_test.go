package sqlite

import (
	"context"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/require"
)

func newStashDBMatchesDBCustom(t *testing.T) (context.Context, *sqlx.Tx) {
	t.Helper()
	db, err := sqlx.Open(sqlite3Driver, ":memory:?_foreign_keys=on")
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	_, err = db.Exec(`CREATE TABLE scenes(id INTEGER PRIMARY KEY, title TEXT);
CREATE TABLE scene_stash_ids(scene_id INTEGER, endpoint TEXT, stash_id TEXT, updated_at DATETIME);
INSERT INTO scenes VALUES (1, 'One'), (2, 'Two'), (3, 'Three'), (4, 'Four');`)
	require.NoError(t, err)

	database := &Database{writeDB: db}
	require.NoError(t, database.ensureSceneStashDBMatchesSchemaCustom(context.Background()))
	require.NoError(t, database.ensureSceneStashDBMatchesSchemaCustom(context.Background()), "bootstrap must be idempotent")

	tx, err := db.BeginTxx(context.Background(), nil)
	require.NoError(t, err)
	t.Cleanup(func() { _ = tx.Rollback() })
	return context.WithValue(context.Background(), txnKey, tx), tx
}

func TestSceneStashDBMatchesStoreCustom(t *testing.T) {
	ctx, tx := newStashDBMatchesDBCustom(t)
	qb := &SceneStore{}
	value := func(v int) *int { return &v }

	got, err := qb.GetStashDBMatchesCustom(ctx, 1)
	require.NoError(t, err)
	require.Nil(t, got, "unscraped scenes have no value")

	require.NoError(t, qb.SetStashDBMatchesCustom(ctx, 1, value(0)))
	got, err = qb.GetStashDBMatchesCustom(ctx, 1)
	require.NoError(t, err)
	require.Equal(t, 0, *got, "zero is a real value, not unset")

	require.NoError(t, qb.SetStashDBMatchesCustom(ctx, 1, value(7)))
	got, err = qb.GetStashDBMatchesCustom(ctx, 1)
	require.NoError(t, err)
	require.Equal(t, 7, *got)

	require.Error(t, qb.SetStashDBMatchesCustom(ctx, 1, value(-1)))

	require.NoError(t, qb.SetStashDBMatchesCustom(ctx, 1, nil))
	got, err = qb.GetStashDBMatchesCustom(ctx, 1)
	require.NoError(t, err)
	require.Nil(t, got)

	require.NoError(t, qb.SetStashDBMatchesCustom(ctx, 2, value(3)))
	_, err = tx.Exec(`DELETE FROM scenes WHERE id = 2`)
	require.NoError(t, err)
	var remaining int
	require.NoError(t, tx.Get(&remaining, `SELECT COUNT(*) FROM scene_stashdb_matches`))
	require.Zero(t, remaining, "deleting a scene removes its count")
}

func TestSceneStashDBMatchTargetsCustom(t *testing.T) {
	ctx, tx := newStashDBMatchesDBCustom(t)
	_, err := tx.Exec(`INSERT INTO scene_stash_ids(scene_id, endpoint, stash_id) VALUES
  (3, 'https://stashdb.org/graphql', 'c'),
  (1, 'https://stashdb.org/graphql', 'a'),
  (2, 'https://fansdb.cc/graphql', 'f');
INSERT INTO scene_stashdb_matches VALUES (1, 5), (2, 9);`)
	require.NoError(t, err)

	got, err := (&SceneStore{}).FindStashDBMatchTargetsCustom(ctx, "https://stashdb.org/graphql")
	require.NoError(t, err)
	five := 5
	require.Equal(t, []models.StashDBMatchTargetCustom{
		{SceneID: 1, StashID: "a", Matches: &five},
		{SceneID: 3, StashID: "c"},
	}, got, "only this endpoint's links, with nil for never-fetched counts")
}

func TestSceneStashDBMatchesResetOnIDRemovalCustom(t *testing.T) {
	stashID := models.StashID{Endpoint: "https://stashdb.org/graphql", StashID: "one"}
	otherID := models.StashID{Endpoint: "https://fansdb.cc/graphql", StashID: "other"}
	newID := models.StashID{Endpoint: stashID.Endpoint, StashID: "replacement"}
	aliasID := models.StashID{Endpoint: " https://API.StashDB.org/graphql ", StashID: "alias"}
	for _, tt := range []struct {
		name   string
		before []models.StashID
		ids    []models.StashID
		mode   models.RelationshipUpdateMode
		unset  bool
		want   *int
	}{
		{name: "set empty", before: []models.StashID{stashID}, mode: models.RelationshipUpdateModeSet, want: intPtrCustom(0)},
		{name: "remove", before: []models.StashID{stashID}, ids: []models.StashID{stashID}, mode: models.RelationshipUpdateModeRemove, want: intPtrCustom(0)},
		{name: "retain other box", before: []models.StashID{stashID, otherID}, ids: []models.StashID{otherID}, mode: models.RelationshipUpdateModeSet, want: intPtrCustom(0)},
		{name: "replace ID", before: []models.StashID{stashID}, ids: []models.StashID{newID}, mode: models.RelationshipUpdateModeSet, want: intPtrCustom(0)},
		{name: "retain StashDB", before: []models.StashID{stashID, otherID}, ids: []models.StashID{stashID}, mode: models.RelationshipUpdateModeSet, want: intPtrCustom(7)},
		{name: "remove other box", before: []models.StashID{stashID, otherID}, ids: []models.StashID{otherID}, mode: models.RelationshipUpdateModeRemove, want: intPtrCustom(7)},
		{name: "unchanged IDs", before: []models.StashID{stashID}, ids: []models.StashID{stashID}, mode: models.RelationshipUpdateModeSet, want: intPtrCustom(7)},
		{name: "remove nonexistent ID", before: []models.StashID{stashID}, ids: []models.StashID{newID}, mode: models.RelationshipUpdateModeRemove, want: intPtrCustom(7)},
		{name: "add other box", before: []models.StashID{stashID}, ids: []models.StashID{otherID}, mode: models.RelationshipUpdateModeAdd, want: intPtrCustom(7)},
		{name: "unset count becomes zero", before: []models.StashID{stashID}, mode: models.RelationshipUpdateModeSet, unset: true, want: intPtrCustom(0)},
		{name: "unscraped stays unset", mode: models.RelationshipUpdateModeSet, unset: true},
		{name: "StashDB endpoint variant", before: []models.StashID{aliasID}, mode: models.RelationshipUpdateModeSet, want: intPtrCustom(0)},
		{name: "other box only", before: []models.StashID{otherID}, mode: models.RelationshipUpdateModeSet, want: intPtrCustom(7)},
	} {
		t.Run(tt.name, func(t *testing.T) {
			ctx, _ := newStashDBMatchesDBCustom(t)
			qb := &SceneStore{}
			require.NoError(t, scenesStashIDsTableMgr.insertJoins(ctx, 1, tt.before))
			if !tt.unset {
				require.NoError(t, qb.SetStashDBMatchesCustom(ctx, 1, intPtrCustom(7)))
			}
			require.NoError(t, qb.updateStashIDsAndMatchesCustom(ctx, 1, tt.ids, tt.mode))
			got, err := qb.GetStashDBMatchesCustom(ctx, 1)
			require.NoError(t, err)
			require.Equal(t, tt.want, got)
		})
	}
}

func intPtrCustom(value int) *int { return &value }

func TestSceneStashDBMatchesResetOnAnonymiseCustom(t *testing.T) {
	ctx, tx := newStashDBMatchesDBCustom(t)
	_, err := tx.Exec(`INSERT INTO scene_stash_ids(scene_id, endpoint, stash_id) VALUES
  (1, 'https://stashdb.org/graphql', 'one'),
  (2, 'https://fansdb.cc/graphql', 'two'),
  (3, 'https://stashdb.org/graphql', 'three');
INSERT INTO scene_stashdb_matches VALUES (1, 7), (2, 9);`)
	require.NoError(t, err)
	require.NoError(t, deleteSceneStashIDsAndMatchesCustom(ctx))
	qb := &SceneStore{}
	for sceneID, want := range map[int]*int{1: intPtrCustom(0), 2: intPtrCustom(9), 3: intPtrCustom(0), 4: nil} {
		got, err := qb.GetStashDBMatchesCustom(ctx, sceneID)
		require.NoError(t, err)
		require.Equal(t, want, got)
	}
	var remaining int
	require.NoError(t, tx.Get(&remaining, `SELECT COUNT(*) FROM scene_stash_ids`))
	require.Zero(t, remaining)
}

func TestSceneStashDBMatchesFilterAndSortCustom(t *testing.T) {
	ctx, tx := newStashDBMatchesDBCustom(t)
	_, err := tx.Exec(`INSERT INTO scene_stashdb_matches VALUES (1, 5), (2, 0), (3, 12)`)
	require.NoError(t, err)

	all := -1
	readIDs := func(sceneFilter *models.SceneFilterType, sort string, direction models.SortDirectionEnum) []int {
		t.Helper()
		findFilter := &models.FindFilterType{PerPage: &all, Direction: &direction}
		if sort != "" {
			findFilter.Sort = &sort
		}
		query, err := (&SceneStore{}).makeQuery(ctx, sceneFilter, findFilter)
		require.NoError(t, err)
		var ids []int
		require.NoError(t, tx.Select(&ids, query.toSQL(true), query.allArgs()...))
		return ids
	}
	filter := func(modifier models.CriterionModifier, value int) *models.SceneFilterType {
		return &models.SceneFilterType{StashDBMatches: &models.IntCriterionInput{Value: value, Modifier: modifier}}
	}

	require.ElementsMatch(t, []int{1, 3}, readIDs(filter(models.CriterionModifierGreaterThan, 0), "", models.SortDirectionEnumAsc))
	require.ElementsMatch(t, []int{2}, readIDs(filter(models.CriterionModifierEquals, 0), "", models.SortDirectionEnumAsc))
	require.ElementsMatch(t, []int{4}, readIDs(filter(models.CriterionModifierIsNull, 0), "", models.SortDirectionEnumAsc))
	require.ElementsMatch(t, []int{1, 2, 3}, readIDs(filter(models.CriterionModifierNotNull, 0), "", models.SortDirectionEnumAsc))

	// Unscraped scene 4 stays last in both directions.
	require.Equal(t, []int{3, 1, 2, 4}, readIDs(nil, "stashdb_matches", models.SortDirectionEnumDesc))
	require.Equal(t, []int{2, 1, 3, 4}, readIDs(nil, "stashdb_matches", models.SortDirectionEnumAsc))
	require.Equal(t, []int{1, 3}, readIDs(filter(models.CriterionModifierGreaterThan, 0), "stashdb_matches", models.SortDirectionEnumAsc))
}

func TestSceneStashDBMatchesReportCustom(t *testing.T) {
	ctx, tx := newStashDBMatchesDBCustom(t)
	qb := &SceneStore{}

	got, err := qb.GetStashDBMatchesReportCustom(ctx)
	require.NoError(t, err)
	require.Nil(t, got, "no report before the first run")

	started := time.Date(2026, 10, 5, 14, 0, 0, 0, time.UTC)
	five := 5
	endpoint := "https://stashdb.org/graphql"
	first := models.StashDBMatchesReportCustom{
		StartedAt: started, FinishedAt: started.Add(time.Minute),
		Checked: 4, Changed: 2, Unchanged: 1, NotFound: 1,
		Endpoint: &endpoint,
		Changes: []models.StashDBMatchesChangeCustom{
			{SceneID: 1, Previous: &five, Current: 7},
			{SceneID: 2, Current: 3},
		},
		Unsubmitted: []models.StashDBUnsubmittedSceneCustom{
			{SceneID: 2, StashID: "two", Matches: 3},
			{SceneID: 3, StashID: "three", Matches: 0},
		},
	}
	require.NoError(t, qb.SaveStashDBMatchesReportCustom(ctx, first))
	got, err = qb.GetStashDBMatchesReportCustom(ctx)
	require.NoError(t, err)
	require.True(t, got.StartedAt.Equal(first.StartedAt) && got.FinishedAt.Equal(first.FinishedAt))
	got.StartedAt, got.FinishedAt = first.StartedAt, first.FinishedAt
	require.Equal(t, first, *got)

	_, err = tx.Exec(`DELETE FROM scenes WHERE id = 2`)
	require.NoError(t, err)
	got, err = qb.GetStashDBMatchesReportCustom(ctx)
	require.NoError(t, err)
	require.Len(t, got.Changes, 1, "changes for deleted scenes disappear")
	require.Equal(t, []models.StashDBUnsubmittedSceneCustom{{SceneID: 3, StashID: "three", Matches: 0}}, got.Unsubmitted, "deleted scenes disappear from submission checks too")

	second := models.StashDBMatchesReportCustom{StartedAt: started, FinishedAt: started, Checked: 1, Unchanged: 1, Cancelled: true}
	require.NoError(t, qb.SaveStashDBMatchesReportCustom(ctx, second))
	got, err = qb.GetStashDBMatchesReportCustom(ctx)
	require.NoError(t, err)
	require.True(t, got.Cancelled)
	require.Empty(t, got.Changes, "a new run replaces the previous changes")
	require.Nil(t, got.Endpoint, "older reports have no submission check endpoint")
	require.Empty(t, got.Unsubmitted, "a new run replaces the previous unsubmitted scenes")

	second.Endpoint = &endpoint
	require.NoError(t, qb.SaveStashDBMatchesReportCustom(ctx, second))
	got, err = qb.GetStashDBMatchesReportCustom(ctx)
	require.NoError(t, err)
	require.Equal(t, &endpoint, got.Endpoint, "an empty checked result differs from an older report")
	require.Empty(t, got.Unsubmitted)
}
