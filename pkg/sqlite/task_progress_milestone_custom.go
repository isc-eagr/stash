package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/stashapp/stash/pkg/models"
)

const taskProgressMilestoneSchemaCustom = `
CREATE TABLE IF NOT EXISTS task_progress_milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK(LENGTH(TRIM(name)) > 0),
  target_date TEXT,
  goal_per_day INTEGER CHECK(goal_per_day IS NULL OR goal_per_day > 0),
  version INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS task_progress_milestone_members (
  milestone_id INTEGER NOT NULL,
  tracker_id INTEGER NOT NULL,
  PRIMARY KEY(milestone_id, tracker_id),
  FOREIGN KEY(milestone_id) REFERENCES task_progress_milestones(id) ON DELETE CASCADE,
  FOREIGN KEY(tracker_id) REFERENCES task_progress_trackers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_task_progress_milestone_members_tracker
  ON task_progress_milestone_members(tracker_id);
CREATE TABLE IF NOT EXISTS task_progress_milestone_goal_history (
  milestone_id INTEGER NOT NULL,
  effective_on TEXT NOT NULL,
  goal_per_day INTEGER CHECK(goal_per_day IS NULL OR goal_per_day > 0),
  PRIMARY KEY(milestone_id, effective_on),
  FOREIGN KEY(milestone_id) REFERENCES task_progress_milestones(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS task_progress_milestone_member_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  milestone_id INTEGER NOT NULL,
  tracker_id INTEGER NOT NULL,
  added_on TEXT,
  removed_on TEXT,
  FOREIGN KEY(milestone_id) REFERENCES task_progress_milestones(id) ON DELETE CASCADE,
  FOREIGN KEY(tracker_id) REFERENCES task_progress_trackers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_task_progress_milestone_member_history_milestone
  ON task_progress_milestone_member_history(milestone_id, tracker_id);
CREATE INDEX IF NOT EXISTS idx_task_progress_milestone_member_history_tracker
  ON task_progress_milestone_member_history(tracker_id);`

const taskProgressMilestoneMemberHistoryMigrationCustom = "task_progress_milestone_member_history_v1"

// taskProgressMilestoneSpanCustom is one stretch of a tracker's membership.
// An empty AddedOn counts the tracker's full history; an empty RemovedOn means
// it is still a member. Completed item types are loaded only for dated spans.
type taskProgressMilestoneSpanCustom struct {
	Tracker             *models.TaskProgressTracker
	AddedOn             string
	RemovedOn           string
	CompletedItemCounts map[string]int
}

// Existing members predate the log, so they keep counting their full history.
func ensureTaskProgressMilestoneMemberHistoryCustom(ctx context.Context, tx *sqlx.Tx) error {
	var applied bool
	if err := tx.GetContext(ctx, &applied, "SELECT EXISTS(SELECT 1 FROM custom_schema_migrations WHERE name = ?)", taskProgressMilestoneMemberHistoryMigrationCustom); err != nil {
		return fmt.Errorf("checking milestone membership history bootstrap: %w", err)
	}
	if applied {
		return nil
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO task_progress_milestone_member_history(milestone_id,tracker_id)
SELECT milestone_id,tracker_id FROM task_progress_milestone_members ORDER BY milestone_id,tracker_id`); err != nil {
		return fmt.Errorf("retrofitting milestone membership history: %w", err)
	}
	if _, err := tx.ExecContext(ctx, "INSERT INTO custom_schema_migrations(name) VALUES (?)", taskProgressMilestoneMemberHistoryMigrationCustom); err != nil {
		return fmt.Errorf("recording milestone membership history bootstrap: %w", err)
	}
	return nil
}

func (s *TaskProgressTrackerStore) FindMilestones(ctx context.Context) ([]*models.TaskProgressMilestone, error) {
	rows, err := dbWrapper.QueryxContext(ctx, `SELECT id,name,target_date,goal_per_day,version,created_at,updated_at
FROM task_progress_milestones ORDER BY name COLLATE NOCASE,id`)
	if err != nil {
		return nil, fmt.Errorf("loading milestones: %w", err)
	}
	milestones := []*models.TaskProgressMilestone{}
	byID := map[int]*models.TaskProgressMilestone{}
	for rows.Next() {
		m := &models.TaskProgressMilestone{TrackerIDs: []int{}, Trackers: []*models.TaskProgressTracker{}, ItemCounts: []*models.TaskProgressItemCount{}, CompletedItemCounts: []*models.TaskProgressItemCount{}, History: []*models.TaskProgressDay{}}
		if err := rows.Scan(&m.ID, &m.Name, &m.TargetDate, &m.GoalPerDay, &m.Version, &m.CreatedAt, &m.UpdatedAt); err != nil {
			rows.Close()
			return nil, err
		}
		milestones = append(milestones, m)
		byID[m.ID] = m
	}
	err = rows.Err()
	rows.Close()
	if err != nil || len(milestones) == 0 {
		return milestones, err
	}

	trackers, err := s.FindAll(ctx)
	if err != nil {
		return nil, err
	}
	trackerByID := map[int]*models.TaskProgressTracker{}
	for _, tracker := range trackers {
		trackerByID[tracker.ID] = tracker
	}
	rows, err = dbWrapper.QueryxContext(ctx, `SELECT milestone_id,tracker_id FROM task_progress_milestone_members ORDER BY milestone_id,tracker_id`)
	if err != nil {
		return nil, fmt.Errorf("loading milestone members: %w", err)
	}
	for rows.Next() {
		var milestoneID, trackerID int
		if err := rows.Scan(&milestoneID, &trackerID); err != nil {
			rows.Close()
			return nil, err
		}
		if m := byID[milestoneID]; m != nil {
			m.TrackerIDs = append(m.TrackerIDs, trackerID)
			if tracker := trackerByID[trackerID]; tracker != nil {
				m.Trackers = append(m.Trackers, tracker)
			}
		}
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}
	rows, err = dbWrapper.QueryxContext(ctx, `SELECT milestone_id,effective_on,goal_per_day
FROM task_progress_milestone_goal_history ORDER BY milestone_id,effective_on`)
	if err != nil {
		return nil, fmt.Errorf("loading milestone goals: %w", err)
	}
	goals := map[int]map[string]*int{}
	for rows.Next() {
		var milestoneID int
		var date string
		var goal *int
		if err := rows.Scan(&milestoneID, &date, &goal); err != nil {
			rows.Close()
			return nil, err
		}
		if goals[milestoneID] == nil {
			goals[milestoneID] = map[string]*int{}
		}
		goals[milestoneID][date] = goal
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}
	spans, err := loadTaskProgressMilestoneSpansCustom(ctx, trackerByID)
	if err != nil {
		return nil, err
	}
	for _, m := range milestones {
		sort.SliceStable(m.Trackers, func(i, j int) bool {
			if m.Trackers[i].Position == m.Trackers[j].Position {
				return m.Trackers[i].ID < m.Trackers[j].ID
			}
			return m.Trackers[i].Position < m.Trackers[j].Position
		})
		aggregateTaskProgressMilestoneCustom(m, spans[m.ID], goals[m.ID], models.TaskProgressReportingDate(time.Now()))
	}
	return milestones, nil
}

// Spans of soft-deleted trackers are skipped, matching current membership.
func loadTaskProgressMilestoneSpansCustom(ctx context.Context, trackerByID map[int]*models.TaskProgressTracker) (map[int][]*taskProgressMilestoneSpanCustom, error) {
	rows, err := dbWrapper.QueryxContext(ctx, `SELECT id,milestone_id,tracker_id,COALESCE(added_on,''),COALESCE(removed_on,'')
FROM task_progress_milestone_member_history ORDER BY milestone_id,id`)
	if err != nil {
		return nil, fmt.Errorf("loading milestone membership history: %w", err)
	}
	spans := map[int][]*taskProgressMilestoneSpanCustom{}
	byID := map[int]*taskProgressMilestoneSpanCustom{}
	for rows.Next() {
		var id, milestoneID, trackerID int
		span := &taskProgressMilestoneSpanCustom{}
		if err := rows.Scan(&id, &milestoneID, &trackerID, &span.AddedOn, &span.RemovedOn); err != nil {
			rows.Close()
			return nil, err
		}
		if span.Tracker = trackerByID[trackerID]; span.Tracker != nil {
			spans[milestoneID] = append(spans[milestoneID], span)
			byID[id] = span
		}
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}
	rows, err = dbWrapper.QueryxContext(ctx, `SELECT h.id,e.item_type,COUNT(*)
FROM task_progress_milestone_member_history h
JOIN task_progress_tracker_events e ON e.tracker_id=h.tracker_id AND e.event_type='COMPLETED' AND e.item_type IS NOT NULL
 AND e.occurred_on>=COALESCE(h.added_on,'') AND (h.removed_on IS NULL OR e.occurred_on<=h.removed_on)
WHERE h.added_on IS NOT NULL OR h.removed_on IS NOT NULL
GROUP BY h.id,e.item_type`)
	if err != nil {
		return nil, fmt.Errorf("loading milestone completed item types: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var id, count int
		var itemType string
		if err := rows.Scan(&id, &itemType, &count); err != nil {
			return nil, err
		}
		if span := byID[id]; span != nil {
			if span.CompletedItemCounts == nil {
				span.CompletedItemCounts = map[string]int{}
			}
			span.CompletedItemCounts[itemType] = count
		}
	}
	return spans, rows.Err()
}

func (s *TaskProgressTrackerStore) FindMilestone(ctx context.Context, id int) (*models.TaskProgressMilestone, error) {
	milestones, err := s.FindMilestones(ctx)
	if err != nil {
		return nil, err
	}
	for _, m := range milestones {
		if m.ID == id {
			return m, nil
		}
	}
	return nil, nil
}

func (s *TaskProgressTrackerStore) CreateMilestone(ctx context.Context, m *models.TaskProgressMilestone) error {
	now := time.Now().UTC()
	result, err := dbWrapper.Exec(ctx, `INSERT INTO task_progress_milestones(name,target_date,goal_per_day,version,created_at,updated_at)
VALUES (?,?,?,1,?,?)`, m.Name, m.TargetDate, m.GoalPerDay, now, now)
	if err != nil {
		return fmt.Errorf("creating milestone: %w", err)
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	m.ID, m.Version, m.CreatedAt, m.UpdatedAt = int(id), 1, now, now
	if err := replaceTaskProgressMilestoneMembersCustom(ctx, m.ID, m.TrackerIDs, ""); err != nil {
		return err
	}
	if m.GoalPerDay != nil {
		return recordTaskProgressMilestoneGoalCustom(ctx, m.ID, m.GoalPerDay)
	}
	return nil
}

func (s *TaskProgressTrackerStore) UpdateMilestone(ctx context.Context, m *models.TaskProgressMilestone, changeMembers bool) error {
	var oldGoalValue sql.NullInt64
	if err := dbWrapper.Get(ctx, &oldGoalValue, `SELECT goal_per_day FROM task_progress_milestones WHERE id=?`, m.ID); err != nil {
		return err
	}
	var oldGoal *int
	if oldGoalValue.Valid {
		value := int(oldGoalValue.Int64)
		oldGoal = &value
	}
	now := time.Now().UTC()
	result, err := dbWrapper.Exec(ctx, `UPDATE task_progress_milestones
SET name=?,target_date=?,goal_per_day=?,version=version+1,updated_at=?
WHERE id=? AND version=?`, m.Name, m.TargetDate, m.GoalPerDay, now, m.ID, m.Version)
	if err != nil {
		return fmt.Errorf("updating milestone: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil || affected != 1 {
		return fmt.Errorf("milestone changed during update")
	}
	m.Version++
	m.UpdatedAt = now
	if changeMembers {
		if err := replaceTaskProgressMilestoneMembersCustom(ctx, m.ID, m.TrackerIDs, models.TaskProgressReportingDate(time.Now())); err != nil {
			return err
		}
	}
	if !taskProgressGoalsEqualCustom(oldGoal, m.GoalPerDay) {
		return recordTaskProgressMilestoneGoalCustom(ctx, m.ID, m.GoalPerDay)
	}
	return nil
}

func (s *TaskProgressTrackerStore) DeleteMilestone(ctx context.Context, id int) error {
	for _, table := range []string{"task_progress_milestone_members", "task_progress_milestone_member_history", "task_progress_milestone_goal_history"} {
		if _, err := dbWrapper.Exec(ctx, "DELETE FROM "+table+" WHERE milestone_id=?", id); err != nil {
			return err
		}
	}
	_, err := dbWrapper.Exec(ctx, `DELETE FROM task_progress_milestones WHERE id=?`, id)
	return err
}

// replaceTaskProgressMilestoneMembersCustom also logs membership spans. An empty
// changedOn (milestone creation) counts each tracker's full history; otherwise
// joins and departures are dated so earlier completions stay with the milestone.
func replaceTaskProgressMilestoneMembersCustom(ctx context.Context, milestoneID int, ids []int, changedOn string) error {
	if _, err := dbWrapper.Exec(ctx, `DELETE FROM task_progress_milestone_members WHERE milestone_id=?`, milestoneID); err != nil {
		return err
	}
	keep := map[int]bool{}
	for _, id := range ids {
		keep[id] = true
		if _, err := dbWrapper.Exec(ctx, `INSERT INTO task_progress_milestone_members(milestone_id,tracker_id) VALUES (?,?)`, milestoneID, id); err != nil {
			return err
		}
	}

	type openSpan struct {
		ID        int    `db:"id"`
		TrackerID int    `db:"tracker_id"`
		AddedOn   string `db:"added_on"`
	}
	open := []openSpan{}
	if err := dbWrapper.Select(ctx, &open, `SELECT id,tracker_id,COALESCE(added_on,'') AS added_on
FROM task_progress_milestone_member_history WHERE milestone_id=? AND removed_on IS NULL`, milestoneID); err != nil {
		return err
	}
	isOpen := map[int]bool{}
	for _, span := range open {
		switch {
		case keep[span.TrackerID]:
			isOpen[span.TrackerID] = true
		case changedOn != "" && span.AddedOn == changedOn:
			// Joining and leaving on the same day leaves no trace.
			if _, err := dbWrapper.Exec(ctx, `DELETE FROM task_progress_milestone_member_history WHERE id=?`, span.ID); err != nil {
				return err
			}
		default:
			if _, err := dbWrapper.Exec(ctx, `UPDATE task_progress_milestone_member_history SET removed_on=? WHERE id=?`, changedOn, span.ID); err != nil {
				return err
			}
		}
	}
	for _, id := range ids {
		if isOpen[id] {
			continue
		}
		if changedOn != "" {
			// Re-adding a tracker removed the same day restores its span.
			result, err := dbWrapper.Exec(ctx, `UPDATE task_progress_milestone_member_history SET removed_on=NULL
WHERE id=(SELECT id FROM task_progress_milestone_member_history
 WHERE milestone_id=? AND tracker_id=? AND removed_on=? ORDER BY id DESC LIMIT 1)`, milestoneID, id, changedOn)
			if err != nil {
				return err
			}
			restored, err := result.RowsAffected()
			if err != nil {
				return err
			}
			if restored > 0 {
				continue
			}
		}
		if _, err := dbWrapper.Exec(ctx, `INSERT INTO task_progress_milestone_member_history(milestone_id,tracker_id,added_on)
VALUES (?,?,NULLIF(?,''))`, milestoneID, id, changedOn); err != nil {
			return err
		}
	}
	return nil
}

func recordTaskProgressMilestoneGoalCustom(ctx context.Context, id int, goal *int) error {
	_, err := dbWrapper.Exec(ctx, `INSERT INTO task_progress_milestone_goal_history(milestone_id,effective_on,goal_per_day)
VALUES (?,?,?) ON CONFLICT(milestone_id,effective_on) DO UPDATE SET goal_per_day=excluded.goal_per_day`, id, models.TaskProgressReportingDate(time.Now()), goal)
	return err
}

type taskProgressMilestoneTrackerHistoryCustom struct {
	days      map[string]*models.TaskProgressDay
	first     string
	remaining int
	spans     []*taskProgressMilestoneSpanCustom
}

// aggregateTaskProgressMilestoneCustom sums member trackers within their
// membership spans. A tracker's remaining items count as Added on the day it
// joins and Removed on the day it leaves; completions recorded while it was a
// member stay in the milestone after it leaves.
func aggregateTaskProgressMilestoneCustom(m *models.TaskProgressMilestone, spans []*taskProgressMilestoneSpanCustom, goals map[string]*int, today string) {
	counts := map[string]int{}
	completedCounts := map[string]int{}
	open := map[int]bool{}
	for _, span := range spans {
		if span.RemovedOn == "" {
			open[span.Tracker.ID] = true
		}
	}
	for _, tracker := range m.Trackers {
		m.CurrentCount += tracker.CurrentCount
		for _, item := range tracker.ItemCounts {
			counts[item.ItemType] += item.Count
		}
		// Members without a logged span count their full history.
		if !open[tracker.ID] {
			spans = append(spans, &taskProgressMilestoneSpanCustom{Tracker: tracker})
		}
	}

	histories := []*taskProgressMilestoneTrackerHistoryCustom{}
	byTracker := map[int]*taskProgressMilestoneTrackerHistoryCustom{}
	first, earliest := "", ""
	for _, span := range spans {
		tracker := span.Tracker
		if span.AddedOn == "" && span.RemovedOn == "" {
			completed := tracker.CompletedCount
			if tracker.Mode == "FIXED" {
				completed = max(tracker.Goal-tracker.CurrentCount, 0)
			}
			m.CompletedCount += completed
			for _, item := range tracker.CompletedItemCounts {
				completedCounts[item.ItemType] += item.Count
			}
		} else {
			for typ, n := range span.CompletedItemCounts {
				completedCounts[typ] += n
			}
			for _, day := range tracker.History {
				if day.Date >= span.AddedOn && (span.RemovedOn == "" || day.Date <= span.RemovedOn) {
					m.CompletedCount += day.Completed
				}
			}
		}
		history := byTracker[tracker.ID]
		if history == nil {
			history = &taskProgressMilestoneTrackerHistoryCustom{days: map[string]*models.TaskProgressDay{}}
			for _, day := range tracker.History {
				history.days[day.Date] = day
			}
			if len(tracker.History) > 0 {
				history.first = tracker.History[0].Date
				if earliest == "" || history.first < earliest {
					earliest = history.first
				}
			}
			byTracker[tracker.ID] = history
			histories = append(histories, history)
		}
		history.spans = append(history.spans, span)
		if history.first == "" {
			continue
		}
		start := max(history.first, span.AddedOn)
		if (span.RemovedOn == "" || start <= span.RemovedOn) && (first == "" || start < first) {
			first = start
		}
	}
	m.TotalCount = m.CompletedCount + m.CurrentCount
	for _, typ := range models.TaskProgressItemTypes {
		m.ItemCounts = append(m.ItemCounts, &models.TaskProgressItemCount{ItemType: typ, Count: counts[typ]})
		if completedCounts[typ] > 0 {
			m.CompletedItemCounts = append(m.CompletedItemCounts, &models.TaskProgressItemCount{ItemType: typ, Count: completedCounts[typ]})
		}
	}
	if first == "" {
		return
	}

	var currentGoal *int
	// Days before the first member day only carry each tracker's remaining.
	for date := earliest; date <= today; {
		day := &models.TaskProgressDay{Date: date}
		baseline := 0
		hasBaseline := false
		for _, history := range histories {
			if history.first == "" || date < history.first {
				continue
			}
			// Remaining is carried through non-member days so a later join
			// brings in the tracker's actual backlog.
			entry := history.days[date]
			start := history.remaining
			if entry != nil {
				if entry.BaselineCount != nil {
					start = *entry.BaselineCount
				}
				history.remaining = entry.Remaining
			}
			var span *taskProgressMilestoneSpanCustom
			for _, candidate := range history.spans {
				if candidate.AddedOn <= date && (candidate.RemovedOn == "" || date <= candidate.RemovedOn) {
					span = candidate
					break
				}
			}
			if span == nil {
				continue
			}
			joined := span.AddedOn != "" && (date == span.AddedOn || (date == history.first && span.AddedOn < history.first))
			if joined {
				day.Added += start
			}
			if entry != nil {
				day.Completed += entry.Completed
				day.Incoming += entry.Incoming
				m.IncomingCount += entry.Incoming
				hasBaseline = hasBaseline || (entry.BaselineCount != nil && !joined)
			}
			baseline += start
			if span.RemovedOn == date {
				day.Removed += history.remaining
			} else {
				day.Remaining += history.remaining
			}
		}
		if hasBaseline {
			day.BaselineCount = &baseline
		}
		if goal, ok := goals[date]; ok {
			currentGoal = goal
		}
		day.GoalPerDay = currentGoal
		if date >= first {
			m.History = append(m.History, day)
		}
		parsed, err := time.Parse("2006-01-02", date)
		if err != nil {
			break
		}
		date = parsed.AddDate(0, 0, 1).Format("2006-01-02")
	}
}

var _ models.TaskProgressMilestoneReaderWriter = (*TaskProgressTrackerStore)(nil)
