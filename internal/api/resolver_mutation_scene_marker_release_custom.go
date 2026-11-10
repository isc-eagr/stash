package api

// CUSTOM: release-owned markers reach the generic marker mutations from the
// Markers page. They have no scene_id, so the scene-only steps are skipped and
// the owning release's advisor is recalculated instead.

import (
	"context"
	"fmt"

	"github.com/stashapp/stash/pkg/models"
)

// guardReleaseMarkerSceneCustom keeps a release marker with its release. A
// scene_id equal to the release's parent is a no-op, as the scene form sends it.
func (r *mutationResolver) guardReleaseMarkerSceneCustom(ctx context.Context, marker *models.SceneMarker, partial *models.SceneMarkerPartial) error {
	if marker.ReleaseID == nil || !partial.SceneID.Set {
		return nil
	}
	release, err := r.repository.SceneRelease.Find(ctx, *marker.ReleaseID)
	if err != nil {
		return err
	}
	if release == nil || partial.SceneID.Value != release.SceneID {
		return fmt.Errorf("marker %d belongs to release %d and cannot move to scene %d", marker.ID, *marker.ReleaseID, partial.SceneID.Value)
	}
	partial.SceneID.Set = false
	return nil
}

func (r *mutationResolver) recalculateMarkerReleasesCustom(ctx context.Context, markers []*models.SceneMarker) error {
	seen := make(map[int]bool)
	for _, marker := range markers {
		if marker == nil || marker.ReleaseID == nil || seen[*marker.ReleaseID] {
			continue
		}
		seen[*marker.ReleaseID] = true
		if err := r.recalculateReleaseAdvisorsCustom(ctx, *marker.ReleaseID); err != nil {
			return err
		}
	}
	return nil
}
