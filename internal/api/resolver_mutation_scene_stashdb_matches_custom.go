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
		linked := false
		for _, id := range ids {
			if stashbox.IsStashDBEndpointCustom(id.Endpoint) {
				linked = true
				break
			}
		}
		if !linked {
			zero := 0
			matches = &zero
		}
	}
	return qb.SetStashDBMatchesCustom(ctx, sceneID, matches)
}
