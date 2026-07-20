package models

import (
	"context"
	"time"
)

// TaskProgressTracker stores a fixed-goal, tag-backed task tracker.
type TaskProgressTracker struct {
	ID          int       `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Goal        int       `json:"goal"`
	TagID       int       `json:"tag_id"`
	TagName     string    `json:"tag_name"`
	Position    int       `json:"position"`
	IsWorkingOn bool      `json:"is_working_on"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type TaskProgressTrackerReader interface {
	Find(ctx context.Context, id int) (*TaskProgressTracker, error)
	FindAll(ctx context.Context) ([]*TaskProgressTracker, error)
	CountDirectlyTaggedItems(ctx context.Context, tagID int) (int, error)
}

type TaskProgressTrackerWriter interface {
	Create(ctx context.Context, tracker *TaskProgressTracker) error
	Update(ctx context.Context, tracker *TaskProgressTracker) error
	Delete(ctx context.Context, id int) error
	Reorder(ctx context.Context, ids []int) error
}

type TaskProgressTrackerReaderWriter interface {
	TaskProgressTrackerReader
	TaskProgressTrackerWriter
}
