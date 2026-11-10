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
	for _, table := range []string{ratingCriteriaScoresTable, ratingBonusScoresTable, ratingPenaltyScoresTable} {
		if _, err := db.writeDB.ExecContext(ctx,
			fmt.Sprintf(`DELETE FROM %s WHERE entity_type = 'scene_release'`, table)); err != nil {
			return fmt.Errorf("clearing release %s: %w", table, err)
		}
	}
	if _, err := db.writeDB.ExecContext(ctx,
		`UPDATE scene_release_metadata SET rating = NULL WHERE rating IS NOT NULL`); err != nil {
		return fmt.Errorf("clearing release ratings: %w", err)
	}
	return nil
}
