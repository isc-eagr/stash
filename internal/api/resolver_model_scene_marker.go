package api

import (
	"context"

	"github.com/stashapp/stash/internal/api/loaders" // CUSTOM
	"github.com/stashapp/stash/internal/api/urlbuilders"
	"github.com/stashapp/stash/pkg/models"
)

func (r *sceneMarkerResolver) Scene(ctx context.Context, obj *models.SceneMarker) (ret *models.Scene, err error) {
	return loaders.From(ctx).SceneByID.Load(obj.SceneID) // CUSTOM: request-batched
}

func (r *sceneMarkerResolver) PrimaryTag(ctx context.Context, obj *models.SceneMarker) (ret *models.Tag, err error) {
	return loaders.From(ctx).TagByID.Load(obj.PrimaryTagID) // CUSTOM: request-batched
}

func (r *sceneMarkerResolver) Tags(ctx context.Context, obj *models.SceneMarker) (ret []*models.Tag, err error) {
	return r.sceneMarkerTagsCustom(ctx, obj) // CUSTOM: request-batched
}

func (r *sceneMarkerResolver) Stream(ctx context.Context, obj *models.SceneMarker) (string, error) {
	baseURL, _ := ctx.Value(BaseURLCtxKey).(string)
	return urlbuilders.NewSceneMarkerURLBuilder(baseURL, obj).GetStreamURL(), nil
}

func (r *sceneMarkerResolver) Preview(ctx context.Context, obj *models.SceneMarker) (string, error) {
	baseURL, _ := ctx.Value(BaseURLCtxKey).(string)
	return urlbuilders.NewSceneMarkerURLBuilder(baseURL, obj).GetPreviewURL(), nil
}

func (r *sceneMarkerResolver) Screenshot(ctx context.Context, obj *models.SceneMarker) (string, error) {
	baseURL, _ := ctx.Value(BaseURLCtxKey).(string)
	return urlbuilders.NewSceneMarkerURLBuilder(baseURL, obj).GetScreenshotURL(), nil
}
