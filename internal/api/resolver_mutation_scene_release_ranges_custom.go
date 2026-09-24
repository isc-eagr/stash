package api

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/stashapp/stash/pkg/models"
)

func (r *mutationResolver) SceneReleaseNegativeMarkerSave(ctx context.Context, input SceneReleaseNegativeMarkerInput) (*models.SceneNegativeMarker, error) {
	releaseID, err := strconv.Atoi(input.ReleaseID)
	if err != nil {
		return nil, err
	}
	markerID := 0
	if input.ID != nil {
		markerID, err = strconv.Atoi(*input.ID)
		if err != nil {
			return nil, err
		}
	}
	if !validReleaseRangeCustom(input.StartSeconds, input.EndSeconds) {
		return nil, fmt.Errorf("%w: invalid release skip range", ErrInput)
	}
	marker := &models.SceneNegativeMarker{ID: markerID, Name: strings.TrimSpace(input.Name), StartSeconds: input.StartSeconds, EndSeconds: input.EndSeconds}
	var parentSceneID int
	err = r.withTxn(ctx, func(ctx context.Context) error {
		release, err := r.repository.SceneRelease.Find(ctx, releaseID)
		if err != nil {
			return err
		}
		if release == nil {
			return fmt.Errorf("release %d not found", releaseID)
		}
		parentSceneID = release.SceneID
		return r.repository.SceneRelease.SaveNegativeMarkerCustom(ctx, releaseID, marker)
	})
	marker.SceneID = parentSceneID
	return marker, err
}

func validReleaseRangeCustom(start, end float64) bool {
	return !math.IsNaN(start) && !math.IsInf(start, 0) && !math.IsNaN(end) && !math.IsInf(end, 0) && start >= 0 && end > start
}

func (r *mutationResolver) SceneReleaseNegativeMarkerDestroy(ctx context.Context, releaseIDText, markerIDText string) (bool, error) {
	releaseID, err := strconv.Atoi(releaseIDText)
	if err != nil {
		return false, err
	}
	markerID, err := strconv.Atoi(markerIDText)
	if err != nil {
		return false, err
	}
	err = r.withTxn(ctx, func(ctx context.Context) error {
		return r.repository.SceneRelease.DeleteNegativeMarkerCustom(ctx, releaseID, markerID)
	})
	return err == nil, err
}

func (r *mutationResolver) SceneReleaseLoopPresetSave(ctx context.Context, input SceneReleaseLoopPresetInput) (*MultiSegmentLoopPreset, error) {
	releaseID, err := strconv.Atoi(input.ReleaseID)
	if err != nil {
		return nil, err
	}
	name := strings.TrimSpace(input.Name)
	if name == "" || len(input.Segments) == 0 {
		return nil, fmt.Errorf("%w: loop preset needs a name and segments", ErrInput)
	}
	segments := make([]models.SceneLoopSegment, len(input.Segments))
	for i, segment := range input.Segments {
		if segment == nil || !validReleaseRangeCustom(segment.Start, segment.End) {
			return nil, fmt.Errorf("%w: invalid loop segment", ErrInput)
		}
		segments[i] = models.SceneLoopSegment{Start: segment.Start, End: segment.End}
	}
	preset := &models.SceneLoopPreset{Name: name, Enabled: input.Enabled, CurrentSegmentIndex: clampSegmentIndex(input.CurrentSegmentIndex, len(segments)), Segments: segments}
	var parentSceneID int
	err = r.withTxn(ctx, func(ctx context.Context) error {
		release, err := r.repository.SceneRelease.Find(ctx, releaseID)
		if err != nil {
			return err
		}
		if release == nil {
			return fmt.Errorf("release %d not found", releaseID)
		}
		parentSceneID = release.SceneID
		return r.repository.SceneRelease.SaveLoopPresetCustom(ctx, releaseID, preset)
	})
	if err != nil {
		return nil, err
	}
	preset.SceneID = parentSceneID
	return toAPIMultiSegmentLoopPreset(preset), nil
}

func (r *mutationResolver) SceneReleaseLoopPresetDestroy(ctx context.Context, releaseIDText, name string) (bool, error) {
	releaseID, err := strconv.Atoi(releaseIDText)
	if err != nil {
		return false, err
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return false, fmt.Errorf("%w: name cannot be empty", ErrInput)
	}
	err = r.withTxn(ctx, func(ctx context.Context) error {
		return r.repository.SceneRelease.DeleteLoopPresetCustom(ctx, releaseID, name)
	})
	return err == nil, err
}
