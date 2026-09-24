package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
	"time"

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
);`

func (s *TaskProgressTrackerStore) FindMilestones(ctx context.Context) ([]*models.TaskProgressMilestone, error) {
	rows, err := dbWrapper.QueryxContext(ctx, `SELECT id,name,target_date,goal_per_day,version,created_at,updated_at
FROM task_progress_milestones ORDER BY name COLLATE NOCASE,id`)
	if err != nil {
		return nil, fmt.Errorf("loading milestones: %w", err)
	}
	milestones := []*models.TaskProgressMilestone{}
	byID := map[int]*models.TaskProgressMilestone{}
	for rows.Next() {
		m := &models.TaskProgressMilestone{TrackerIDs: []int{}, Trackers: []*models.TaskProgressTracker{}, ItemCounts: []*models.TaskProgressItemCount{}, History: []*models.TaskProgressDay{}}
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
	for _, m := range milestones {
		sort.SliceStable(m.Trackers, func(i, j int) bool {
			if m.Trackers[i].Position == m.Trackers[j].Position {
				return m.Trackers[i].ID < m.Trackers[j].ID
			}
			return m.Trackers[i].Position < m.Trackers[j].Position
		})
		aggregateTaskProgressMilestoneCustom(m, goals[m.ID], models.TaskProgressReportingDate(time.Now()))
	}
	return milestones, nil
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
	if err := replaceTaskProgressMilestoneMembersCustom(ctx, m.ID, m.TrackerIDs); err != nil {
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
		if err := replaceTaskProgressMilestoneMembersCustom(ctx, m.ID, m.TrackerIDs); err != nil {
			return err
		}
	}
	if !taskProgressGoalsEqualCustom(oldGoal, m.GoalPerDay) {
		return recordTaskProgressMilestoneGoalCustom(ctx, m.ID, m.GoalPerDay)
	}
	return nil
}

func (s *TaskProgressTrackerStore) DeleteMilestone(ctx context.Context, id int) error {
	for _, table := range []string{"task_progress_milestone_members", "task_progress_milestone_goal_history"} {
		if _, err := dbWrapper.Exec(ctx, "DELETE FROM "+table+" WHERE milestone_id=?", id); err != nil {
			return err
		}
	}
	_, err := dbWrapper.Exec(ctx, `DELETE FROM task_progress_milestones WHERE id=?`, id)
	return err
}

func replaceTaskProgressMilestoneMembersCustom(ctx context.Context, milestoneID int, ids []int) error {
	if _, err := dbWrapper.Exec(ctx, `DELETE FROM task_progress_milestone_members WHERE milestone_id=?`, milestoneID); err != nil {
		return err
	}
	for _, id := range ids {
		if _, err := dbWrapper.Exec(ctx, `INSERT INTO task_progress_milestone_members(milestone_id,tracker_id) VALUES (?,?)`, milestoneID, id); err != nil {
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

func aggregateTaskProgressMilestoneCustom(m *models.TaskProgressMilestone, goals map[string]*int, today string) {
	counts := map[string]int{}
	first := ""
	for _, tracker := range m.Trackers {
		completed := tracker.CompletedCount
		if tracker.Mode == "FIXED" {
			completed = tracker.Goal - tracker.CurrentCount
			if completed < 0 {
				completed = 0
			}
		}
		m.CompletedCount += completed
		m.CurrentCount += tracker.CurrentCount
		m.IncomingCount += tracker.IncomingCount
		for _, item := range tracker.ItemCounts {
			counts[item.ItemType] += item.Count
		}
		if len(tracker.History) > 0 && (first == "" || tracker.History[0].Date < first) {
			first = tracker.History[0].Date
		}
	}
	m.TotalCount = m.CompletedCount + m.CurrentCount
	for _, typ := range models.TaskProgressItemTypes {
		m.ItemCounts = append(m.ItemCounts, &models.TaskProgressItemCount{ItemType: typ, Count: counts[typ]})
	}
	if first == "" {
		return
	}
	byTracker := make([]map[string]*models.TaskProgressDay, len(m.Trackers))
	firstByTracker := make([]string, len(m.Trackers))
	remaining := make([]int, len(m.Trackers))
	for i, tracker := range m.Trackers {
		byTracker[i] = map[string]*models.TaskProgressDay{}
		if len(tracker.History) > 0 {
			firstByTracker[i] = tracker.History[0].Date
		}
		for _, day := range tracker.History {
			byTracker[i][day.Date] = day
		}
	}
	var currentGoal *int
	for date := first; date <= today; {
		day := &models.TaskProgressDay{Date: date}
		baseline := 0
		hasBaseline := false
		for i := range m.Trackers {
			if firstByTracker[i] == "" || date < firstByTracker[i] {
				continue
			}
			entry := byTracker[i][date]
			if entry == nil {
				baseline += remaining[i]
				day.Remaining += remaining[i]
				continue
			}
			day.Completed += entry.Completed
			day.Incoming += entry.Incoming
			if entry.BaselineCount != nil {
				hasBaseline = true
				baseline += *entry.BaselineCount
			} else {
				baseline += remaining[i]
			}
			remaining[i] = entry.Remaining
			day.Remaining += remaining[i]
		}
		if hasBaseline {
			day.BaselineCount = &baseline
		}
		if goal, ok := goals[date]; ok {
			currentGoal = goal
		}
		day.GoalPerDay = currentGoal
		m.History = append(m.History, day)
		parsed, err := time.Parse("2006-01-02", date)
		if err != nil {
			break
		}
		date = parsed.AddDate(0, 0, 1).Format("2006-01-02")
	}
}

var _ models.TaskProgressMilestoneReaderWriter = (*TaskProgressTrackerStore)(nil)
