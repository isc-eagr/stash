package sqlite

import (
	"context"
	"fmt"
	"time"

	"github.com/stashapp/stash/pkg/models"
)

const (
	taskProgressOverallSceneCreatedCustom    = "CREATED"
	taskProgressOverallSceneUpdatedCustom    = "UPDATED"
	taskProgressOverallSceneDestroyedCustom  = "DESTROYED"
	taskProgressOverallQuickUndoWindowCustom = time.Minute
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
		// Keep deletion snapshots so history can credit pending work, including
		// deletions recorded before they counted toward goals.
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
	if eventType == models.TaskProgressEventIncoming &&
		change == taskProgressOverallSceneUpdatedCustom {
		const discardQuickUndoQuery = `
DELETE FROM task_progress_overall_events
WHERE id = (
  SELECT id
    FROM task_progress_overall_events
   WHERE scene_id = ?
     AND event_type = 'COMPLETED'
     AND occurred_at >= ?
   ORDER BY occurred_at DESC, id DESC
   LIMIT 1
)`
		result, err := dbWrapper.Exec(ctx, discardQuickUndoQuery,
			sceneID,
			now.Add(-taskProgressOverallQuickUndoWindowCustom),
		)
		if err != nil {
			return fmt.Errorf("discarding quick overall task progress undo: %w", err)
		}
		if removed, err := result.RowsAffected(); err != nil {
			return fmt.Errorf("counting discarded quick overall task progress undo: %w", err)
		} else if removed > 0 {
			return nil
		}
	}

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
		return fmt.Errorf("recording overall task progress scene change: %w", err)
	}
	return nil
}

func (s *TaskProgressTrackerStore) Overall(ctx context.Context) (*models.TaskProgressOverall, error) {
	ret := &models.TaskProgressOverall{History: []*models.TaskProgressDay{}}
	goalPerDay, err := taskProgressGoalPerDayCustom(ctx, 0)
	if err != nil {
		return nil, err
	}
	ret.GoalPerDay = goalPerDay
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
WITH dates AS (
  SELECT occurred_on FROM task_progress_overall_events
  UNION
  SELECT effective_on FROM task_progress_goal_history WHERE tracker_id = 0
), daily AS (
  SELECT occurred_on,
         -- Credit deleted pending work on its original date. Organized scenes
         -- already earned completion, so deleting them adds no second credit.
         SUM(CASE WHEN event_type = 'COMPLETED' THEN 1
                  WHEN event_type = 'ADJUSTMENT' THEN MAX(COALESCE(previous_remaining - remaining_count, 0), 0)
                  ELSE 0 END) AS completed,
         SUM(event_type = 'INCOMING') AS incoming,
         MAX(CASE WHEN event_type = 'BASELINE' THEN id END) AS baseline_id
    FROM (SELECT *, LAG(remaining_count) OVER (ORDER BY id) AS previous_remaining
            FROM task_progress_overall_events)
   GROUP BY occurred_on
)
SELECT dates.occurred_on,
       COALESCE(d.completed, 0),
       COALESCE(d.incoming, 0),
       latest.remaining_count,
       latest.organized_count,
       baseline.remaining_count,
       (SELECT goal_per_day FROM task_progress_goal_history g
         WHERE g.tracker_id = 0 AND g.effective_on <= dates.occurred_on
         ORDER BY g.effective_on DESC, g.created_at DESC LIMIT 1)
  FROM dates
  LEFT JOIN daily d ON d.occurred_on = dates.occurred_on
  -- The card counts organized scenes, so the day's closing snapshot anchors
  -- cumulative totals, including scenes organized before tracking began.
  LEFT JOIN task_progress_overall_events latest ON latest.id = (
    SELECT e.id FROM task_progress_overall_events e
     WHERE e.occurred_on <= dates.occurred_on ORDER BY e.occurred_on DESC, e.id DESC LIMIT 1)
  LEFT JOIN task_progress_overall_events baseline ON baseline.id = d.baseline_id
 ORDER BY dates.occurred_on`
	rows, err := dbWrapper.QueryxContext(ctx, historyQuery)
	if err != nil {
		return nil, fmt.Errorf("loading overall task progress history: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		day := &models.TaskProgressDay{}
		if err := rows.Scan(&day.Date, &day.Completed, &day.Incoming, &day.Remaining, &day.CompletedTotal, &day.BaselineCount, &day.GoalPerDay); err != nil {
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
