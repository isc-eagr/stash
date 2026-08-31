package sqlite

import "fmt"

// CUSTOM: Sort scenes by their stored GOAT element bonus, treating no bonus as zero.
func (qb *SceneStore) sortByGoatElementBonusCustom(direction string) string {
	return fmt.Sprintf(` ORDER BY COALESCE((
		SELECT goat_bonus.raw_value
		FROM %s goat_bonus
		WHERE goat_bonus.entity_type = 'scene'
			AND goat_bonus.entity_id = %s.id
			AND goat_bonus.key = 'goatElement'
	), 0) %s`, ratingBonusScoresTable, sceneTable, getSortDirection(direction))
}
