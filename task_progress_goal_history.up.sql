-- CUSTOM: Persist Overall Progress goals and effective-dated tracker goals.
CREATE TABLE IF NOT EXISTS task_progress_goal_history (
  tracker_id INTEGER NOT NULL DEFAULT 0 CHECK(tracker_id >= 0),
  effective_on TEXT NOT NULL,
  goal_per_day INTEGER CHECK(goal_per_day IS NULL OR goal_per_day > 0),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(tracker_id, effective_on)
);

CREATE INDEX IF NOT EXISTS idx_task_progress_goal_history_lookup
  ON task_progress_goal_history(tracker_id, effective_on DESC);

CREATE TRIGGER IF NOT EXISTS task_progress_goal_history_tracker_delete
AFTER DELETE ON task_progress_trackers
BEGIN
  DELETE FROM task_progress_goal_history WHERE tracker_id = OLD.id;
END;
