package api

import (
	"context"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/scene"
)

// SceneMarkerDuration resolves the summed timed-marker length for a tag. // CUSTOM
func (r *tagResolver) SceneMarkerDuration(ctx context.Context, obj *models.Tag, depth *int) (ret float64, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.MarkerDurationByTagID(ctx, r.repository.SceneMarker, obj.ID, depth)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}
