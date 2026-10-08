//go:build integration

package sqlite_test

import (
	"context"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestSceneStashDBMatchesUpdatePathsCustom(t *testing.T) {
	for _, path := range []string{"full", "partial set", "partial remove"} {
		runWithRollbackTxn(t, path, func(t *testing.T, ctx context.Context) {
			qb := db.Scene
			link := models.StashID{Endpoint: "https://stashdb.org/graphql", StashID: "test"}
			s := &models.Scene{
				Title:    "StashDB matches reset",
				StashIDs: models.NewRelatedStashIDs([]models.StashID{link}),
			}
			require.NoError(t, qb.Create(ctx, s, nil))
			seven := 7
			require.NoError(t, qb.SetStashDBMatchesCustom(ctx, s.ID, &seven))
			// Full saves rewrite the links even when the ID is unchanged.
			require.NoError(t, qb.Update(ctx, s))
			got, err := qb.GetStashDBMatchesCustom(ctx, s.ID)
			require.NoError(t, err)
			require.Equal(t, &seven, got)

			switch path {
			case "full":
				s.StashIDs = models.NewRelatedStashIDs([]models.StashID{})
				require.NoError(t, qb.Update(ctx, s))
			case "partial set":
				_, err = qb.UpdatePartial(ctx, s.ID, models.ScenePartial{
					StashIDs: &models.UpdateStashIDs{Mode: models.RelationshipUpdateModeSet},
				})
				require.NoError(t, err)
			case "partial remove":
				_, err = qb.UpdatePartial(ctx, s.ID, models.ScenePartial{
					StashIDs: &models.UpdateStashIDs{Mode: models.RelationshipUpdateModeRemove, StashIDs: []models.StashID{link}},
				})
				require.NoError(t, err)
			}
			got, err = qb.GetStashDBMatchesCustom(ctx, s.ID)
			require.NoError(t, err)
			require.NotNil(t, got)
			require.Zero(t, *got)
		})
	}
}
