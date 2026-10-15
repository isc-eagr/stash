package sqlite

// CUSTOM: releases inherit their parent scene's rating and Rating Advisor
// answers, so no release keeps a rating of its own.

import (
	"context"
	"fmt"
)

// clearReleaseRatingsCustom removes ratings and advisor answers stored on
// releases before ratings became scene-owned. It runs at startup and is a
// no-op once clean.
func (db *Database) clearReleaseRatingsCustom(ctx context.Context) error {
	tableExists := func(name string) (bool, error) {
		var count int
		err := db.writeDB.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?`, name).Scan(&count)
		return count == 1, err
	}
	for _, table := range []string{ratingCriteriaScoresTable, ratingBonusScoresTable, ratingPenaltyScoresTable} {
		exists, err := tableExists(table)
		if err != nil {
			return err
		}
		if exists {
			if _, err := db.writeDB.ExecContext(ctx,
				fmt.Sprintf(`DELETE FROM %s WHERE entity_type = 'scene_release'`, table)); err != nil {
				return fmt.Errorf("clearing release %s: %w", table, err)
			}
		}
	}
	exists, err := tableExists("scene_release_metadata")
	if err != nil || !exists {
		return err
	}
	if _, err := db.writeDB.ExecContext(ctx,
		`UPDATE scene_release_metadata SET rating = NULL WHERE rating IS NOT NULL`); err != nil {
		return fmt.Errorf("clearing release ratings: %w", err)
	}
	return nil
}
