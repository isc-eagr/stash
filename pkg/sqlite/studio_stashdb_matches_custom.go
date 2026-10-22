package sqlite

// CUSTOM: Studio-list average StashDB Matches per scene. Each scene counts its
// own matches plus its releases', as shown on the scene. Unscraped scenes are
// left out of the average; studios without any scraped scene have no value.
const studioAverageStashDBMatchesSortCustom = "average_stashdb_matches"

func studioAverageStashDBMatchesExprCustom() string {
	return `(
	SELECT AVG(` + SceneTotalStashDBMatchesSQLCustom("studio_stashdb_scene.id") + `)
	FROM scenes studio_stashdb_scene
	WHERE studio_stashdb_scene.studio_id = studios.id
)`
}

// Studios without a value sort last in both directions.
func (qb *StudioStore) sortByAverageStashDBMatchesCustom(direction string) string {
	expr := studioAverageStashDBMatchesExprCustom()
	return " ORDER BY " + expr + " IS NULL, " + expr + " " + getSortDirection(direction)
}
