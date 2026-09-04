package api

// CUSTOM: Custom SceneMarker resolver methods for top/bottom performer support.

import (
	"context"
	"fmt"

	"github.com/stashapp/stash/internal/api/loaders"
	"github.com/stashapp/stash/pkg/models"
)

func (r *sceneMarkerResolver) TopPerformers(ctx context.Context, obj *models.SceneMarker) (ret []*models.Performer, err error) {
	return r.sceneMarkerPerformersCustom(ctx, obj, "top")
}

func (r *sceneMarkerResolver) BottomPerformers(ctx context.Context, obj *models.SceneMarker) (ret []*models.Performer, err error) {
	return r.sceneMarkerPerformersCustom(ctx, obj, "bottom")
}

// Performers returns all performers (tops + bottoms) for backward compatibility
func (r *sceneMarkerResolver) Performers(ctx context.Context, obj *models.SceneMarker) (ret []*models.Performer, err error) {
	return r.sceneMarkerPerformersCustom(ctx, obj, "")
}

func (r *sceneMarkerResolver) sceneMarkerTagsCustom(ctx context.Context, obj *models.SceneMarker) ([]*models.Tag, error) {
	relations, err := loaders.From(ctx).SceneMarkerRelations.Load(obj.ID)
	if err != nil {
		return nil, err
	}

	ret, errs := loaders.From(ctx).TagByID.LoadAll(relations.TagIDs)
	if err := firstSceneMarkerLoaderErrorCustom(errs); err != nil {
		return nil, err
	}
	return ret, nil
}

func (r *sceneMarkerResolver) sceneMarkerPerformersCustom(ctx context.Context, obj *models.SceneMarker, role string) ([]*models.Performer, error) {
	relations, err := loaders.From(ctx).SceneMarkerRelations.Load(obj.ID)
	if err != nil {
		return nil, err
	}

	seen := make(map[int]struct{})
	var ids []int
	for _, performer := range relations.Performers {
		if role != "" && performer.Role != role {
			continue
		}
		if _, found := seen[performer.PerformerID]; found {
			continue
		}
		seen[performer.PerformerID] = struct{}{}
		ids = append(ids, performer.PerformerID)
	}

	ret, errs := loaders.From(ctx).PerformerByID.LoadAll(ids)
	if err := firstSceneMarkerLoaderErrorCustom(errs); err != nil {
		return nil, err
	}
	return ret, nil
}

func firstSceneMarkerLoaderErrorCustom(errs []error) error {
	for _, err := range errs {
		if err != nil {
			return fmt.Errorf("loading scene marker relationship: %w", err)
		}
	}
	return nil
}
