package sqlite

import (
	"context"
	"fmt"
	"time"

	"github.com/stashapp/stash/pkg/models"
)

const (
	taskProgressOverallSceneCreatedCustom   = "CREATED"
	taskProgressOverallSceneUpdatedCustom   = "UPDATED"
	taskProgressOverallSceneDestroyedCustom = "DESTROYED"
)

func taskProgressSceneOrganizedCustom(ctx context.Context, sceneID int) (bool, error) {
	var organized bool
	if err := dbWrapper.Get(ctx, &organized, "SELECT organized FROM scenes WHERE id = ?", sceneID); err != nil {
		return false, fmt.Errorf("getting scene %d organized state for overall progress: %w", sceneID, err)
	}
	return organized, nil
}

func recordTaskProgressOverallSceneChangeCustom(ctx context.Context, change string, sceneID int, beforeOrganized, afterOrganized bool) error {
	eventType := ""
	switch change {
	case taskProgressOverallSceneCreatedCustom:
		eventType = models.TaskProgressEventIncoming
	case taskProgressOverallSceneDestroyedCustom:
		eventType = models.TaskProgressEventAdjustment
	case taskProgressOverallSceneUpdatedCustom:
		if beforeOrganized == afterOrganized {
			return nil
		}
		if afterOrganized {
			eventType = models.TaskProgressEventCompleted
		} else {
			eventType = models.TaskProgressEventIncoming
		}
	default:
		return fmt.Errorf("unsupported overall task progress scene change %q", change)
	}

	now := time.Now().UTC()
	const query = `
INSERT INTO task_progress_overall_events (
  event_type, scene_id, occurred_on, occurred_at, total_count, organized_count, remaining_count
)
SELECT ?, ?, ?, ?, COUNT(*),
       COALESCE(SUM(CASE WHEN organized THEN 1 ELSE 0 END), 0),
       COALESCE(SUM(CASE WHEN organized THEN 0 ELSE 1 END), 0)
  FROM scenes`
	if _, err := dbWrapper.Exec(ctx, query,
		eventType,
		sceneID,
		now.In(taskProgressTimezoneCustom).Format("2006-01-02"),
		now,
	); err != nil {
		if taskProgressTablesMissingCustom(err) {
			return nil
		}
		return fmt.Errorf("recording overall task progress scene change: %w", err)
	}
	return nil
}

func (s *TaskProgressTrackerStore) Overall(ctx context.Context) (*models.TaskProgressOverall, error) {
	ret := &models.TaskProgressOverall{History: []*models.TaskProgressDay{}}
	counts := struct {
		Total     int `db:"total_count"`
		Organized int `db:"organized_count"`
	}{}
	const countsQuery = `
SELECT COUNT(*) AS total_count,
       COALESCE(SUM(CASE WHEN organized THEN 1 ELSE 0 END), 0) AS organized_count
  FROM scenes`
	if err := dbWrapper.Get(ctx, &counts, countsQuery); err != nil {
		return nil, fmt.Errorf("loading overall task progress counts: %w", err)
	}
	ret.TotalCount, ret.OrganizedCount = counts.Total, counts.Organized

	const historyQuery = `
WITH daily AS (
  SELECT occurred_on,
         SUM(event_type = 'COMPLETED') AS completed,
         SUM(event_type = 'INCOMING') AS incoming,
         MAX(CASE WHEN event_type = 'BASELINE' THEN id END) AS baseline_id,
         MAX(id) AS last_id
    FROM task_progress_overall_events
   GROUP BY occurred_on
)
SELECT d.occurred_on,
       d.completed,
       d.incoming,
       last.remaining_count,
       baseline.remaining_count
  FROM daily d
  JOIN task_progress_overall_events last ON last.id = d.last_id
  LEFT JOIN task_progress_overall_events baseline ON baseline.id = d.baseline_id
 ORDER BY d.occurred_on`
	rows, err := dbWrapper.QueryxContext(ctx, historyQuery)
	if err != nil {
		return nil, fmt.Errorf("loading overall task progress history: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		day := &models.TaskProgressDay{}
		if err := rows.Scan(&day.Date, &day.Completed, &day.Incoming, &day.Remaining, &day.BaselineCount); err != nil {
			return nil, fmt.Errorf("scanning overall task progress history: %w", err)
		}
		ret.CompletedCount += day.Completed
		ret.IncomingCount += day.Incoming
		ret.History = append(ret.History, day)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating overall task progress history: %w", err)
	}
	return ret, nil
}
