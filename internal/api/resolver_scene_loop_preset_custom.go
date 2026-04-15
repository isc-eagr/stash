package api

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/stashapp/stash/pkg/models"
)

func normalizeSegments(segments []models.SceneLoopSegment) ([]models.SceneLoopSegment, error) {
	if len(segments) == 0 {
		return nil, fmt.Errorf("%w: at least one segment is required", ErrInput)
	}

	normalized := make([]models.SceneLoopSegment, len(segments))
	for i, s := range segments {
		start := s.Start
		end := s.End
		if end < start {
			start, end = end, start
		}
		if end == start {
			end = start + 0.001
		}
		normalized[i] = models.SceneLoopSegment{Start: start, End: end}
	}

	return normalized, nil
}

func clampSegmentIndex(idx int, segmentCount int) int {
	if segmentCount == 0 {
		return 0
	}
	if idx < 0 || idx >= segmentCount {
		return 0
	}
	return idx
}

func toAPIMultiSegmentLoopPreset(p *models.SceneLoopPreset) *MultiSegmentLoopPreset {
	if p == nil {
		return nil
	}

	segments := make([]*MultiSegmentLoopSegment, 0, len(p.Segments))
	for _, s := range p.Segments {
		segments = append(segments, &MultiSegmentLoopSegment{Start: s.Start, End: s.End})
	}

	return &MultiSegmentLoopPreset{
		ID:                  strconv.Itoa(p.ID),
		SceneID:             strconv.Itoa(p.SceneID),
		Name:                p.Name,
		Enabled:             p.Enabled,
		CurrentSegmentIndex: p.CurrentSegmentIndex,
		Segments:            segments,
		CreatedAt:           p.CreatedAt,
		UpdatedAt:           p.UpdatedAt,
	}
}

func (r *mutationResolver) SaveSceneMultiSegmentLoopPreset(ctx context.Context, input models.SceneMultiSegmentLoopPresetInput) (ret *MultiSegmentLoopPreset, err error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, fmt.Errorf("%w: name cannot be empty", ErrInput)
	}

	segments, err := normalizeSegments(input.Segments)
	if err != nil {
		return nil, err
	}

	preset := models.SceneLoopPreset{
		SceneID:             input.SceneID,
		Name:                name,
		Enabled:             input.Enabled && len(segments) > 0,
		CurrentSegmentIndex: clampSegmentIndex(input.CurrentSegmentIndex, len(segments)),
		Segments:            segments,
	}

	if err := r.withTxn(ctx, func(ctx context.Context) error {
		scene, err := r.repository.Scene.Find(ctx, preset.SceneID)
		if err != nil {
			return err
		}
		if scene == nil {
			return fmt.Errorf("scene %d not found", preset.SceneID)
		}

		return r.repository.SceneLoopPreset.Upsert(ctx, &preset)
	}); err != nil {
		return nil, err
	}

	return toAPIMultiSegmentLoopPreset(&preset), nil
}

func (r *mutationResolver) DeleteSceneMultiSegmentLoopPreset(ctx context.Context, sceneID string, name string) (bool, error) {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return false, fmt.Errorf("%w: name cannot be empty", ErrInput)
	}

	sceneInt, err := strconv.Atoi(sceneID)
	if err != nil {
		return false, fmt.Errorf("converting scene id: %w", err)
	}

	if err := r.withTxn(ctx, func(ctx context.Context) error {
		return r.repository.SceneLoopPreset.DeleteBySceneAndName(ctx, sceneInt, trimmed)
	}); err != nil {
		return false, err
	}

	return true, nil
}

func (r *queryResolver) FindSceneMultiSegmentLoopPresets(ctx context.Context, sceneID string) (ret []*MultiSegmentLoopPreset, err error) {
	sceneInt, err := strconv.Atoi(sceneID)
	if err != nil {
		return nil, fmt.Errorf("converting scene id: %w", err)
	}

	var presets []*models.SceneLoopPreset
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		presets, err = r.repository.SceneLoopPreset.FindByScene(ctx, sceneInt)
		return err
	}); err != nil {
		return nil, err
	}

	converted := make([]*MultiSegmentLoopPreset, 0, len(presets))
	for _, p := range presets {
		converted = append(converted, toAPIMultiSegmentLoopPreset(p))
	}

	return converted, nil
}

func (r *sceneResolver) MultiSegmentLoopPresets(ctx context.Context, obj *models.Scene) (ret []*MultiSegmentLoopPreset, err error) {
	var presets []*models.SceneLoopPreset
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		presets, err = r.repository.SceneLoopPreset.FindByScene(ctx, obj.ID)
		return err
	}); err != nil {
		return nil, err
	}

	converted := make([]*MultiSegmentLoopPreset, 0, len(presets))
	for _, p := range presets {
		converted = append(converted, toAPIMultiSegmentLoopPreset(p))
	}

	return converted, nil
}

func (r *sceneMultiSegmentLoopPresetInputResolver) Segments(ctx context.Context, obj *models.SceneMultiSegmentLoopPresetInput, data []*MultiSegmentLoopSegmentInput) error {
	segments := make([]models.SceneLoopSegment, 0, len(data))
	for _, s := range data {
		if s == nil {
			continue
		}
		segments = append(segments, models.SceneLoopSegment{Start: s.Start, End: s.End})
	}

	obj.Segments = segments
	return nil
}
