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

func TestSceneMarkerSharedIdentityAcrossNonOverlappingGroupsCustom(t *testing.T) {
	runWithRollbackTxn(t, "same vato gives and receives the same activity", func(t *testing.T, ctx context.Context) {
		ensureSceneMarkerPerformersTable(t, ctx)
		sceneID := sceneIDs[sceneIdxWithMarkers]
		first, second := markerIDs[markerIdxWithTag], markerIDs[markerIdxWithSceneTag]
		p1, p2 := performerIDs[performerIdxWithScene], performerIDs[performerIdx1WithScene]
		tagID, otherTagID := tagIDs[tagIdxWithMarkers], tagIDs[tagIdx2WithMarkers]
		_, err := sqlite.DBWrapper.Exec(ctx, `DELETE FROM scene_marker_performers WHERE scene_marker_id IN (SELECT id FROM scene_markers WHERE scene_id = ?)`, sceneID)
		require.NoError(t, err)
		clearMarkerSecondaryTags(t, ctx, first)
		clearMarkerSecondaryTags(t, ctx, second)
		setMarkerRange(t, ctx, first, 60, 120)
		setMarkerRange(t, ctx, second, 200, 260)
		_, err = sqlite.DBWrapper.Exec(ctx, `UPDATE scene_markers SET primary_tag_id = ? WHERE id IN (?, ?)`, tagID, first, second)
		require.NoError(t, err)
		require.NoError(t, db.SceneMarker.UpdateTopPerformers(ctx, first, []int{p1}))
		require.NoError(t, db.SceneMarker.UpdateBottomPerformers(ctx, second, []int{p2}))

		id, mode := "unnamed-A", "OR"
		filter := &models.SceneFilterType{SceneMarkerTags: &models.SceneMarkerTagsCriterionInput{
			Modifier: models.CriterionModifierEquals,
			GroupsExtended: []models.SceneMarkerTagGroupInput{
				{TagIDs: []string{strconv.Itoa(tagID)}, PerformerMode: &mode, TopUnnamedPerformers: []models.UnnamedPerformerCriterionInput{{ID: &id}}},
				{TagIDs: []string{strconv.Itoa(tagID)}, PerformerMode: &mode, BottomUnnamedPerformers: []models.UnnamedPerformerCriterionInput{{ID: &id}}},
			},
		}}
		check := func(want bool, message string) {
			t.Helper()
			result, err := db.Scene.Query(ctx, models.SceneQueryOptions{SceneFilter: filter})
			require.NoError(t, err)
			if want {
				require.Contains(t, result.IDs, sceneID, message)
			} else {
				require.NotContains(t, result.IDs, sceneID, message)
			}
		}
		check(false, "different people giving and receiving must not satisfy the same unnamed ID")
		require.NoError(t, db.SceneMarker.UpdateBottomPerformers(ctx, first, []int{p1}))
		check(false, "one self-role marker cannot satisfy two marker configurations")
		require.NoError(t, db.SceneMarker.UpdateBottomPerformers(ctx, first, nil))
		require.NoError(t, db.SceneMarker.UpdateBottomPerformers(ctx, second, []int{p1}))
		check(true, "the same vato in opposite roles on disjoint markers must match")

		_, err = sqlite.DBWrapper.Exec(ctx, `UPDATE scene_markers SET primary_tag_id = ? WHERE id = ?`, otherTagID, second)
		require.NoError(t, err)
		check(false, "the receiving marker must also match its own requested tag")
		filter.SceneMarkerTags.GroupsExtended[1].TagIDs = nil
		check(true, "an unrestricted second tag intentionally permits another activity")
		filter.SceneMarkerTags.GroupsExtended[1].TagIDs = []string{strconv.Itoa(tagID)}
		_, err = sqlite.DBWrapper.Exec(ctx, `UPDATE scene_markers SET primary_tag_id = ? WHERE id = ?`, tagID, second)
		require.NoError(t, err)

		// Use different tags for the OR/AND cases so one marker with both roles
		// cannot independently satisfy both configurations.
		filter.SceneMarkerTags.GroupsExtended[1].TagIDs = []string{strconv.Itoa(otherTagID)}
		_, err = sqlite.DBWrapper.Exec(ctx, `UPDATE scene_markers SET primary_tag_id = ? WHERE id = ?`, otherTagID, second)
		require.NoError(t, err)
		filter.SceneMarkerTags.GroupsExtended[0].BottomPerformerIDs = []string{strconv.Itoa(p2)}
		require.NoError(t, db.SceneMarker.UpdateTopPerformers(ctx, first, []int{p2}))
		require.NoError(t, db.SceneMarker.UpdateBottomPerformers(ctx, first, []int{p2}))
		check(true, "OR still allows a matching alternative role without requiring the unused shared slot")
		mode = "AND"
		check(false, "AND requires the shared top identity as well as the named bottom")
		require.NoError(t, db.SceneMarker.UpdateTopPerformers(ctx, first, []int{p1}))
		check(true, "AND matches when both role requirements are satisfied")

		secondID := "unnamed-B"
		filter.SceneMarkerTags.GroupsExtended[0].BottomPerformerIDs = nil
		filter.SceneMarkerTags.GroupsExtended[0].TopUnnamedPerformers = append(filter.SceneMarkerTags.GroupsExtended[0].TopUnnamedPerformers, models.UnnamedPerformerCriterionInput{ID: &secondID})
		filter.SceneMarkerTags.GroupsExtended[1].BottomUnnamedPerformers = append(filter.SceneMarkerTags.GroupsExtended[1].BottomUnnamedPerformers, models.UnnamedPerformerCriterionInput{ID: &secondID})
		check(false, "two shared identities cannot be satisfied by one person per role")
		require.NoError(t, db.SceneMarker.UpdateTopPerformers(ctx, first, []int{p1, p2}))
		require.NoError(t, db.SceneMarker.UpdateBottomPerformers(ctx, second, []int{p1, p2}))
		check(true, "multiple distinct shared identities can switch roles across markers")
	})

	runWithRollbackTxn(t, "different unnamed vatos exchange the same activity", func(t *testing.T, ctx context.Context) {
		ensureSceneMarkerPerformersTable(t, ctx)
		sceneID := sceneIDs[sceneIdxWithMarkers]
		first, second := markerIDs[markerIdxWithTag], markerIDs[markerIdxWithSceneTag]
		p1, p2 := performerIDs[performerIdxWithScene], performerIDs[performerIdx1WithScene]
		tagID := tagIDs[tagIdxWithMarkers]
		_, err := sqlite.DBWrapper.Exec(ctx, `DELETE FROM scene_marker_performers WHERE scene_marker_id IN (SELECT id FROM scene_markers WHERE scene_id = ?)`, sceneID)
		require.NoError(t, err)
		clearMarkerSecondaryTags(t, ctx, first)
		clearMarkerSecondaryTags(t, ctx, second)
		setMarkerRange(t, ctx, first, 60, 120)
		setMarkerRange(t, ctx, second, 200, 260)
		_, err = sqlite.DBWrapper.Exec(ctx, `UPDATE scene_markers SET primary_tag_id = ? WHERE id IN (?, ?)`, tagID, first, second)
		require.NoError(t, err)

		idA, idB, mode := "unnamed-A", "unnamed-B", "OR"
		filter := &models.SceneFilterType{SceneMarkerTags: &models.SceneMarkerTagsCriterionInput{
			Modifier: models.CriterionModifierEquals,
			GroupsExtended: []models.SceneMarkerTagGroupInput{
				{
					TagIDs:                  []string{strconv.Itoa(tagID)},
					PerformerMode:           &mode,
					TopUnnamedPerformers:    []models.UnnamedPerformerCriterionInput{{ID: &idA}},
					BottomUnnamedPerformers: []models.UnnamedPerformerCriterionInput{{ID: &idB}},
				},
				{
					TagIDs:                  []string{strconv.Itoa(tagID)},
					PerformerMode:           &mode,
					TopUnnamedPerformers:    []models.UnnamedPerformerCriterionInput{{ID: &idB}},
					BottomUnnamedPerformers: []models.UnnamedPerformerCriterionInput{{ID: &idA}},
				},
			},
		}}
		check := func(want bool, message string) {
			t.Helper()
			result, queryErr := db.Scene.Query(ctx, models.SceneQueryOptions{SceneFilter: filter})
			require.NoError(t, queryErr)
			if want {
				require.Contains(t, result.IDs, sceneID, message)
			} else {
				require.NotContains(t, result.IDs, sceneID, message)
			}
		}

		require.NoError(t, db.SceneMarker.UpdateTopPerformers(ctx, first, []int{p1}))
		require.NoError(t, db.SceneMarker.UpdateBottomPerformers(ctx, second, []int{p1}))
		check(false, "A and B cannot both bind to the one person who satisfies the OR branches")

		require.NoError(t, db.SceneMarker.UpdateBottomPerformers(ctx, first, []int{p2}))
		require.NoError(t, db.SceneMarker.UpdateTopPerformers(ctx, second, []int{p2}))
		check(true, "two different people exchanging roles across distinct markers must match")
	})
}
