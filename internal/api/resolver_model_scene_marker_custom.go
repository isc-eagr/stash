package api

// CUSTOM: Custom SceneMarker resolver methods for top/bottom performer support.

import (
	"context"

	"github.com/stashapp/stash/pkg/models"
)

func (r *sceneMarkerResolver) TopPerformers(ctx context.Context, obj *models.SceneMarker) (ret []*models.Performer, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.Performer.FindBySceneMarkerIDWithRole(ctx, obj.ID, "top")
		return err
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

func (r *sceneMarkerResolver) BottomPerformers(ctx context.Context, obj *models.SceneMarker) (ret []*models.Performer, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.Performer.FindBySceneMarkerIDWithRole(ctx, obj.ID, "bottom")
		return err
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

// Performers returns all performers (tops + bottoms) for backward compatibility
func (r *sceneMarkerResolver) Performers(ctx context.Context, obj *models.SceneMarker) (ret []*models.Performer, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.Performer.FindBySceneMarkerID(ctx, obj.ID)
		return err
	}); err != nil {
		return nil, err
	}
	return ret, nil
}
