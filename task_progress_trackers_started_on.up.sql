-- Add a mutable calendar start date to existing task progress trackers.
ALTER TABLE task_progress_trackers
  ADD COLUMN started_on TEXT NOT NULL DEFAULT '';

UPDATE task_progress_trackers
  SET started_on = DATE(created_at)
  WHERE started_on = '';
