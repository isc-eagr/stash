package models

import (
	"context"
	"time"
)

// TaskProgressMilestone groups tracker work without changing the trackers.
type TaskProgressMilestone struct {
	ID             int                      `json:"id"`
	Name           string                   `json:"name"`
	TargetDate     *string                  `json:"target_date,omitempty"`
	GoalPerDay     *int                     `json:"goal_per_day,omitempty"`
	Version        int                      `json:"version"`
	TrackerIDs     []int                    `json:"tracker_ids"`
	Trackers       []*TaskProgressTracker   `json:"trackers"`
	TotalCount     int                      `json:"total_count"`
	CompletedCount int                      `json:"completed_count"`
	IncomingCount  int                      `json:"incoming_count"`
	CurrentCount   int                      `json:"current_count"`
	ItemCounts     []*TaskProgressItemCount `json:"item_counts"`
	History        []*TaskProgressDay       `json:"history"`
	CreatedAt      time.Time                `json:"created_at"`
	UpdatedAt      time.Time                `json:"updated_at"`
}

type TaskProgressMilestoneReaderWriter interface {
	FindMilestones(ctx context.Context) ([]*TaskProgressMilestone, error)
	FindMilestone(ctx context.Context, id int) (*TaskProgressMilestone, error)
	CreateMilestone(ctx context.Context, milestone *TaskProgressMilestone) error
	UpdateMilestone(ctx context.Context, milestone *TaskProgressMilestone, changeMembers bool) error
	DeleteMilestone(ctx context.Context, id int) error
}
