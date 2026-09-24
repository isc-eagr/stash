package api

import (
	"context"
	"fmt"
	"time"

	"github.com/stashapp/stash/internal/api/loaders"
	"github.com/stashapp/stash/internal/api/urlbuilders"
	"github.com/stashapp/stash/internal/manager"
	"github.com/stashapp/stash/pkg/models"
)

func (r *sceneReleaseResolver) Rating100(ctx context.Context, obj *models.SceneRelease) (*int, error) {
	var metadata models.SceneReleaseMetadataCustom
	err := r.withReadTxn(ctx, func(ctx context.Context) error {
		var err error
		metadata, err = r.repository.SceneRelease.GetMetadataCustom(ctx, obj.ID)
		return err
	})
	return metadata.Rating, err
}

func (r *sceneReleaseResolver) RatingScores(ctx context.Context, obj *models.SceneRelease) ([]*models.RatingScore, error) {
	var scores []*models.RatingScore
	err := r.withReadTxn(ctx, func(ctx context.Context) error {
		var err error
		scores, err = r.repository.RatingScore.FindByEntity(ctx, models.RatingEntityRelease, obj.ID)
		return err
	})
	return scores, err
}

func (r *sceneReleaseResolver) Organized(ctx context.Context, obj *models.SceneRelease) (bool, error) {
	var metadata models.SceneReleaseMetadataCustom
	err := r.withReadTxn(ctx, func(ctx context.Context) error {
		var err error
		metadata, err = r.repository.SceneRelease.GetMetadataCustom(ctx, obj.ID)
		return err
	})
	return metadata.Organized, err
}

func (r *sceneReleaseResolver) ResumeTime(ctx context.Context, obj *models.SceneRelease) (float64, error) {
	var metadata models.SceneReleaseMetadataCustom
	err := r.withReadTxn(ctx, func(ctx context.Context) error {
		var err error
		metadata, err = r.repository.SceneRelease.GetMetadataCustom(ctx, obj.ID)
		return err
	})
	return metadata.ResumeTime, err
}

func (r *sceneReleaseResolver) PlayDuration(ctx context.Context, obj *models.SceneRelease) (float64, error) {
	var metadata models.SceneReleaseMetadataCustom
	err := r.withReadTxn(ctx, func(ctx context.Context) error {
		var err error
		metadata, err = r.repository.SceneRelease.GetMetadataCustom(ctx, obj.ID)
		return err
	})
	return metadata.PlayDuration, err
}

func (r *sceneReleaseResolver) Urls(ctx context.Context, obj *models.SceneRelease) ([]string, error) {
	var urls []string
	err := r.withReadTxn(ctx, func(ctx context.Context) error {
		var err error
		urls, err = r.repository.SceneRelease.GetURLsCustom(ctx, obj.ID)
		return err
	})
	if len(urls) == 0 && obj.URL != "" {
		return []string{obj.URL}, err
	}
	return urls, err
}

func (r *sceneReleaseResolver) Performers(ctx context.Context, obj *models.SceneRelease) ([]*models.Performer, error) {
	var ids []int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		var err error
		ids, err = r.repository.SceneRelease.GetPerformerIDsCustom(ctx, obj.ID)
		return err
	}); err != nil {
		return nil, err
	}
	ret, errs := loaders.From(ctx).PerformerByID.LoadAll(ids)
	return ret, firstError(errs)
}

func (r *sceneReleaseResolver) Tags(ctx context.Context, obj *models.SceneRelease) ([]*models.Tag, error) {
	var ids []int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		var err error
		ids, err = r.repository.SceneRelease.GetTagIDsCustom(ctx, obj.ID)
		return err
	}); err != nil {
		return nil, err
	}
	ret, errs := loaders.From(ctx).TagByID.LoadAll(ids)
	return ret, firstError(errs)
}

func (r *sceneReleaseResolver) Groups(ctx context.Context, obj *models.SceneRelease) ([]*SceneGroup, error) {
	var groups []models.GroupsScenes
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		var err error
		groups, err = r.repository.SceneRelease.GetGroupsCustom(ctx, obj.ID)
		return err
	}); err != nil {
		return nil, err
	}
	ret := make([]*SceneGroup, len(groups))
	for i, item := range groups {
		group, err := loaders.From(ctx).GroupByID.Load(item.GroupID)
		if err != nil {
			return nil, err
		}
		ret[i] = &SceneGroup{Group: group, SceneIndex: item.SceneIndex}
	}
	return ret, nil
}

func (r *sceneReleaseResolver) StashIds(ctx context.Context, obj *models.SceneRelease) ([]*models.StashID, error) {
	var ids []models.StashID
	err := r.withReadTxn(ctx, func(ctx context.Context) error {
		var err error
		ids, err = r.repository.SceneRelease.GetStashIDsCustom(ctx, obj.ID)
		return err
	})
	return stashIDsSliceToPtrSlice(ids), err
}

func (r *sceneReleaseResolver) CustomFields(ctx context.Context, obj *models.SceneRelease) (map[string]interface{}, error) {
	var fields map[string]interface{}
	err := r.withReadTxn(ctx, func(ctx context.Context) error {
		var err error
		fields, err = r.repository.SceneRelease.GetCustomFieldsCustom(ctx, obj.ID)
		return err
	})
	if fields == nil {
		fields = map[string]interface{}{}
	}
	return fields, err
}

func (r *sceneReleaseResolver) PlayHistory(ctx context.Context, obj *models.SceneRelease) ([]*time.Time, error) {
	var dates []time.Time
	err := r.withReadTxn(ctx, func(ctx context.Context) error {
		var err error
		dates, err = r.repository.SceneRelease.GetViewHistoryCustom(ctx, obj.ID)
		return err
	})
	return releaseHistoryPointersCustom(dates), err
}

func (r *sceneReleaseResolver) OHistory(ctx context.Context, obj *models.SceneRelease) ([]*time.Time, error) {
	var dates []time.Time
	err := r.withReadTxn(ctx, func(ctx context.Context) error {
		var err error
		dates, err = r.repository.SceneRelease.GetOHistoryCustom(ctx, obj.ID)
		return err
	})
	return releaseHistoryPointersCustom(dates), err
}

func (r *sceneReleaseResolver) OTimestamps(ctx context.Context, obj *models.SceneRelease) (ret []*float64, err error) {
	err = r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.SceneRelease.GetOVideoTimestampsCustom(ctx, obj.ID)
		return err
	})
	if ret == nil {
		ret = []*float64{}
	}
	return ret, err
}

func (r *sceneReleaseResolver) SceneMarkers(ctx context.Context, obj *models.SceneRelease) (ret []*models.SceneMarker, err error) {
	err = r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.SceneRelease.GetMarkersCustom(ctx, obj.ID)
		return err
	})
	// CUSTOM: keep legacy scene_id consumers pointed at the parent scene.
	for _, marker := range ret {
		marker.SceneID = obj.SceneID
	}
	return ret, err
}

func (r *sceneReleaseResolver) NegativeMarkers(ctx context.Context, obj *models.SceneRelease) (ret []*models.SceneNegativeMarker, err error) {
	err = r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.SceneRelease.GetNegativeMarkersCustom(ctx, obj.ID)
		return err
	})
	for _, marker := range ret {
		marker.SceneID = obj.SceneID
	}
	return ret, err
}

func (r *sceneReleaseResolver) MultiSegmentLoopPresets(ctx context.Context, obj *models.SceneRelease) (ret []*MultiSegmentLoopPreset, err error) {
	var presets []*models.SceneLoopPreset
	err = r.withReadTxn(ctx, func(ctx context.Context) error {
		presets, err = r.repository.SceneRelease.GetLoopPresetsCustom(ctx, obj.ID)
		return err
	})
	if err != nil {
		return nil, err
	}
	ret = make([]*MultiSegmentLoopPreset, len(presets))
	for i, preset := range presets {
		preset.SceneID = obj.SceneID
		ret[i] = toAPIMultiSegmentLoopPreset(preset)
	}
	return ret, nil
}

func releaseHistoryPointersCustom(dates []time.Time) []*time.Time {
	ret := make([]*time.Time, len(dates))
	for i := range dates {
		ret[i] = &dates[i]
	}
	return ret
}

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
	paths := &SceneReleasePaths{
		Screenshot: &screenshotPath,
	}
	primaryFile, err := r.releasePrimaryFileCustom(ctx, obj.ID)
	if err != nil || primaryFile == nil {
		return paths, err
	}
	hash := releaseMarkerVideoHashCustom(primaryFile, manager.GetInstance().Config.GetVideoFileNamingAlgorithm())
	return releaseMediaPathsCustom(paths, baseURL, obj.ID, hash), nil
}

func releaseMediaPathsCustom(paths *SceneReleasePaths, baseURL string, releaseID int, hash string) *SceneReleasePaths {
	base := fmt.Sprintf("%s/scene-release/%d", baseURL, releaseID)
	paths.Preview = ptrStringCustom(base + "/preview")
	paths.Webp = ptrStringCustom(base + "/webp")
	paths.Funscript = ptrStringCustom(base + "/funscript")
	paths.InteractiveHeatmap = ptrStringCustom(base + "/interactive_heatmap")
	paths.Caption = ptrStringCustom(base + "/caption")
	if hash != "" {
		paths.Vtt = ptrStringCustom(base + "/" + hash + "_thumbs.vtt")
		paths.Sprite = ptrStringCustom(base + "/" + hash + "_sprite.jpg")
	}
	return paths
}

func ptrStringCustom(value string) *string { return &value }

func (r *sceneReleaseResolver) releasePrimaryFileCustom(ctx context.Context, releaseID int) (*models.VideoFile, error) {
	var primaryFile *models.VideoFile
	err := r.withReadTxn(ctx, func(ctx context.Context) error {
		files, err := r.repository.SceneRelease.GetFiles(ctx, releaseID)
		if err != nil {
			return err
		}
		if len(files) > 0 {
			primaryFile = files[0]
		}
		return nil
	})
	return primaryFile, err
}

func (r *sceneReleaseResolver) Captions(ctx context.Context, obj *models.SceneRelease) ([]*models.VideoCaption, error) {
	primaryFile, err := r.releasePrimaryFileCustom(ctx, obj.ID)
	if err != nil || primaryFile == nil {
		return []*models.VideoCaption{}, err
	}
	var captions []*models.VideoCaption
	err = r.withReadTxn(ctx, func(ctx context.Context) error {
		captions, err = r.repository.File.GetCaptions(ctx, primaryFile.Base().ID)
		return err
	})
	return captions, err
}

func (r *sceneReleaseResolver) Interactive(ctx context.Context, obj *models.SceneRelease) (bool, error) {
	primaryFile, err := r.releasePrimaryFileCustom(ctx, obj.ID)
	if err != nil || primaryFile == nil {
		return false, err
	}
	return primaryFile.Interactive, nil
}

func (r *sceneReleaseResolver) InteractiveSpeed(ctx context.Context, obj *models.SceneRelease) (*int, error) {
	primaryFile, err := r.releasePrimaryFileCustom(ctx, obj.ID)
	if err != nil || primaryFile == nil {
		return nil, err
	}
	return primaryFile.InteractiveSpeed, nil
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
