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
