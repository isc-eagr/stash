-- Create the database-backed task progress trackers table.
CREATE TABLE IF NOT EXISTS task_progress_trackers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  goal INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_working_on BOOLEAN NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  CHECK(goal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_task_progress_trackers_position
  ON task_progress_trackers(position, id);

CREATE INDEX IF NOT EXISTS idx_task_progress_trackers_tag_id
  ON task_progress_trackers(tag_id);
