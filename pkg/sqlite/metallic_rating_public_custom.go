package sqlite

// CUSTOM: Statistics uses the exact same precedence, config and SQL as filters.
func PerformerMetallicTierClauseCustom(tier string) (string, []interface{}) {
	clause := (metallicRatingFilterConfig{
		primaryTable: performerTable, ratingColumn: performerTable + ".rating",
		tagJoinTable: "performers_tags", tagJoinFK: "performer_id",
		thresholds: getMetallicRatingThresholds("performer"), overrides: getMetallicRatingOverrideTags(),
	}).tierClause(tier)
	return clause.sql, clause.args
}

// CUSTOM: Scene and O statistics promote Royal Sapphire with the same bonus
// score and GOAT marker rules as the scene metallic filter and cards.
func SceneRoyalSapphirePromotionClauseCustom(sceneAlias string) (string, []interface{}) {
	return SceneRoyalSapphirePromotionClauseForGoatTagCustom(sceneAlias, getMetallicRatingOverrideTags().goat)
}

func SceneRoyalSapphirePromotionClauseForGoatTagCustom(sceneAlias string, goatTagID string) (string, []interface{}) {
	clause := (metallicRatingFilterConfig{
		primaryTable:              sceneAlias,
		includeSceneRatingBonuses: true,
		includeSceneGoatMarkers:   true,
		overrides:                 metallicRatingOverrideTags{goat: goatTagID},
	}).royalSapphirePromotionClause()
	return clause.sql, clause.args
}
