package api

import (
	"context"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/stashbox"
)

// A client may send the previous count while removing StashDB from stash_ids.
// Keep the storage reset authoritative, including when the count is null.
func setUpdatedSceneStashDBMatchesCustom(ctx context.Context, qb models.SceneReaderWriter, sceneID int, matches *int, stashIDsUpdated bool) error {
	if stashIDsUpdated {
		ids, err := qb.GetStashIDs(ctx, sceneID)
		if err != nil {
			return err
		}
		matches = stashDBMatchesForLinksCustom(ids, matches)
	}
	return qb.SetStashDBMatchesCustom(ctx, sceneID, matches)
}

// setUpdatedReleaseStashDBMatchesCustom applies the scene rule to a release.
func setUpdatedReleaseStashDBMatchesCustom(ctx context.Context, qb models.SceneReleaseReaderWriter, releaseID int, matches *int, stashIDsUpdated bool) error {
	if stashIDsUpdated {
		ids, err := qb.GetStashIDsCustom(ctx, releaseID)
		if err != nil {
			return err
		}
		matches = stashDBMatchesForLinksCustom(ids, matches)
	}
	return qb.SetStashDBMatchesCustom(ctx, releaseID, matches)
}

// stashDBMatchesForLinksCustom stores 0 when no StashDB link remains.
func stashDBMatchesForLinksCustom(ids []models.StashID, matches *int) *int {
	for _, id := range ids {
		if stashbox.IsStashDBEndpointCustom(id.Endpoint) {
			return matches
		}
	}
	zero := 0
	return &zero
}
