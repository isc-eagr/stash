package sqlite

// CUSTOM: StashDB Matches storage, filter, and sort. The value lives in its own
// table so upstream rebuilds of the scenes table cannot drop it.

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/stashbox"
	"github.com/stashapp/stash/pkg/txn"
)

const sceneStashDBMatchesTableCustom = "scene_stashdb_matches"

// Compare the final relationships, since SET temporarily deletes even retained
// links. Both full and partial scene updates use this path.
func (qb *SceneStore) updateStashIDsAndMatchesCustom(ctx context.Context, sceneID int, ids []models.StashID, mode models.RelationshipUpdateMode) error {
	before, err := qb.GetStashIDs(ctx, sceneID)
	if err != nil {
		return err
	}
	if err := scenesStashIDsTableMgr.modifyJoins(ctx, sceneID, ids, mode); err != nil {
		return err
	}
	after, err := qb.GetStashIDs(ctx, sceneID)
	if err != nil {
		return err
	}
	for _, old := range before {
		if !stashbox.IsStashDBEndpointCustom(old.Endpoint) {
			continue
		}
		retained := false
		for _, current := range after {
			if current.Endpoint == old.Endpoint && current.StashID == old.StashID {
				retained = true
				break
			}
		}
		if !retained {
			zero := 0
			return qb.SetStashDBMatchesCustom(ctx, sceneID, &zero)
		}
	}
	return nil
}

// Anonymisation deletes links directly rather than going through SceneStore.
func (db *Anonymiser) deleteSceneStashIDsAndMatchesCustom() error {
	return txn.WithTxn(context.Background(), db.Database, deleteSceneStashIDsAndMatchesCustom)
}

func deleteSceneStashIDsAndMatchesCustom(ctx context.Context) error {
	var links []struct {
		SceneID  int    `db:"scene_id"`
		Endpoint string `db:"endpoint"`
	}
	if err := dbWrapper.Select(ctx, &links, `SELECT DISTINCT scene_id, endpoint FROM scene_stash_ids`); err != nil {
		return err
	}
	zero := 0
	for _, link := range links {
		if stashbox.IsStashDBEndpointCustom(link.Endpoint) {
			if err := (&SceneStore{}).SetStashDBMatchesCustom(ctx, link.SceneID, &zero); err != nil {
				return err
			}
		}
	}
	_, err := dbWrapper.Exec(ctx, `DELETE FROM scene_stash_ids`)
	return err
}

const sceneStashDBMatchesSchemaCustom = `
CREATE TABLE IF NOT EXISTS scene_stashdb_matches (
  scene_id INTEGER PRIMARY KEY,
  matches INTEGER NOT NULL CHECK(matches >= 0),
  FOREIGN KEY(scene_id) REFERENCES scenes(id) ON DELETE CASCADE
);
-- Latest refresh-task run (one row) and the counts it changed.
CREATE TABLE IF NOT EXISTS stashdb_matches_refresh_report (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  started_at DATETIME NOT NULL,
  finished_at DATETIME NOT NULL,
  checked INTEGER NOT NULL,
  changed INTEGER NOT NULL,
  unchanged INTEGER NOT NULL,
  not_found INTEGER NOT NULL,
  failed INTEGER NOT NULL,
  cancelled BOOLEAN NOT NULL
);
CREATE TABLE IF NOT EXISTS stashdb_matches_refresh_changes (
  scene_id INTEGER PRIMARY KEY,
  previous INTEGER,
  current INTEGER NOT NULL,
  FOREIGN KEY(scene_id) REFERENCES scenes(id) ON DELETE CASCADE
);
-- Separate tables preserve compatibility with reports from older versions.
CREATE TABLE IF NOT EXISTS stashdb_matches_refresh_submission_check (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  endpoint TEXT NOT NULL,
  FOREIGN KEY(id) REFERENCES stashdb_matches_refresh_report(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS stashdb_matches_refresh_unsubmitted (
  scene_id INTEGER PRIMARY KEY,
  stash_id TEXT NOT NULL,
  matches INTEGER NOT NULL CHECK(matches >= 0),
  FOREIGN KEY(scene_id) REFERENCES scenes(id) ON DELETE CASCADE
);
`

func (db *Database) ensureSceneStashDBMatchesSchemaCustom(ctx context.Context) error {
	if _, err := db.writeDB.ExecContext(ctx, sceneStashDBMatchesSchemaCustom); err != nil {
		return fmt.Errorf("creating scene StashDB matches schema: %w", err)
	}
	return nil
}

// GetStashDBMatchesCustom returns nil when the scene has never been scraped
// from StashDB.
func (qb *SceneStore) GetStashDBMatchesCustom(ctx context.Context, sceneID int) (*int, error) {
	var matches int
	err := dbWrapper.Get(ctx, &matches, `SELECT matches FROM scene_stashdb_matches WHERE scene_id = ?`, sceneID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &matches, nil
}

// SetStashDBMatchesCustom stores the count, or clears it when matches is nil.
func (qb *SceneStore) SetStashDBMatchesCustom(ctx context.Context, sceneID int, matches *int) error {
	if matches == nil {
		_, err := dbWrapper.Exec(ctx, `DELETE FROM scene_stashdb_matches WHERE scene_id = ?`, sceneID)
		return err
	}
	if *matches < 0 {
		return fmt.Errorf("StashDB matches must not be negative: %d", *matches)
	}
	_, err := dbWrapper.Exec(ctx, `
INSERT INTO scene_stashdb_matches (scene_id, matches) VALUES (?, ?)
ON CONFLICT(scene_id) DO UPDATE SET matches = excluded.matches`, sceneID, *matches)
	return err
}

// FindStashDBMatchTargetsCustom lists every scene linked to endpoint with its
// stored count, ordered by scene.
func (qb *SceneStore) FindStashDBMatchTargetsCustom(ctx context.Context, endpoint string) ([]models.StashDBMatchTargetCustom, error) {
	var ret []models.StashDBMatchTargetCustom
	err := dbWrapper.Select(ctx, &ret, `
SELECT s.scene_id, s.stash_id, m.matches
  FROM scene_stash_ids s
  LEFT JOIN scene_stashdb_matches m ON m.scene_id = s.scene_id
 WHERE s.endpoint = ?
 ORDER BY s.scene_id`, endpoint)
	return ret, err
}

// SaveStashDBMatchesReportCustom replaces the previous run's report.
func (qb *SceneStore) SaveStashDBMatchesReportCustom(ctx context.Context, report models.StashDBMatchesReportCustom) error {
	if _, err := dbWrapper.Exec(ctx, `DELETE FROM stashdb_matches_refresh_submission_check`); err != nil {
		return err
	}
	if _, err := dbWrapper.Exec(ctx, `DELETE FROM stashdb_matches_refresh_unsubmitted`); err != nil {
		return err
	}
	if _, err := dbWrapper.Exec(ctx, `DELETE FROM stashdb_matches_refresh_changes`); err != nil {
		return err
	}
	if _, err := dbWrapper.Exec(ctx, `
INSERT OR REPLACE INTO stashdb_matches_refresh_report
  (id, started_at, finished_at, checked, changed, unchanged, not_found, failed, cancelled)
VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
		report.StartedAt, report.FinishedAt, report.Checked, report.Changed, report.Unchanged,
		report.NotFound, report.Failed, report.Cancelled); err != nil {
		return err
	}
	for _, change := range report.Changes {
		if _, err := dbWrapper.Exec(ctx, `
INSERT INTO stashdb_matches_refresh_changes (scene_id, previous, current) VALUES (?, ?, ?)`,
			change.SceneID, change.Previous, change.Current); err != nil {
			return err
		}
	}
	if report.Endpoint != nil {
		if _, err := dbWrapper.Exec(ctx, `INSERT INTO stashdb_matches_refresh_submission_check (id, endpoint) VALUES (1, ?)`, *report.Endpoint); err != nil {
			return err
		}
	}
	for _, scene := range report.Unsubmitted {
		if _, err := dbWrapper.Exec(ctx, `
INSERT INTO stashdb_matches_refresh_unsubmitted (scene_id, stash_id, matches) VALUES (?, ?, ?)`,
			scene.SceneID, scene.StashID, scene.Matches); err != nil {
			return err
		}
	}
	return nil
}

// GetStashDBMatchesReportCustom returns nil before the first refresh. Changes
// for scenes deleted since the run are gone with their scene.
func (qb *SceneStore) GetStashDBMatchesReportCustom(ctx context.Context) (*models.StashDBMatchesReportCustom, error) {
	var report models.StashDBMatchesReportCustom
	err := dbWrapper.Get(ctx, &report, `
SELECT started_at, finished_at, checked, changed, unchanged, not_found, failed, cancelled
  FROM stashdb_matches_refresh_report WHERE id = 1`)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if err := dbWrapper.Select(ctx, &report.Changes, `
SELECT scene_id, previous, current FROM stashdb_matches_refresh_changes ORDER BY scene_id`); err != nil {
		return nil, err
	}
	var endpoint string
	if err := dbWrapper.Get(ctx, &endpoint, `SELECT endpoint FROM stashdb_matches_refresh_submission_check WHERE id = 1`); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	} else if err == nil {
		report.Endpoint = &endpoint
	}
	if err := dbWrapper.Select(ctx, &report.Unsubmitted, `
SELECT scene_id, stash_id, matches FROM stashdb_matches_refresh_unsubmitted ORDER BY scene_id`); err != nil {
		return nil, err
	}
	return &report, nil
}

func (qb *sceneFilterHandler) stashDBMatchesCriterionHandlerCustom(c *models.IntCriterionInput) criterionHandlerFunc {
	return intCriterionHandler(c, "scene_stashdb_matches.matches", func(f *filterBuilder) {
		f.addLeftJoin(sceneStashDBMatchesTableCustom, "", "scene_stashdb_matches.scene_id = scenes.id")
	})
}

// Unscraped scenes sort last in both directions.
func (qb *SceneStore) sortByStashDBMatchesCustom(query *queryBuilder, direction string) string {
	query.joinSort(sceneStashDBMatchesTableCustom, "scene_sort_stashdb_matches_custom",
		"scene_sort_stashdb_matches_custom.scene_id = scenes.id")
	return " ORDER BY scene_sort_stashdb_matches_custom.matches IS NULL, scene_sort_stashdb_matches_custom.matches " +
		getSortDirection(direction)
}
