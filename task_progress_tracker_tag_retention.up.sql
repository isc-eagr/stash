-- Preserve tracker history after a tag is deleted.
-- For existing tracker schemas before this migration; the app upgrades automatically.
BEGIN IMMEDIATE;
ALTER TABLE task_progress_trackers ADD COLUMN tag_name TEXT NOT NULL DEFAULT '';

UPDATE task_progress_trackers SET tag_name = COALESCE((SELECT name FROM tags WHERE id=tag_id), tag_name);
CREATE TEMP TABLE task_progress_retained_trackers AS SELECT * FROM task_progress_trackers;
CREATE TEMP TABLE task_progress_retained_events AS SELECT * FROM task_progress_tracker_events;
CREATE TEMP TABLE task_progress_retained_members AS SELECT * FROM task_progress_tracker_members;
CREATE TEMP TABLE task_progress_retained_goals AS SELECT * FROM task_progress_goal_history;
CREATE TEMP TABLE task_progress_retained_milestones AS SELECT * FROM task_progress_milestone_members;
CREATE TEMP TABLE task_progress_retained_sequence AS SELECT name,seq FROM sqlite_sequence WHERE name='task_progress_trackers';
DROP TABLE task_progress_trackers;

CREATE TABLE IF NOT EXISTS task_progress_trackers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  goal INTEGER NOT NULL,
  goal_per_day INTEGER CHECK(goal_per_day IS NULL OR goal_per_day > 0),
  tag_id INTEGER,
  tag_name TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  is_working_on BOOLEAN NOT NULL DEFAULT 0,
  started_on TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED', 'DELETED')),
  item_types TEXT NOT NULL DEFAULT 'scene,scene_marker,image,gallery,performer,studio,group',
  history_started_on TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL DEFAULT 'BACKLOG' CHECK(mode IN ('FIXED', 'BACKLOG')),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE SET NULL,
  CHECK(goal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_task_progress_trackers_position
  ON task_progress_trackers(position, id);

CREATE INDEX IF NOT EXISTS idx_task_progress_trackers_tag_id
  ON task_progress_trackers(tag_id);

INSERT INTO task_progress_trackers(id,title,description,goal,goal_per_day,tag_id,tag_name,position,is_working_on,started_on,status,item_types,history_started_on,mode,version,created_at,updated_at)
SELECT id,title,description,goal,goal_per_day,tag_id,tag_name,position,is_working_on,started_on,status,item_types,history_started_on,mode,version,created_at,updated_at FROM task_progress_retained_trackers;
INSERT OR IGNORE INTO task_progress_tracker_events SELECT * FROM task_progress_retained_events;
INSERT OR IGNORE INTO task_progress_tracker_members SELECT * FROM task_progress_retained_members;
INSERT OR IGNORE INTO task_progress_goal_history SELECT * FROM task_progress_retained_goals;
INSERT OR IGNORE INTO task_progress_milestone_members SELECT * FROM task_progress_retained_milestones;
UPDATE sqlite_sequence SET seq = MAX(seq, COALESCE((SELECT seq FROM task_progress_retained_sequence), seq)) WHERE name='task_progress_trackers';
INSERT INTO sqlite_sequence SELECT name,seq FROM task_progress_retained_sequence WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name='task_progress_trackers');
DROP TABLE task_progress_retained_trackers;
DROP TABLE task_progress_retained_events;
DROP TABLE task_progress_retained_members;
DROP TABLE task_progress_retained_goals;
DROP TABLE task_progress_retained_milestones;
DROP TABLE task_progress_retained_sequence;

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

CREATE TRIGGER IF NOT EXISTS task_progress_tracker_tag_snapshot_insert
AFTER INSERT ON task_progress_trackers
BEGIN
 UPDATE task_progress_trackers SET tag_name = COALESCE((SELECT name FROM tags WHERE id = NEW.tag_id), NEW.tag_name) WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS task_progress_tracker_tag_snapshot_update
AFTER UPDATE OF tag_id ON task_progress_trackers WHEN NEW.tag_id IS NOT NULL
BEGIN
 UPDATE task_progress_trackers SET tag_name = COALESCE((SELECT name FROM tags WHERE id = NEW.tag_id), NEW.tag_name) WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS task_progress_tracker_tag_delete
BEFORE DELETE ON tags
BEGIN
 UPDATE task_progress_trackers
 SET tag_name = COALESCE(OLD.name, tag_name),
     status = CASE WHEN status IN ('ACTIVE', 'PAUSED') THEN 'ARCHIVED' ELSE status END,
     is_working_on = 0, version = version + 1, updated_at = CURRENT_TIMESTAMP
 WHERE tag_id = OLD.id;
END;
COMMIT;
