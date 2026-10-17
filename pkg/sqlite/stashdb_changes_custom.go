package sqlite

// CUSTOM: Storage for the StashDB Changes report: the latest check of each
// kind (scenes, performers) and the entities that differ from StashDB.

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/stashapp/stash/pkg/models"
)

const stashDBChangesSchemaCustom = `
CREATE TABLE IF NOT EXISTS stashdb_changes_runs (
  kind TEXT PRIMARY KEY CHECK(kind IN ('scene', 'performer')),
  started_at DATETIME NOT NULL,
  finished_at DATETIME NOT NULL,
  endpoint TEXT NOT NULL,
  checked INTEGER NOT NULL,
  failed INTEGER NOT NULL,
  cancelled BOOLEAN NOT NULL
);
-- fields is a JSON array of field differences.
CREATE TABLE IF NOT EXISTS stashdb_changes_entries (
  kind TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  stash_id TEXT NOT NULL,
  status TEXT NOT NULL,
  merged_into_id TEXT,
  fields TEXT NOT NULL,
  PRIMARY KEY(kind, entity_id, stash_id),
  FOREIGN KEY(kind) REFERENCES stashdb_changes_runs(kind) ON DELETE CASCADE
);
`

func (db *Database) ensureStashDBChangesSchemaCustom(ctx context.Context) error {
	if _, err := db.writeDB.ExecContext(ctx, stashDBChangesSchemaCustom); err != nil {
		return fmt.Errorf("creating StashDB changes schema: %w", err)
	}
	return nil
}

type StashDBChangesStoreCustom struct{}

var stashDBChangesTargetQueriesCustom = map[models.StashDBChangesKindCustom]string{
	models.StashDBChangesKindSceneCustom:     `SELECT scene_id AS id, stash_id FROM scene_stash_ids WHERE endpoint = ? ORDER BY scene_id, stash_id`,
	models.StashDBChangesKindPerformerCustom: `SELECT performer_id AS id, stash_id FROM performer_stash_ids WHERE endpoint = ? ORDER BY performer_id, stash_id`,
}

var stashDBChangesEntityTablesCustom = map[models.StashDBChangesKindCustom]string{
	models.StashDBChangesKindSceneCustom:     "scenes",
	models.StashDBChangesKindPerformerCustom: "performers",
}

// Targets lists every scene or performer link to endpoint.
func (StashDBChangesStoreCustom) Targets(ctx context.Context, kind models.StashDBChangesKindCustom, endpoint string) ([]models.StashDBChangesTargetCustom, error) {
	query, ok := stashDBChangesTargetQueriesCustom[kind]
	if !ok {
		return nil, fmt.Errorf("unknown StashDB changes kind %q", kind)
	}
	var ret []models.StashDBChangesTargetCustom
	err := dbWrapper.Select(ctx, &ret, query, endpoint)
	return ret, err
}

// SaveRun replaces the previous report of the run's kind.
func (StashDBChangesStoreCustom) SaveRun(ctx context.Context, run models.StashDBChangesRunCustom) error {
	if _, err := dbWrapper.Exec(ctx, `DELETE FROM stashdb_changes_entries WHERE kind = ?`, run.Kind); err != nil {
		return err
	}
	if _, err := dbWrapper.Exec(ctx, `
INSERT OR REPLACE INTO stashdb_changes_runs (kind, started_at, finished_at, endpoint, checked, failed, cancelled)
VALUES (?, ?, ?, ?, ?, ?, ?)`,
		run.Kind, run.StartedAt, run.FinishedAt, run.Endpoint, run.Checked, run.Failed, run.Cancelled); err != nil {
		return err
	}
	for _, change := range run.Changes {
		fields, err := json.Marshal(change.Fields)
		if err != nil {
			return err
		}
		if _, err := dbWrapper.Exec(ctx, `
INSERT INTO stashdb_changes_entries (kind, entity_id, stash_id, status, merged_into_id, fields)
VALUES (?, ?, ?, ?, ?, ?)`,
			run.Kind, change.ID, change.StashID, change.Status, change.MergedIntoID, string(fields)); err != nil {
			return err
		}
	}
	return nil
}

// GetRun returns nil before the first check of kind. Entities deleted locally
// since the check are left out.
func (StashDBChangesStoreCustom) GetRun(ctx context.Context, kind models.StashDBChangesKindCustom) (*models.StashDBChangesRunCustom, error) {
	table, ok := stashDBChangesEntityTablesCustom[kind]
	if !ok {
		return nil, fmt.Errorf("unknown StashDB changes kind %q", kind)
	}
	var row struct {
		StartedAt  time.Time `db:"started_at"`
		FinishedAt time.Time `db:"finished_at"`
		Endpoint   string    `db:"endpoint"`
		Checked    int       `db:"checked"`
		Failed     int       `db:"failed"`
		Cancelled  bool      `db:"cancelled"`
	}
	err := dbWrapper.Get(ctx, &row, `
SELECT started_at, finished_at, endpoint, checked, failed, cancelled FROM stashdb_changes_runs WHERE kind = ?`, kind)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	var entries []stashDBChangesEntryRowCustom
	if err := dbWrapper.Select(ctx, &entries, `
SELECT e.entity_id, e.stash_id, e.status, e.merged_into_id, e.fields FROM stashdb_changes_entries e
 WHERE e.kind = ? AND EXISTS (SELECT 1 FROM `+table+` x WHERE x.id = e.entity_id)
 ORDER BY e.entity_id, e.stash_id`, kind); err != nil {
		return nil, err
	}

	run := &models.StashDBChangesRunCustom{
		Kind:       kind,
		StartedAt:  row.StartedAt,
		FinishedAt: row.FinishedAt,
		Endpoint:   row.Endpoint,
		Checked:    row.Checked,
		Failed:     row.Failed,
		Cancelled:  row.Cancelled,
		Changes:    make([]models.StashDBChangeCustom, len(entries)),
	}
	for i, entry := range entries {
		change, err := entry.change(kind)
		if err != nil {
			return nil, err
		}
		run.Changes[i] = change
	}
	return run, nil
}

type stashDBChangesEntryRowCustom struct {
	ID           int     `db:"entity_id"`
	StashID      string  `db:"stash_id"`
	Status       string  `db:"status"`
	MergedIntoID *string `db:"merged_into_id"`
	Fields       string  `db:"fields"`
}

func (e stashDBChangesEntryRowCustom) change(kind models.StashDBChangesKindCustom) (models.StashDBChangeCustom, error) {
	change := models.StashDBChangeCustom{
		ID:           e.ID,
		StashID:      e.StashID,
		Status:       models.StashDBChangeStatusCustom(e.Status),
		MergedIntoID: e.MergedIntoID,
	}
	if err := json.Unmarshal([]byte(e.Fields), &change.Fields); err != nil {
		return change, fmt.Errorf("reading StashDB changes for %s %d: %w", kind, e.ID, err)
	}
	return change, nil
}

// GetChange returns one entry of the latest check of kind and that check's
// endpoint, or nil when the entry is not in the report.
func (StashDBChangesStoreCustom) GetChange(ctx context.Context, kind models.StashDBChangesKindCustom, id int, stashID string) (*models.StashDBChangeCustom, string, error) {
	var row struct {
		stashDBChangesEntryRowCustom
		Endpoint string `db:"endpoint"`
	}
	err := dbWrapper.Get(ctx, &row, `
SELECT e.entity_id, e.stash_id, e.status, e.merged_into_id, e.fields, r.endpoint FROM stashdb_changes_entries e
 JOIN stashdb_changes_runs r ON r.kind = e.kind
 WHERE e.kind = ? AND e.entity_id = ? AND e.stash_id = ?`, kind, id, stashID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, "", nil
	}
	if err != nil {
		return nil, "", err
	}
	change, err := row.change(kind)
	if err != nil {
		return nil, "", err
	}
	return &change, row.Endpoint, nil
}

// UpdateChangeFields replaces an entry's field differences after some were
// applied. A changed entry with none left drops out of the report.
func (StashDBChangesStoreCustom) UpdateChangeFields(ctx context.Context, kind models.StashDBChangesKindCustom, change models.StashDBChangeCustom) error {
	if change.Status == models.StashDBChangeStatusChangedCustom && len(change.Fields) == 0 {
		_, err := dbWrapper.Exec(ctx, `DELETE FROM stashdb_changes_entries WHERE kind = ? AND entity_id = ? AND stash_id = ?`,
			kind, change.ID, change.StashID)
		return err
	}
	fields, err := json.Marshal(change.Fields)
	if err != nil {
		return err
	}
	_, err = dbWrapper.Exec(ctx, `UPDATE stashdb_changes_entries SET fields = ? WHERE kind = ? AND entity_id = ? AND stash_id = ?`,
		string(fields), kind, change.ID, change.StashID)
	return err
}
