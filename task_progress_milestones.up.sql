-- Custom standalone schema for progress tracker milestones.
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
-- Membership spans: NULL added_on counts the tracker's full history (members
-- picked at creation or before the log existed); NULL removed_on is current.
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
  ON task_progress_milestone_member_history(tracker_id);
INSERT INTO task_progress_milestone_member_history(milestone_id, tracker_id)
SELECT milestone_id, tracker_id FROM task_progress_milestone_members
 WHERE NOT EXISTS (SELECT 1 FROM task_progress_milestone_member_history);
