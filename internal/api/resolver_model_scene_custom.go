package api

// CUSTOM: Custom Scene resolver methods.

import (
	"context"

	"github.com/stashapp/stash/internal/api/loaders"
	"github.com/stashapp/stash/pkg/models"
)

func (r *sceneResolver) EffectiveDate(ctx context.Context, obj *models.Scene) (*string, error) {
	// Start with scene's own date
	var minDate *models.Date
	if obj.Date != nil {
		minDate = obj.Date
	}

	// Load releases and find the minimum date
	var releases []*models.SceneRelease
	if err := r.withTxn(ctx, func(ctx context.Context) error {
		var err error
		releases, err = r.repository.SceneRelease.FindBySceneID(ctx, obj.ID)
		return err
	}); err != nil {
		return nil, err
	}

	for _, release := range releases {
		if release.Date != nil {
			if minDate == nil || release.Date.Time.Before(minDate.Time) {
				minDate = release.Date
			}
		}
	}

	if minDate != nil {
		result := minDate.String()
		return &result, nil
	}
	return nil, nil
}

// DirectGalleries returns only galleries directly associated with the scene (excluding release galleries)
func (r *sceneResolver) DirectGalleries(ctx context.Context, obj *models.Scene) (ret []*models.Gallery, err error) {
	if !obj.GalleryIDs.Loaded() {
		if err := r.withReadTxn(ctx, func(ctx context.Context) error {
			return obj.LoadGalleryIDs(ctx, r.repository.Scene)
		}); err != nil {
			return nil, err
		}
	}

	var errs []error
	ret, errs = loaders.From(ctx).GalleryByID.LoadAll(obj.GalleryIDs.List())
	return ret, firstError(errs)
}

func (r *sceneResolver) Releases(ctx context.Context, obj *models.Scene) ([]*models.SceneRelease, error) {
	var ret []*models.SceneRelease
	if err := r.withTxn(ctx, func(ctx context.Context) error {
		var err error
		ret, err = r.repository.SceneRelease.FindBySceneID(ctx, obj.ID)
		return err
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

// OTimestamps returns the list of video timestamps (in seconds) where O events
// were recorded via the player for this scene.
func (r *sceneResolver) OTimestamps(ctx context.Context, obj *models.Scene) ([]*float64, error) {
	var ret []*float64
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		var err error
		ret, err = r.repository.Scene.GetOVideoTimestamps(ctx, obj.ID)
		return err
	}); err != nil {
		return nil, err
	}
	if ret == nil {
		ret = []*float64{}
	}
	return ret, nil
}
