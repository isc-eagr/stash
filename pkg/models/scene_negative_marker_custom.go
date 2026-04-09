package models

import (
	"context"
	"time"
)

// SceneNegativeMarker represents a time range to skip during playback.
type SceneNegativeMarker struct {
	ID           int       `json:"id"`
	SceneID      int       `json:"scene_id"`
	Name         string    `json:"name"`
	StartSeconds float64   `json:"start_seconds"`
	EndSeconds   float64   `json:"end_seconds"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// SceneNegativeMarkerReader defines read operations for negative markers.
type SceneNegativeMarkerReader interface {
	Find(ctx context.Context, id int) (*SceneNegativeMarker, error)
	FindByScene(ctx context.Context, sceneID int) ([]*SceneNegativeMarker, error)
}

// SceneNegativeMarkerWriter defines write operations for negative markers.
type SceneNegativeMarkerWriter interface {
	Create(ctx context.Context, marker *SceneNegativeMarker) error
	Update(ctx context.Context, marker *SceneNegativeMarker) error
	Delete(ctx context.Context, id int) error
}

// SceneNegativeMarkerReaderWriter combines read and write operations.
type SceneNegativeMarkerReaderWriter interface {
	SceneNegativeMarkerReader
	SceneNegativeMarkerWriter
}
