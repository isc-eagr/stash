package sqlite

import (
	"context"
	"fmt"

	"github.com/jmoiron/sqlx"
)

const (
	taskProgressHistoryMigrationCustom        = "task_progress_history_v1"
	taskProgressOverallHistoryMigrationCustom = "task_progress_overall_history_v1"
	taskProgressHistoryEpochCustom            = "2026-09-07"
)

const taskProgressTrackerTableSchemaCustom = `
CREATE TABLE IF NOT EXISTS task_progress_trackers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  goal INTEGER NOT NULL,
  goal_per_day INTEGER CHECK(goal_per_day IS NULL OR goal_per_day > 0),
  tag_id INTEGER NOT NULL,
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
  FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  CHECK(goal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_task_progress_trackers_position
  ON task_progress_trackers(position, id);

CREATE INDEX IF NOT EXISTS idx_task_progress_trackers_tag_id
  ON task_progress_trackers(tag_id);
`

const taskProgressEventTableSchemaCustom = `
CREATE TABLE IF NOT EXISTS task_progress_tracker_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracker_id INTEGER NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('BASELINE', 'COMPLETED', 'INCOMING')),
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
  state TEXT NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING', 'COMPLETED')),
  PRIMARY KEY(tracker_id, item_type, item_id),
  FOREIGN KEY(tracker_id) REFERENCES task_progress_trackers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_task_progress_tracker_members_state
  ON task_progress_tracker_members(tracker_id, state);
`

const taskProgressOverallEventTableSchemaCustom = `
CREATE TABLE IF NOT EXISTS task_progress_overall_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL CHECK(event_type IN ('BASELINE', 'COMPLETED', 'INCOMING', 'ADJUSTMENT')),
  scene_id INTEGER NOT NULL DEFAULT 0,
  occurred_on TEXT NOT NULL,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_count INTEGER NOT NULL CHECK(total_count >= 0),
  organized_count INTEGER NOT NULL CHECK(organized_count >= 0),
  remaining_count INTEGER NOT NULL CHECK(remaining_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_task_progress_overall_events_date
  ON task_progress_overall_events(occurred_on, id);
`

const taskProgressTrackerCurrentCountExpressionCustom = `
  (SELECT COUNT(DISTINCT scene_id) FROM scenes_tags WHERE tag_id = task_progress_trackers.tag_id) +
  (SELECT COUNT(*) FROM scene_markers
    WHERE primary_tag_id = task_progress_trackers.tag_id
       OR id IN (
         SELECT scene_marker_id
           FROM scene_markers_tags
          WHERE tag_id = task_progress_trackers.tag_id
       )) +
  (SELECT COUNT(DISTINCT image_id) FROM images_tags WHERE tag_id = task_progress_trackers.tag_id) +
  (SELECT COUNT(DISTINCT gallery_id) FROM galleries_tags WHERE tag_id = task_progress_trackers.tag_id) +
  (SELECT COUNT(DISTINCT performer_id) FROM performers_tags WHERE tag_id = task_progress_trackers.tag_id) +
  (SELECT COUNT(DISTINCT studio_id) FROM studios_tags WHERE tag_id = task_progress_trackers.tag_id) +
  (SELECT COUNT(DISTINCT group_id) FROM groups_tags WHERE tag_id = task_progress_trackers.tag_id)`

// ensureTaskProgressSchemaCustom installs and upgrades the task-progress schema
// independently of the upstream Stash schema version. Custom SQL migrations in
// this fork intentionally live outside the upstream migration chain.
func (db *Database) ensureTaskProgressSchemaCustom(ctx context.Context) error {
	tx, err := db.writeDB.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("starting task progress schema bootstrap: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS custom_schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)`); err != nil {
		return fmt.Errorf("creating custom schema migration registry: %w", err)
	}

	if _, err := tx.ExecContext(ctx, taskProgressTrackerTableSchemaCustom); err != nil {
		return fmt.Errorf("creating task progress tracker schema: %w", err)
	}

	if err := ensureTaskProgressTrackerColumnsCustom(ctx, tx); err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, taskProgressEventTableSchemaCustom); err != nil {
		return fmt.Errorf("creating task progress event schema: %w", err)
	}
	if _, err := tx.ExecContext(ctx, taskProgressOverallEventTableSchemaCustom); err != nil {
		return fmt.Errorf("creating overall task progress event schema: %w", err)
	}

	var applied bool
	if err := tx.GetContext(ctx, &applied,
		"SELECT EXISTS(SELECT 1 FROM custom_schema_migrations WHERE name = ?)",
		taskProgressHistoryMigrationCustom,
	); err != nil {
		return fmt.Errorf("checking task progress history bootstrap: %w", err)
	}

	if !applied {
		if err := retrofitTaskProgressHistoryCustom(ctx, tx); err != nil {
			return err
		}

		if _, err := tx.ExecContext(ctx,
			"INSERT INTO custom_schema_migrations(name) VALUES (?)",
			taskProgressHistoryMigrationCustom,
		); err != nil {
			return fmt.Errorf("recording task progress history bootstrap: %w", err)
		}
	}

	if err := ensureTaskProgressOverallHistoryCustom(ctx, tx); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing task progress schema bootstrap: %w", err)
	}

	return nil
}

func ensureTaskProgressOverallHistoryCustom(ctx context.Context, tx *sqlx.Tx) error {
	var applied bool
	if err := tx.GetContext(ctx, &applied,
		"SELECT EXISTS(SELECT 1 FROM custom_schema_migrations WHERE name = ?)",
		taskProgressOverallHistoryMigrationCustom,
	); err != nil {
		return fmt.Errorf("checking overall task progress history bootstrap: %w", err)
	}
	if applied {
		return nil
	}

	const baselineQuery = `
INSERT INTO task_progress_overall_events (
  event_type, occurred_on, occurred_at, total_count, organized_count, remaining_count
)
SELECT 'BASELINE', ?, ?, COUNT(*),
       COALESCE(SUM(CASE WHEN organized THEN 1 ELSE 0 END), 0),
       COALESCE(SUM(CASE WHEN organized THEN 0 ELSE 1 END), 0)
  FROM scenes`
	if _, err := tx.ExecContext(ctx, baselineQuery, taskProgressHistoryEpochCustom, taskProgressHistoryEpochCustom+" 00:00:00"); err != nil {
		return fmt.Errorf("creating overall task progress history baseline: %w", err)
	}
	if _, err := tx.ExecContext(ctx,
		"INSERT INTO custom_schema_migrations(name) VALUES (?)",
		taskProgressOverallHistoryMigrationCustom,
	); err != nil {
		return fmt.Errorf("recording overall task progress history bootstrap: %w", err)
	}
	return nil
}

func ensureTaskProgressTrackerColumnsCustom(ctx context.Context, tx *sqlx.Tx) error {
	rows, err := tx.QueryxContext(ctx, "PRAGMA table_info(task_progress_trackers)")
	if err != nil {
		return fmt.Errorf("reading task progress tracker columns: %w", err)
	}

	columns := make(map[string]bool)
	for rows.Next() {
		var (
			columnID  int
			name      string
			dataType  string
			notNull   int
			defaultV  interface{}
			primaryID int
		)
		if err := rows.Scan(&columnID, &name, &dataType, &notNull, &defaultV, &primaryID); err != nil {
			rows.Close()
			return fmt.Errorf("scanning task progress tracker columns: %w", err)
		}
		columns[name] = true
	}
	if err := rows.Close(); err != nil {
		return fmt.Errorf("closing task progress tracker columns: %w", err)
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterating task progress tracker columns: %w", err)
	}

	additions := []struct {
		name       string
		definition string
	}{
		{"started_on", "TEXT NOT NULL DEFAULT ''"},
		{"status", "TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED', 'DELETED'))"},
		{"item_types", "TEXT NOT NULL DEFAULT 'scene,scene_marker,image,gallery,performer,studio,group'"},
		{"history_started_on", "TEXT NOT NULL DEFAULT ''"},
		{"mode", "TEXT NOT NULL DEFAULT 'BACKLOG' CHECK(mode IN ('FIXED', 'BACKLOG'))"},
		{"version", "INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1)"},
		{"goal_per_day", "INTEGER CHECK(goal_per_day IS NULL OR goal_per_day > 0)"},
	}

	for _, addition := range additions {
		if columns[addition.name] {
			continue
		}
		query := fmt.Sprintf("ALTER TABLE task_progress_trackers ADD COLUMN %s %s", addition.name, addition.definition)
		if _, err := tx.ExecContext(ctx, query); err != nil {
			return fmt.Errorf("adding task progress tracker column %s: %w", addition.name, err)
		}
	}

	if columns["items_per_day"] {
		if _, err := tx.ExecContext(ctx, "ALTER TABLE task_progress_trackers DROP COLUMN items_per_day"); err != nil {
			return fmt.Errorf("removing obsolete task progress tracker items_per_day column: %w", err)
		}
	}

	return nil
}

func retrofitTaskProgressHistoryCustom(ctx context.Context, tx *sqlx.Tx) error {
	updateQuery := fmt.Sprintf(`
UPDATE task_progress_trackers
   SET started_on = ?,
       history_started_on = ?,
       status = 'ACTIVE',
       goal = %s,
       updated_at = CURRENT_TIMESTAMP`, taskProgressTrackerCurrentCountExpressionCustom)
	if _, err := tx.ExecContext(ctx, updateQuery, taskProgressHistoryEpochCustom, taskProgressHistoryEpochCustom); err != nil {
		return fmt.Errorf("retrofitting task progress trackers: %w", err)
	}

	baselineQuery := fmt.Sprintf(`
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
       ?,
       ?,
       %s,
       tag_id
  FROM task_progress_trackers`, taskProgressTrackerCurrentCountExpressionCustom)
	if _, err := tx.ExecContext(ctx, baselineQuery, taskProgressHistoryEpochCustom, taskProgressHistoryEpochCustom+" 00:00:00"); err != nil {
		return fmt.Errorf("creating task progress history baselines: %w", err)
	}

	return nil
}
