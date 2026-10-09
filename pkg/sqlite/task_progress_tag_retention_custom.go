package sqlite

import (
	"context"
	"fmt"

	"github.com/jmoiron/sqlx"
)

const taskProgressTagRetentionTriggersCustom = `
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
END;`

// Rebuild only the custom parent table, retaining its dependent rows inside the
// same transaction. Foreign keys stay enabled; their cascades are restored from
// temporary snapshots before commit. Explicit column lists support old layouts.
func ensureTaskProgressTagRetentionCustom(ctx context.Context, tx *sqlx.Tx) error {
	var retained bool
	if err := tx.GetContext(ctx, &retained, `SELECT EXISTS(SELECT 1 FROM pragma_foreign_key_list('task_progress_trackers') WHERE "from"='tag_id' AND on_delete='SET NULL')`); err != nil {
		return err
	}
	if !retained {
		if _, err := tx.ExecContext(ctx, `
UPDATE task_progress_trackers SET tag_name = COALESCE((SELECT name FROM tags WHERE id=tag_id), tag_name);
CREATE TEMP TABLE task_progress_retained_trackers AS SELECT * FROM task_progress_trackers;
CREATE TEMP TABLE task_progress_retained_events AS SELECT * FROM task_progress_tracker_events;
CREATE TEMP TABLE task_progress_retained_members AS SELECT * FROM task_progress_tracker_members;
CREATE TEMP TABLE task_progress_retained_goals AS SELECT * FROM task_progress_goal_history;
CREATE TEMP TABLE task_progress_retained_milestones AS SELECT * FROM task_progress_milestone_members;
CREATE TEMP TABLE task_progress_retained_sequence AS SELECT name,seq FROM sqlite_sequence WHERE name='task_progress_trackers';
DROP TABLE task_progress_trackers;
`); err != nil {
			return fmt.Errorf("snapshotting tracker tag migration: %w", err)
		}
		if _, err := tx.ExecContext(ctx, taskProgressTrackerTableSchemaCustom); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `
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
`); err != nil {
			return fmt.Errorf("restoring tracker tag migration: %w", err)
		}
		// DROP TABLE also removes its goal-history cleanup trigger.
		if _, err := tx.ExecContext(ctx, taskProgressGoalHistoryTableSchemaCustom); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx, taskProgressTagRetentionTriggersCustom); err != nil {
		return fmt.Errorf("preserving tracker tags: %w", err)
	}
	return nil
}
