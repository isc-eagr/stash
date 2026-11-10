package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/stashapp/stash/pkg/models"
)

func taskProgressGoalsEqualCustom(left, right *int) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return *left == *right
}

func recordTaskProgressGoalCustom(ctx context.Context, trackerID int, effectiveOn string, goalPerDay *int) error {
	if effectiveOn == "" {
		effectiveOn = models.TaskProgressReportingDate(time.Now())
	}
	_, err := dbWrapper.Exec(ctx, `
INSERT INTO task_progress_goal_history(tracker_id, effective_on, goal_per_day, created_at)
VALUES (?, ?, ?, ?)
ON CONFLICT(tracker_id, effective_on) DO UPDATE SET
  goal_per_day = excluded.goal_per_day,
  created_at = excluded.created_at`, trackerID, effectiveOn, goalPerDay, time.Now().UTC())
	if err != nil {
		return fmt.Errorf("recording task progress goal: %w", err)
	}
	return nil
}

func taskProgressGoalPerDayCustom(ctx context.Context, trackerID int) (*int, error) {
	var value sql.NullInt64
	err := dbWrapper.Get(ctx, &value, `
SELECT goal_per_day
  FROM task_progress_goal_history
 WHERE tracker_id = ?
 ORDER BY effective_on DESC, created_at DESC
 LIMIT 1`, trackerID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("loading task progress goal: %w", err)
	}
	if !value.Valid {
		return nil, nil
	}
	goal := int(value.Int64)
	return &goal, nil
}

func (s *TaskProgressTrackerStore) SetOverallGoalPerDay(ctx context.Context, goalPerDay *int) error {
	if goalPerDay != nil && *goalPerDay <= 0 {
		return fmt.Errorf("overall task progress goal must be greater than zero")
	}
	return recordTaskProgressGoalCustom(ctx, 0, models.TaskProgressReportingDate(time.Now()), goalPerDay)
}
