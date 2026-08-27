//go:build integration
// +build integration

package sqlite_test

import (
	"context"
	"strconv"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/assert"
)

func TestMarkerEffectiveTagsUseFiftyPercentOverlapCustom(t *testing.T) {
	runWithRollbackTxn(t, "marker effective tags use directed fifty percent overlap", func(t *testing.T, ctx context.Context) {
		feetTagID := strconv.Itoa(tagIDs[tagIdxWithMarkers])
		dickTagID := strconv.Itoa(tagIDs[tagIdx2WithMarkers])
		recipientMarkerID := markerIDs[markerIdxWithTag]
		sourceMarkerID := markerIDs[markerIdxWithSceneTag]
		filter := &models.SceneMarkerFilterType{
			SceneMarkerTags: &models.SceneMarkerTagsCriterionInput{
				Modifier: models.CriterionModifierEquals,
				GroupsExtended: []models.SceneMarkerTagGroupInput{
					{TagIDs: []string{feetTagID, dickTagID}},
				},
			},
		}

		clearMarkerSecondaryTags(t, ctx, markerIDs[markerIdxWithDuration])
		setMarkerRange(t, ctx, recipientMarkerID, 0, 100)
		setMarkerRange(t, ctx, sourceMarkerID, 25, 75)

		ids := markersToIDs(queryMarkers(ctx, t, db.SceneMarker, filter, nil))
		assert.NotContains(t, ids, recipientMarkerID, "a wider marker should not inherit from a narrower marker covering half of it")
		assert.Contains(t, ids, sourceMarkerID, "the narrower marker should still inherit from the wider marker")

		setMarkerRange(t, ctx, recipientMarkerID, 0, 60)
		setMarkerRange(t, ctx, sourceMarkerID, 30, 150)

		ids = markersToIDs(queryMarkers(ctx, t, db.SceneMarker, filter, nil))
		assert.Contains(t, ids, recipientMarkerID, "exactly fifty percent overlap should inherit source tags")
		assert.NotContains(t, ids, sourceMarkerID, "the longer source should not inherit across the same shorter overlap")

		setMarkerRange(t, ctx, sourceMarkerID, 30.001, 150)

		ids = markersToIDs(queryMarkers(ctx, t, db.SceneMarker, filter, nil))
		assert.NotContains(t, ids, recipientMarkerID, "overlap below fifty percent should not inherit source tags")
	})
}

func TestMarkerTagsIncludesAllDoesNotUseOverlapCustom(t *testing.T) {
	runWithRollbackTxn(t, "ordinary marker tags remain direct only", func(t *testing.T, ctx context.Context) {
		feetTagID := strconv.Itoa(tagIDs[tagIdxWithMarkers])
		dickTagID := strconv.Itoa(tagIDs[tagIdx2WithMarkers])
		recipientMarkerID := markerIDs[markerIdxWithTag]
		sourceMarkerID := markerIDs[markerIdxWithSceneTag]

		setMarkerRange(t, ctx, recipientMarkerID, 0, 60)
		setMarkerRange(t, ctx, sourceMarkerID, 30, 150)

		ids := markersToIDs(queryMarkers(ctx, t, db.SceneMarker, &models.SceneMarkerFilterType{
			Tags: &models.HierarchicalMultiCriterionInput{
				Modifier: models.CriterionModifierIncludesAll,
				Value:    []string{feetTagID, dickTagID},
			},
		}, nil))

		assert.NotContains(t, ids, recipientMarkerID, "ordinary INCLUDES_ALL must not inherit tags from an overlapping marker")
		assert.NotContains(t, ids, sourceMarkerID, "ordinary INCLUDES_ALL must only inspect each marker's direct tags")
	})
}
