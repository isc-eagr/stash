//go:build integration

package sqlite_test

import (
	"context"
	"strconv"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/sqlite"
	"github.com/stretchr/testify/require"
)

// sceneMarkerConfigurationSceneCustom gives the four markers of the marker
// scene disjoint ranges, no performers, no secondary tags, and an unrelated
// primary tag.
func sceneMarkerConfigurationSceneCustom(t *testing.T, ctx context.Context) (int, [4]int) {
	t.Helper()
	ensureSceneMarkerPerformersTable(t, ctx)
	sceneID := sceneIDs[sceneIdxWithMarkers]
	markers := [4]int{markerIDs[markerIdxWithScene], markerIDs[markerIdxWithTag], markerIDs[markerIdxWithSceneTag], markerIDs[markerIdxWithDuration]}
	_, err := sqlite.DBWrapper.Exec(ctx, `DELETE FROM scene_marker_performers WHERE scene_marker_id IN (SELECT id FROM scene_markers WHERE scene_id = ?)`, sceneID)
	require.NoError(t, err)
	for i, id := range markers {
		clearMarkerSecondaryTags(t, ctx, id)
		setMarkerRange(t, ctx, id, float64(1000*i+10), float64(1000*i+100))
		setMarkerPrimaryTagCustom(t, ctx, id, tagIDs[tagIdxWithPrimaryMarkers])
	}
	return sceneID, markers
}

func setMarkerPrimaryTagCustom(t *testing.T, ctx context.Context, markerID int, tagID int) {
	t.Helper()
	_, err := sqlite.DBWrapper.Exec(ctx, `UPDATE scene_markers SET primary_tag_id = ? WHERE id = ?`, tagID, markerID)
	require.NoError(t, err)
}

func requireSceneMarkerMatchCustom(t *testing.T, ctx context.Context, sceneID int, input *models.SceneMarkerTagsCriterionInput, want bool, message string) {
	t.Helper()
	result, err := db.Scene.Query(ctx, models.SceneQueryOptions{SceneFilter: &models.SceneFilterType{SceneMarkerTags: input}})
	require.NoError(t, err)
	if want {
		require.Contains(t, result.IDs, sceneID, message)
	} else {
		require.NotContains(t, result.IDs, sceneID, message)
	}
}

func TestSceneMarkerConfigurationsCustom(t *testing.T) {
	tag, otherTag := tagIDs[tagIdxWithMarkers], tagIDs[tagIdx2WithMarkers]
	parent, child := tagIDs[tagIdxWithChildTag], tagIDs[tagIdxWithParentTag]
	p1, p2 := performerIDs[performerIdxWithScene], performerIDs[performerIdx1WithScene]
	or, and, allDepth := "OR", "AND", -1
	a, b := "unnamed-A", "unnamed-B"
	s := strconv.Itoa
	vato := func(id *string) []models.UnnamedPerformerCriterionInput {
		return []models.UnnamedPerformerCriterionInput{{ID: id}}
	}
	equals := func(groups ...models.SceneMarkerTagGroupInput) *models.SceneMarkerTagsCriterionInput {
		return &models.SceneMarkerTagsCriterionInput{Modifier: models.CriterionModifierEquals, GroupsExtended: groups}
	}

	runWithRollbackTxn(t, "different vatos with the same attributes are different people", func(t *testing.T, ctx context.Context) {
		sceneID, m := sceneMarkerConfigurationSceneCustom(t, ctx)
		setMarkerPrimaryTagCustom(t, ctx, m[0], tag)
		setMarkerPrimaryTagCustom(t, ctx, m[1], tag)
		require.NoError(t, db.SceneMarker.UpdateTopPerformers(ctx, m[0], []int{p1}))
		require.NoError(t, db.SceneMarker.UpdateTopPerformers(ctx, m[1], []int{p2}))
		input := equals(
			models.SceneMarkerTagGroupInput{TagIDs: []string{s(tag)}, PerformerMode: &and, TopUnnamedPerformers: vato(&a)},
			models.SceneMarkerTagGroupInput{TagIDs: []string{s(tag)}, PerformerMode: &and, TopUnnamedPerformers: vato(&b)},
		)
		requireSceneMarkerMatchCustom(t, ctx, sceneID, input, true, "two people each topping their own marker match A and B")
		require.NoError(t, db.SceneMarker.UpdateTopPerformers(ctx, m[1], []int{p1}))
		requireSceneMarkerMatchCustom(t, ctx, sceneID, input, false, "one person cannot be both A and B")
	})

	runWithRollbackTxn(t, "repeated vato configurations keep sub-tags", func(t *testing.T, ctx context.Context) {
		sceneID, m := sceneMarkerConfigurationSceneCustom(t, ctx)
		setMarkerPrimaryTagCustom(t, ctx, m[0], child)
		setMarkerPrimaryTagCustom(t, ctx, m[1], child)
		require.NoError(t, db.SceneMarker.UpdateTopPerformers(ctx, m[0], []int{p1}))
		require.NoError(t, db.SceneMarker.UpdateTopPerformers(ctx, m[1], []int{p1}))
		group := models.SceneMarkerTagGroupInput{TagIDs: []string{s(parent)}, Depth: &allDepth, PerformerMode: &and, TopUnnamedPerformers: vato(&a)}
		requireSceneMarkerMatchCustom(t, ctx, sceneID, equals(group, group), true, "the same vato on two sub-tag markers matches")
		requireSceneMarkerMatchCustom(t, ctx, sceneID, equals(group, group, group), false, "three configurations need three markers")
	})

	runWithRollbackTxn(t, "every configuration needs its own marker", func(t *testing.T, ctx context.Context) {
		sceneID, m := sceneMarkerConfigurationSceneCustom(t, ctx)
		setMarkerPrimaryTagCustom(t, ctx, m[0], tag)
		require.NoError(t, db.SceneMarker.UpdateTopPerformers(ctx, m[0], []int{p1}))
		input := equals(
			models.SceneMarkerTagGroupInput{TagIDs: []string{s(tag)}, PerformerMode: &and},
			models.SceneMarkerTagGroupInput{TagIDs: []string{s(tag)}, PerformerMode: &and, TopPerformerIDs: []string{s(p1)}},
		)
		requireSceneMarkerMatchCustom(t, ctx, sceneID, input, false, "one marker cannot satisfy two configurations")
		setMarkerPrimaryTagCustom(t, ctx, m[1], tag)
		requireSceneMarkerMatchCustom(t, ctx, sceneID, input, true, "a second marker satisfies the broader configuration")
	})

	runWithRollbackTxn(t, "empty configurations are ignored", func(t *testing.T, ctx context.Context) {
		sceneID, m := sceneMarkerConfigurationSceneCustom(t, ctx)
		setMarkerPrimaryTagCustom(t, ctx, m[0], tag)
		empty := models.SceneMarkerTagGroupInput{PerformerMode: &and}
		requireSceneMarkerMatchCustom(t, ctx, sceneID, &models.SceneMarkerTagsCriterionInput{
			Modifier:      models.CriterionModifierEquals,
			OverlapGroups: []models.SceneMarkerTagGroupInput{{TagIDs: []string{s(tag)}, PerformerMode: &and}, empty},
		}, true, "an empty overlap configuration does not block results")
		requireSceneMarkerMatchCustom(t, ctx, sceneID, equals(models.SceneMarkerTagGroupInput{TagIDs: []string{s(tag)}, PerformerMode: &and}, empty), true, "an empty configuration does not need its own marker")
	})

	runWithRollbackTxn(t, "unnamed and named vatos share role rules", func(t *testing.T, ctx context.Context) {
		sceneID, m := sceneMarkerConfigurationSceneCustom(t, ctx)
		setMarkerPrimaryTagCustom(t, ctx, m[0], tag)
		require.NoError(t, db.SceneMarker.UpdateBottomPerformers(ctx, m[0], []int{p1}))
		legacyEither := equals(models.SceneMarkerTagGroupInput{TagIDs: []string{s(tag)}, PerformerMode: &or, TopUnnamedPerformers: vato(&a), BottomUnnamedPerformers: vato(&a)})
		requireSceneMarkerMatchCustom(t, ctx, sceneID, legacyEither, true, "OR with a vato in both lists means either role, like a named vato")
		either := equals(models.SceneMarkerTagGroupInput{TagIDs: []string{s(tag)}, PerformerMode: &and, EitherUnnamedPerformers: vato(&a)})
		requireSceneMarkerMatchCustom(t, ctx, sceneID, either, true, "an either-role vato matches a bottom")
		both := equals(models.SceneMarkerTagGroupInput{TagIDs: []string{s(tag)}, PerformerMode: &and, TopUnnamedPerformers: vato(&a), BottomUnnamedPerformers: vato(&a)})
		requireSceneMarkerMatchCustom(t, ctx, sceneID, both, false, "AND with a vato in both lists means both roles")
		require.NoError(t, db.SceneMarker.UpdateTopPerformers(ctx, m[0], []int{p1}))
		requireSceneMarkerMatchCustom(t, ctx, sceneID, both, true, "the vato holds both roles")

		withNamed := equals(models.SceneMarkerTagGroupInput{TagIDs: []string{s(tag)}, PerformerMode: &and, TopPerformerIDs: []string{s(p1)}, EitherUnnamedPerformers: vato(&a)})
		requireSceneMarkerMatchCustom(t, ctx, sceneID, withNamed, false, "a vato is never the named vato")
		require.NoError(t, db.SceneMarker.UpdateBottomPerformers(ctx, m[0], []int{p2}))
		requireSceneMarkerMatchCustom(t, ctx, sceneID, withNamed, true, "another person fills the vato")
		require.NoError(t, db.SceneMarker.UpdateBottomPerformers(ctx, m[0], nil))
		setMarkerPrimaryTagCustom(t, ctx, m[1], otherTag)
		require.NoError(t, db.SceneMarker.UpdateTopPerformers(ctx, m[1], []int{p1}))
		acrossMarkers := equals(
			models.SceneMarkerTagGroupInput{TagIDs: []string{s(tag)}, PerformerMode: &and, TopPerformerIDs: []string{s(p1)}},
			models.SceneMarkerTagGroupInput{TagIDs: []string{s(otherTag)}, PerformerMode: &and, TopUnnamedPerformers: vato(&a)},
		)
		requireSceneMarkerMatchCustom(t, ctx, sceneID, acrossMarkers, false, "a vato in another configuration is not the named vato either")
	})
}
