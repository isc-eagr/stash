//go:build integration
// +build integration

package sqlite_test

import (
	"context"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestSceneMarkerTagAncestorsIncludeAllHierarchyLevelsCustom(t *testing.T) {
	runWithRollbackTxn(t, "scene marker tag ancestors include all hierarchy levels", func(t *testing.T, ctx context.Context) {
		markerID := markerIDs[markerIdxWithTag]
		marker, err := db.SceneMarker.Find(ctx, markerID)
		require.NoError(t, err)

		partial := models.NewSceneMarkerPartial()
		partial.PrimaryTagID = models.NewOptionalInt(tagIDs[tagIdxWithGrandParent])
		_, err = db.SceneMarker.UpdatePartial(ctx, markerID, partial)
		require.NoError(t, err)

		ancestors, err := db.SceneMarker.FindTagAncestorIDsBySceneIDCustom(ctx, marker.SceneID)
		require.NoError(t, err)
		require.ElementsMatch(t, []int{
			tagIDs[tagIdxWithParentAndChild],
			tagIDs[tagIdxWithGrandChild],
		}, ancestors[tagIDs[tagIdxWithGrandParent]])
	})
}
