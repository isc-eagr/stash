-- CUSTOM: Add an optional daily completion goal to progress trackers.
ALTER TABLE task_progress_trackers
ADD COLUMN goal_per_day INTEGER
CHECK(goal_per_day IS NULL OR goal_per_day > 0);
