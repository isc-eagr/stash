package sqlite

import (
	"context"
	"database/sql"
	"fmt"
)

type oRatingAdjustmentTargetCustom struct {
	EntityType string        `db:"entity_type"`
	EntityID   int           `db:"entity_id"`
	OCount     int           `db:"o_count"`
	Rating     sql.NullInt64 `db:"rating"`
}

func oRatingBonusDeltaCustom(entityType string, previousCount, updatedCount int) int {
	return calculateOrgasmRatingBonus(entityType, updatedCount) - calculateOrgasmRatingBonus(entityType, previousCount)
}

func (s *RatingScoreStore) AdjustRatingsForSceneOCountChangeCustom(ctx context.Context, sceneID int, previousCount int, updatedCount int) error {
	countDelta := updatedCount - previousCount
	if countDelta == 0 {
		return nil
	}

	query := fmt.Sprintf(`
		WITH affected(entity_type, entity_id, o_count, rating) AS (
			SELECT 'scene', ?, ?, (SELECT rating FROM %s WHERE id = ?)
			UNION ALL
			SELECT DISTINCT 'performer', target.%s,
				(
					SELECT COUNT(sod.%s)
					FROM %s all_scenes
					LEFT JOIN %s sod ON sod.%s = all_scenes.%s
					WHERE all_scenes.%s = target.%s
				),
				(SELECT rating FROM %s WHERE id = target.%s)
			FROM %s target
			WHERE target.%s = ?
		)
		SELECT entity_type, entity_id, o_count, rating
		FROM affected
		WHERE EXISTS (
			SELECT 1 FROM %s scores
			WHERE scores.entity_type = affected.entity_type AND scores.entity_id = affected.entity_id
		)
		OR EXISTS (
			SELECT 1 FROM %s scores
			WHERE scores.entity_type = affected.entity_type AND scores.entity_id = affected.entity_id
			AND (scores.raw_value != 0 OR scores.weighted_value != 0)
		)
		OR EXISTS (
			SELECT 1 FROM %s scores
			WHERE scores.entity_type = affected.entity_type AND scores.entity_id = affected.entity_id
			AND (scores.raw_value != 0 OR scores.weighted_value != 0)
		)
	`,
		sceneTable,
		performerIDColumn,
		sceneODateColumn,
		performersScenesTable,
		scenesODatesTable, sceneIDColumn, sceneIDColumn,
		performerIDColumn, performerIDColumn,
		performerTable, performerIDColumn,
		performersScenesTable, sceneIDColumn,
		ratingCriteriaScoresTable,
		ratingBonusScoresTable,
		ratingPenaltyScoresTable,
	)

	var targets []oRatingAdjustmentTargetCustom
	if err := dbWrapper.Select(ctx, &targets, query, sceneID, updatedCount, sceneID, sceneID); err != nil {
		return fmt.Errorf("finding O-rating adjustment targets for scene %d: %w", sceneID, err)
	}

	for _, target := range targets {
		previousEntityCount := target.OCount - countDelta
		if previousEntityCount < 0 {
			previousEntityCount = 0
		}
		delta := oRatingBonusDeltaCustom(target.EntityType, previousEntityCount, target.OCount)
		if delta == 0 {
			continue
		}

		if !target.Rating.Valid {
			if _, err := s.RecalculateRating(ctx, target.EntityType, target.EntityID); err != nil {
				return err
			}
			continue
		}

		table := performerTable
		if target.EntityType == "scene" {
			table = sceneTable
		}
		if _, err := dbWrapper.Exec(ctx, fmt.Sprintf("UPDATE %s SET rating = rating + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", table), delta, target.EntityID); err != nil {
			return fmt.Errorf("adjusting O-rating bonus for %s %d: %w", target.EntityType, target.EntityID, err)
		}
	}

	return nil
}
