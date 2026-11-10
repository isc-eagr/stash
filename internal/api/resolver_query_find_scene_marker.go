package api

import (
	"context"

	"github.com/stashapp/stash/pkg/models"
	scenepkg "github.com/stashapp/stash/pkg/scene" // CUSTOM
)

func (r *queryResolver) FindSceneMarkers(ctx context.Context, sceneMarkerFilter *models.SceneMarkerFilterType, filter *models.FindFilterType, ids []string) (ret *FindSceneMarkersResultType, err error) {
	idInts, err := handleIDList(ids, "ids")
	if err != nil {
		return nil, err
	}

	fields := collectQueryFields(ctx) // CUSTOM: count-only callers do not need a full duration scan.
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		var sceneMarkers []*models.SceneMarker
		var err error
		var total int
		var duration float64 // CUSTOM

		if len(idInts) > 0 {
			sceneMarkers, err = r.repository.SceneMarker.FindMany(ctx, idInts)
			total = len(sceneMarkers)
			// CUSTOM: begin
			if fields.Has("duration") {
				duration = scenepkg.SumMarkerDurationsCustom(sceneMarkers)
			}
			// CUSTOM: end
		} else {
			sceneMarkers, total, err = r.repository.SceneMarker.Query(ctx, sceneMarkerFilter, filter)
			// CUSTOM: begin - filtered marker-duration aggregate for list metadata
			if err == nil && fields.Has("duration") {
				duration, err = scenepkg.MarkerDurationByQueryCustom(
					ctx,
					r.repository.SceneMarker,
					sceneMarkerFilter,
					filter,
				)
			}
			// CUSTOM: end
		}

		if err != nil {
			return err
		}

		ret = &FindSceneMarkersResultType{
			Count:        total,
			Duration:     duration, // CUSTOM
			SceneMarkers: sceneMarkers,
		}

		return nil
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

func (r *queryResolver) AllSceneMarkers(ctx context.Context) (ret []*models.SceneMarker, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.SceneMarker.All(ctx)
		return err
	}); err != nil {
		return nil, err
	}

	return ret, nil
}
