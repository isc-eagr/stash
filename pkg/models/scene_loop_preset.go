package models

import (
	"context"
	"time"
)

// SceneLoopSegment represents a single loop segment with start/end times in seconds.
type SceneLoopSegment struct {
	Start float64 `json:"start"`
	End   float64 `json:"end"`
}

// SceneLoopPreset stores a named collection of loop segments tied to a scene.
type SceneLoopPreset struct {
	ID                  int                `json:"id"`
	SceneID             int                `json:"scene_id"`
	Name                string             `json:"name"`
	Enabled             bool               `json:"enabled"`
	CurrentSegmentIndex int                `json:"current_segment_index"`
	Segments            []SceneLoopSegment `json:"segments"`
	CreatedAt           time.Time          `json:"created_at"`
	UpdatedAt           time.Time          `json:"updated_at"`
}

// SceneMultiSegmentLoopPresetInput is used to upsert presets via the API.
type SceneMultiSegmentLoopPresetInput struct {
	SceneID             int                `json:"scene_id"`
	Name                string             `json:"name"`
	Enabled             bool               `json:"enabled"`
	CurrentSegmentIndex int                `json:"current_segment_index"`
	Segments            []SceneLoopSegment `json:"segments"`
}

// SceneLoopPresetReader defines read operations for presets.
type SceneLoopPresetReader interface {
	FindByScene(ctx context.Context, sceneID int) ([]*SceneLoopPreset, error)
	FindBySceneAndName(ctx context.Context, sceneID int, name string) (*SceneLoopPreset, error)
}

// SceneLoopPresetWriter defines write operations for presets.
type SceneLoopPresetWriter interface {
	Upsert(ctx context.Context, preset *SceneLoopPreset) error
	DeleteBySceneAndName(ctx context.Context, sceneID int, name string) error
}

// SceneLoopPresetReaderWriter combines read and write operations.
type SceneLoopPresetReaderWriter interface {
	SceneLoopPresetReader
	SceneLoopPresetWriter
}
