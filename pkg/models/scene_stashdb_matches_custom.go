package models

// CUSTOM: StashDB Matches accessors for the scene repository.

import (
	"context"
	"time"
)

// StashDBMatchTargetCustom is a scene linked to a stash-box endpoint and its
// stored count (nil when never fetched).
type StashDBMatchTargetCustom struct {
	SceneID int    `db:"scene_id"`
	StashID string `db:"stash_id"`
	Matches *int   `db:"matches"`
}

// StashDBMatchesReportCustom summarises the latest refresh-task run.
type StashDBMatchesReportCustom struct {
	StartedAt  time.Time `db:"started_at"`
	FinishedAt time.Time `db:"finished_at"`
	Checked    int       `db:"checked"`
	Changed    int       `db:"changed"`
	Unchanged  int       `db:"unchanged"`
	NotFound   int       `db:"not_found"`
	Failed     int       `db:"failed"`
	Cancelled  bool      `db:"cancelled"`
	Changes    []StashDBMatchesChangeCustom
}

// StashDBMatchesChangeCustom is one count the refresh wrote; Previous is nil
// for a first-time count.
type StashDBMatchesChangeCustom struct {
	SceneID  int  `db:"scene_id"`
	Previous *int `db:"previous"`
	Current  int  `db:"current"`
}

type StashDBMatchesReaderCustom interface {
	// GetStashDBMatchesCustom returns nil when the scene was never scraped from StashDB.
	GetStashDBMatchesCustom(ctx context.Context, sceneID int) (*int, error)
	FindStashDBMatchTargetsCustom(ctx context.Context, endpoint string) ([]StashDBMatchTargetCustom, error)
	// GetStashDBMatchesReportCustom returns nil before the first refresh.
	GetStashDBMatchesReportCustom(ctx context.Context) (*StashDBMatchesReportCustom, error)
}

type StashDBMatchesWriterCustom interface {
	// SetStashDBMatchesCustom clears the stored value when matches is nil.
	SetStashDBMatchesCustom(ctx context.Context, sceneID int, matches *int) error
	// SaveStashDBMatchesReportCustom replaces the previous run's report.
	SaveStashDBMatchesReportCustom(ctx context.Context, report StashDBMatchesReportCustom) error
}
