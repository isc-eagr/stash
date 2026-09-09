-- Add event history fields to existing task progress trackers.
-- The application applies the equivalent upgrade automatically and records the
-- marker below so the September 7, 2026 baseline is created exactly once.
BEGIN;

CREATE TABLE IF NOT EXISTS custom_schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE task_progress_trackers
  ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK(status IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED', 'DELETED'));

ALTER TABLE task_progress_trackers
  ADD COLUMN item_types TEXT NOT NULL
    DEFAULT 'scene,scene_marker,image,gallery,performer,studio,group';

ALTER TABLE task_progress_trackers
  ADD COLUMN history_started_on TEXT NOT NULL DEFAULT '';

ALTER TABLE task_progress_trackers
  ADD COLUMN mode TEXT NOT NULL DEFAULT 'BACKLOG'
    CHECK(mode IN ('FIXED', 'BACKLOG'));

ALTER TABLE task_progress_trackers
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1);

CREATE TABLE IF NOT EXISTS task_progress_tracker_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracker_id INTEGER NOT NULL,
  event_type TEXT NOT NULL
    CHECK(event_type IN ('BASELINE', 'COMPLETED', 'INCOMING')),
  item_type TEXT NOT NULL DEFAULT '',
  item_id INTEGER NOT NULL DEFAULT 0,
  item_label TEXT NOT NULL DEFAULT '',
  occurred_on TEXT NOT NULL,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  baseline_count INTEGER NOT NULL DEFAULT 0 CHECK(baseline_count >= 0),
  tag_id INTEGER NOT NULL,
  FOREIGN KEY(tracker_id) REFERENCES task_progress_trackers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_task_progress_tracker_events_tracker_date
  ON task_progress_tracker_events(tracker_id, occurred_on, id);

CREATE INDEX IF NOT EXISTS idx_task_progress_tracker_events_item
  ON task_progress_tracker_events(tag_id, item_type, item_id);

CREATE TABLE IF NOT EXISTS task_progress_tracker_members (
  tracker_id INTEGER NOT NULL,
  item_type TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'PENDING'
    CHECK(state IN ('PENDING', 'COMPLETED')),
  PRIMARY KEY(tracker_id, item_type, item_id),
  FOREIGN KEY(tracker_id) REFERENCES task_progress_trackers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_task_progress_tracker_members_state
  ON task_progress_tracker_members(tracker_id, state);

UPDATE task_progress_trackers
   SET started_on = '2026-09-07',
       history_started_on = '2026-09-07',
       status = 'ACTIVE',
       goal =
         (SELECT COUNT(DISTINCT scene_id)
            FROM scenes_tags
           WHERE tag_id = task_progress_trackers.tag_id) +
         (SELECT COUNT(*)
            FROM scene_markers
           WHERE primary_tag_id = task_progress_trackers.tag_id
              OR id IN (
                SELECT scene_marker_id
                  FROM scene_markers_tags
                 WHERE tag_id = task_progress_trackers.tag_id
              )) +
         (SELECT COUNT(DISTINCT image_id)
            FROM images_tags
           WHERE tag_id = task_progress_trackers.tag_id) +
         (SELECT COUNT(DISTINCT gallery_id)
            FROM galleries_tags
           WHERE tag_id = task_progress_trackers.tag_id) +
         (SELECT COUNT(DISTINCT performer_id)
            FROM performers_tags
           WHERE tag_id = task_progress_trackers.tag_id) +
         (SELECT COUNT(DISTINCT studio_id)
            FROM studios_tags
           WHERE tag_id = task_progress_trackers.tag_id) +
         (SELECT COUNT(DISTINCT group_id)
            FROM groups_tags
           WHERE tag_id = task_progress_trackers.tag_id),
       updated_at = CURRENT_TIMESTAMP;

INSERT INTO task_progress_tracker_events (
  tracker_id,
  event_type,
  occurred_on,
  occurred_at,
  baseline_count,
  tag_id
)
SELECT id,
       'BASELINE',
       '2026-09-07',
       '2026-09-07 00:00:00',
       goal,
       tag_id
  FROM task_progress_trackers;

INSERT INTO custom_schema_migrations(name)
VALUES ('task_progress_history_v1');

COMMIT;
