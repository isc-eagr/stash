package models

import (
	"context"
	"time"
)

const (
	TaskProgressTrackerStatusActive    = "ACTIVE"
	TaskProgressTrackerStatusPaused    = "PAUSED"
	TaskProgressTrackerStatusArchived  = "ARCHIVED"
	TaskProgressTrackerStatusCompleted = "COMPLETED"
	TaskProgressTrackerStatusDeleted   = "DELETED"

	TaskProgressEventBaseline   = "BASELINE"
	TaskProgressEventCompleted  = "COMPLETED"
	TaskProgressEventIncoming   = "INCOMING"
	TaskProgressEventAdjustment = "ADJUSTMENT"
)

var TaskProgressItemTypes = []string{
	"scene",
	"scene_marker",
	"image",
	"gallery",
	"performer",
	"studio",
	"group",
}

type TaskProgressItemCount struct {
	ItemType string `json:"item_type"`
	Count    int    `json:"count"`
}

type TaskProgressDay struct {
	Date          string `json:"date"`
	Completed     int    `json:"completed"`
	Incoming      int    `json:"incoming"`
	Remaining     int    `json:"remaining"`
	BaselineCount *int   `json:"baseline_count,omitempty"`
}

type TaskProgressEvent struct {
	ID         int       `json:"id"`
	EventType  string    `json:"event_type"`
	ItemType   string    `json:"item_type"`
	ItemID     int       `json:"item_id"`
	ItemLabel  string    `json:"item_label"`
	OccurredOn string    `json:"occurred_on"`
	OccurredAt time.Time `json:"occurred_at"`
	URL        string    `json:"url"`
}

type TaskProgressEventPage struct {
	Events  []*TaskProgressEvent `json:"events"`
	HasMore bool                 `json:"has_more"`
}

// TaskProgressOverall is the persisted history and current scene counts for
// the built-in organized-scenes tracker.
type TaskProgressOverall struct {
	TotalCount     int                `json:"total_count"`
	OrganizedCount int                `json:"organized_count"`
	CompletedCount int                `json:"completed_count"`
	IncomingCount  int                `json:"incoming_count"`
	History        []*TaskProgressDay `json:"history"`
}

// TaskProgressReportingDate groups activity by the user's reporting timezone.
func TaskProgressReportingDate(now time.Time) string {
	return now.In(time.FixedZone("America/Mexico_City", -6*60*60)).Format("2006-01-02")
}

// TaskProgressTracker stores a fixed-goal, tag-backed task tracker.
type TaskProgressTracker struct {
	ID               int                      `json:"id"`
	Title            string                   `json:"title"`
	Description      string                   `json:"description"`
	Goal             int                      `json:"goal"`
	TagID            int                      `json:"tag_id"`
	TagName          string                   `json:"tag_name"`
	Position         int                      `json:"position"`
	IsWorkingOn      bool                     `json:"is_working_on"`
	StartedOn        string                   `json:"started_on"`
	Status           string                   `json:"status"`
	Mode             string                   `json:"mode"`
	Version          int                      `json:"version"`
	HistoryStartedOn string                   `json:"history_started_on"`
	ItemTypes        []string                 `json:"item_types"`
	CurrentCount     int                      `json:"current_count"`
	CompletedCount   int                      `json:"completed_count"`
	IncomingCount    int                      `json:"incoming_count"`
	ItemCounts       []*TaskProgressItemCount `json:"item_counts"`
	History          []*TaskProgressDay       `json:"history"`
	CreatedAt        time.Time                `json:"created_at"`
	UpdatedAt        time.Time                `json:"updated_at"`
}

type TaskProgressTrackerReader interface {
	Find(ctx context.Context, id int) (*TaskProgressTracker, error)
	FindAll(ctx context.Context) ([]*TaskProgressTracker, error)
	Overall(ctx context.Context) (*TaskProgressOverall, error)
	CountDirectlyTaggedItems(ctx context.Context, tagID int, itemTypes []string) (int, error)
	Events(ctx context.Context, trackerID int, date string, afterID int) (*TaskProgressEventPage, error)
	PendingItems(ctx context.Context, trackerID int, itemType string, offset int) (*TaskProgressEventPage, error)
}

type TaskProgressTrackerWriter interface {
	Create(ctx context.Context, tracker *TaskProgressTracker) error
	Update(ctx context.Context, tracker *TaskProgressTracker) error
	Delete(ctx context.Context, id int) error
	Reorder(ctx context.Context, ids []int) error
	CreateBaseline(ctx context.Context, tracker *TaskProgressTracker) error
}

type TaskProgressTrackerReaderWriter interface {
	TaskProgressTrackerReader
	TaskProgressTrackerWriter
}
