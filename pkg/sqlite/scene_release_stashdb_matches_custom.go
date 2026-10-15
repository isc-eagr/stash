package sqlite

// CUSTOM: StashDB Matches for releases. A release keeps the count of its own
// StashDB link, so conversions carry it and the refresh task updates it.

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/stashbox"
)

const sceneReleaseStashDBMatchesSchemaCustom = `
CREATE TABLE IF NOT EXISTS scene_release_stashdb_matches (
  release_id INTEGER PRIMARY KEY,
  matches INTEGER NOT NULL CHECK(matches >= 0),
  FOREIGN KEY(release_id) REFERENCES scene_releases(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS stashdb_matches_refresh_release_changes (
  release_id INTEGER PRIMARY KEY,
  previous INTEGER,
  current INTEGER NOT NULL,
  FOREIGN KEY(release_id) REFERENCES scene_releases(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS stashdb_matches_refresh_release_unsubmitted (
  release_id INTEGER PRIMARY KEY,
  stash_id TEXT NOT NULL,
  matches INTEGER NOT NULL CHECK(matches >= 0),
  FOREIGN KEY(release_id) REFERENCES scene_releases(id) ON DELETE CASCADE
);
`

// ensureReleaseStashDBMatchesSchemaCustom runs at startup once the standalone
// release tables exist.
func (db *Database) ensureReleaseStashDBMatchesSchemaCustom(ctx context.Context) error {
	var releases int
	if err := db.writeDB.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'scene_releases'`).Scan(&releases); err != nil {
		return err
	}
	if releases == 0 {
		return nil
	}
	if _, err := db.writeDB.ExecContext(ctx, sceneReleaseStashDBMatchesSchemaCustom); err != nil {
		return fmt.Errorf("creating release StashDB matches schema: %w", err)
	}
	return nil
}

// releaseStashDBMatchesReadyCustom reports whether releases can carry Stash IDs
// and counts on this database.
func releaseStashDBMatchesReadyCustom(ctx context.Context) (bool, error) {
	for _, table := range []string{"scene_release_stash_ids", "scene_release_stashdb_matches"} {
		exists, err := releaseTransferTableExistsCustom(ctx, table)
		if err != nil || !exists {
			return false, err
		}
	}
	return true, nil
}

// GetStashDBMatchesCustom returns nil when the release has no stored count.
func (qb *SceneReleaseStore) GetStashDBMatchesCustom(ctx context.Context, releaseID int) (*int, error) {
	ready, err := releaseStashDBMatchesReadyCustom(ctx)
	if err != nil || !ready {
		return nil, err
	}
	var matches int
	err = dbWrapper.Get(ctx, &matches, `SELECT matches FROM scene_release_stashdb_matches WHERE release_id = ?`, releaseID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &matches, nil
}

// SetStashDBMatchesCustom stores the count, or clears it when matches is nil.
func (qb *SceneReleaseStore) SetStashDBMatchesCustom(ctx context.Context, releaseID int, matches *int) error {
	if matches == nil {
		_, err := dbWrapper.Exec(ctx, `DELETE FROM scene_release_stashdb_matches WHERE release_id = ?`, releaseID)
		return err
	}
	if *matches < 0 {
		return fmt.Errorf("StashDB matches must not be negative: %d", *matches)
	}
	_, err := dbWrapper.Exec(ctx, `
INSERT INTO scene_release_stashdb_matches (release_id, matches) VALUES (?, ?)
ON CONFLICT(release_id) DO UPDATE SET matches = excluded.matches`, releaseID, *matches)
	return err
}

// resetReleaseStashDBMatchesCustom follows the scene rule: removing or
// replacing a StashDB link resets the stored count to 0.
func resetReleaseStashDBMatchesCustom(ctx context.Context, releaseID int, before, after []models.StashID) error {
	ready, err := releaseStashDBMatchesReadyCustom(ctx)
	if err != nil || !ready {
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
			return (&SceneReleaseStore{}).SetStashDBMatchesCustom(ctx, releaseID, &zero)
		}
	}
	return nil
}
