-- Add persisted history for the built-in Overall Progress scene tracker.
-- The application installs this table and baseline automatically.
BEGIN;

CREATE TABLE IF NOT EXISTS task_progress_overall_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL
    CHECK(event_type IN ('BASELINE', 'COMPLETED', 'INCOMING', 'ADJUSTMENT')),
  scene_id INTEGER NOT NULL DEFAULT 0,
  occurred_on TEXT NOT NULL,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_count INTEGER NOT NULL CHECK(total_count >= 0),
  organized_count INTEGER NOT NULL CHECK(organized_count >= 0),
  remaining_count INTEGER NOT NULL CHECK(remaining_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_task_progress_overall_events_date
  ON task_progress_overall_events(occurred_on, id);

INSERT INTO task_progress_overall_events (
  event_type,
  occurred_on,
  occurred_at,
  total_count,
  organized_count,
  remaining_count
)
SELECT 'BASELINE',
       '2026-09-07',
       '2026-09-07 00:00:00',
       COUNT(*),
       COALESCE(SUM(CASE WHEN organized THEN 1 ELSE 0 END), 0),
       COALESCE(SUM(CASE WHEN organized THEN 0 ELSE 1 END), 0)
  FROM scenes
 WHERE NOT EXISTS (SELECT 1 FROM task_progress_overall_events);

INSERT INTO custom_schema_migrations(name)
VALUES ('task_progress_overall_history_v1');

COMMIT;
