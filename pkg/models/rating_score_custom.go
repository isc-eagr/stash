package models

import (
	"context"
	"time"
)

const (
	RatingEntityScene     = "scene"
	RatingEntityPerformer = "performer"

	RatingScoreSectionCriterion = "criterion"
	RatingScoreSectionBonus     = "bonus"
	RatingScoreSectionPenalty   = "penalty"

	RatingSceneModeDefault = "default"
	RatingSceneModeSolo    = "solo"
	RatingSceneModeGroup   = "group"
)

type RatingScore struct {
	ID            int       `json:"id"`
	EntityType    string    `json:"entity_type"`
	EntityID      int       `json:"entity_id"`
	Section       string    `json:"section"`
	Key           string    `json:"key"`
	RawValue      float64   `json:"raw_value"`
	WeightedValue float64   `json:"weighted_value"`
	Label         *string   `json:"label"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type RatingScoreInput struct {
	EntityType    string  `json:"entity_type"`
	EntityID      int     `json:"entity_id"`
	Section       string  `json:"section"`
	Key           string  `json:"key"`
	RawValue      float64 `json:"raw_value"`
	WeightedValue float64 `json:"weighted_value"`
	Label         *string `json:"label"`
}

type RatingScoreDeleteInput struct {
	EntityType string `json:"entity_type"`
	EntityID   int    `json:"entity_id"`
	Section    string `json:"section"`
	Key        string `json:"key"`
}

type RatingScoreUpdateResult struct {
	EntityType string         `json:"entity_type"`
	EntityID   int            `json:"entity_id"`
	Rating100  int            `json:"rating100"`
	Scores     []*RatingScore `json:"scores"`
}

type RatingScoreReader interface {
	FindByEntity(ctx context.Context, entityType string, entityID int) ([]*RatingScore, error)
	SceneMode(ctx context.Context, sceneID int) (string, error)
}

type RatingScoreWriter interface {
	Upsert(ctx context.Context, score *RatingScore) error
	Delete(ctx context.Context, entityType string, entityID int, section string, key string) (bool, error)
	DeleteByEntity(ctx context.Context, entityType string, entityID int) error
	RecalculateRating(ctx context.Context, entityType string, entityID int) (int, error)
	ResetSceneScores(ctx context.Context, sceneID int) (bool, error)
	ResetAllSceneScores(ctx context.Context) (int, error)
}

type RatingScoreReaderWriter interface {
	RatingScoreReader
	RatingScoreWriter
}
