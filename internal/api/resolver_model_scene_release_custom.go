package api

import (
	"context"

	"github.com/stashapp/stash/internal/api/loaders"
	"github.com/stashapp/stash/internal/api/urlbuilders"
	"github.com/stashapp/stash/internal/manager"
	"github.com/stashapp/stash/pkg/models"
)

func (r *sceneReleaseResolver) Scene(ctx context.Context, obj *models.SceneRelease) (*models.Scene, error) {
	return loaders.From(ctx).SceneByID.Load(obj.SceneID)
}

func (r *sceneReleaseResolver) Date(ctx context.Context, obj *models.SceneRelease) (*string, error) {
	if obj.Date != nil {
		result := obj.Date.String()
		return &result, nil
	}
	return nil, nil
}

func (r *sceneReleaseResolver) Studio(ctx context.Context, obj *models.SceneRelease) (*models.Studio, error) {
	if obj.StudioID == nil {
		return nil, nil
	}

	return loaders.From(ctx).StudioByID.Load(*obj.StudioID)
}

func (r *sceneReleaseResolver) Paths(ctx context.Context, obj *models.SceneRelease) (*SceneReleasePaths, error) {
	baseURL, _ := ctx.Value(BaseURLCtxKey).(string)
	builder := urlbuilders.NewSceneReleaseURLBuilder(baseURL, obj.ID)

	screenshotPath := builder.GetScreenshotURL()

	return &SceneReleasePaths{
		Screenshot: &screenshotPath,
	}, nil
}

func (r *sceneReleaseResolver) Files(ctx context.Context, obj *models.SceneRelease) (ret []*VideoFile, err error) {
	var fileIDs []models.FileID
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		fileIDs, err = r.repository.SceneRelease.GetFileIDs(ctx, obj.ID)
		return err
	}); err != nil {
		return nil, err
	}

	files, errs := loaders.From(ctx).FileByID.LoadAll(fileIDs)
	if err := firstError(errs); err != nil {
		return nil, err
	}

	ret = make([]*VideoFile, len(files))
	for i, f := range files {
		vf, err := convertVideoFile(f)
		if err != nil {
			return nil, err
		}
		ret[i] = &VideoFile{
			VideoFile: vf,
		}
	}

	return ret, nil
}

func (r *sceneReleaseResolver) Galleries(ctx context.Context, obj *models.SceneRelease) (ret []*models.Gallery, err error) {
	if !obj.GalleryIDs.Loaded() {
		if err := r.withReadTxn(ctx, func(ctx context.Context) error {
			return obj.LoadGalleryIDs(ctx, r.repository.SceneRelease)
		}); err != nil {
			return nil, err
		}
	}

	galleries, errors := loaders.From(ctx).GalleryByID.LoadAll(obj.GalleryIDs.List())
	return galleries, firstError(errors)
}

func (r *sceneReleaseResolver) Streams(ctx context.Context, obj *models.SceneRelease) ([]*manager.SceneStreamEndpoint, error) {
	// Get the primary file for the release
	var primaryFile *models.VideoFile
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		files, err := r.repository.SceneRelease.GetFiles(ctx, obj.ID)
		if err != nil {
			return err
		}
		if len(files) > 0 {
			primaryFile = files[0]
		}
		return nil
	}); err != nil {
		return nil, err
	}

	if primaryFile == nil {
		return nil, nil
	}

	config := manager.GetInstance().Config
	baseURL, _ := ctx.Value(BaseURLCtxKey).(string)
	builder := urlbuilders.NewSceneReleaseURLBuilder(baseURL, obj.ID)
	apiKey := config.GetAPIKey()

	streamURL := builder.GetStreamURL(apiKey)

	return manager.GetReleaseStreamPaths(primaryFile, streamURL, config.GetMaxStreamingTranscodeSize())
}
