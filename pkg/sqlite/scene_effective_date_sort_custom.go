package sqlite

import "fmt"

// Aggregate release dates once rather than repeating the same correlated MIN
// up to three times per scene. The sort-only join is omitted from count queries.
func (qb *SceneStore) sortByEffectiveDateCustom(query *queryBuilder, direction string) string {
	query.joinSort("(SELECT scene_id, MIN(date) AS date FROM scene_releases GROUP BY scene_id)",
		"scene_sort_release_dates_custom", "scene_sort_release_dates_custom.scene_id = scenes.id")
	return fmt.Sprintf(` ORDER BY CASE
WHEN scenes.date IS NULL THEN scene_sort_release_dates_custom.date
WHEN scene_sort_release_dates_custom.date IS NULL THEN scenes.date
ELSE MIN(scenes.date, scene_sort_release_dates_custom.date) END %s`, getSortDirection(direction))
}
