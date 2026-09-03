package sqlite

import (
	"fmt"
	"strings"
)

// CUSTOM: Studio-list metallic scene-count sorts and exact values for sort
// metrics that are not already part of the batched StudioListStats payload.
var studioMetallicSceneSortKeysCustom = map[string]string{
	"royal_sapphire_scenes_count": metallicTierRoyalSapphire,
	"gold_scenes_count":           metallicTierGold,
	"silver_scenes_count":         metallicTierSilver,
	"bronze_scenes_count":         metallicTierBronze,
}

func studioSortSQLLiteralCustom(value interface{}) string {
	switch typed := value.(type) {
	case string:
		return "'" + strings.ReplaceAll(typed, "'", "''") + "'"
	case []byte:
		return "'" + strings.ReplaceAll(string(typed), "'", "''") + "'"
	default:
		return fmt.Sprint(typed)
	}
}

func studioSortRenderClauseCustom(clause sqlClause) string {
	ret := clause.sql
	for _, arg := range clause.args {
		ret = strings.Replace(ret, "?", studioSortSQLLiteralCustom(arg), 1)
	}
	return ret
}

func studioMetallicSceneCountExprForConfigCustom(tier string, cfg metallicRatingFilterConfig) string {
	tierClause := studioSortRenderClauseCustom(cfg.tierClause(tier))
	return fmt.Sprintf(`(
	SELECT COUNT(*)
	FROM scenes studio_metallic_scene
	WHERE studio_metallic_scene.studio_id = studios.id
		AND (%s)
)`, tierClause)
}

func studioMetallicSceneCountExprCustom(tier string) string {
	return studioMetallicSceneCountExprForConfigCustom(tier, metallicRatingFilterConfig{
		primaryTable:              "studio_metallic_scene",
		ratingColumn:              "studio_metallic_scene.rating",
		tagJoinTable:              "scenes_tags",
		tagJoinFK:                 "scene_id",
		includeSceneRatingBonuses: true,
		thresholds:                getMetallicRatingThresholds("scene"),
		overrides:                 getMetallicRatingOverrideTags(),
	})
}

func (qb *StudioStore) sortByMetallicSceneCountCustom(tier string, direction string) string {
	return studioSortMetricOrderClauseCustom(studioMetallicSceneCountExprCustom(tier), direction)
}

func studioSortMetricOrderClauseCustom(expression string, direction string) string {
	return fmt.Sprintf(" ORDER BY %s %s", expression, getSortDirection(direction))
}

func studioScenesDurationExprCustom() string {
	return fmt.Sprintf(`(
	SELECT COALESCE(SUM(video_files.duration), 0)
	FROM %s
	LEFT JOIN %s ON %s.%s = %s.id
	LEFT JOIN video_files ON video_files.file_id = %s.file_id
	WHERE %s.%s = %s.id
)`, sceneTable, scenesFilesTable, scenesFilesTable, sceneIDColumn, sceneTable, scenesFilesTable, sceneTable, studioIDColumn, studioTable)
}

func studioScenesSizeExprCustom() string {
	return fmt.Sprintf(`(
	SELECT COALESCE(SUM(%s.size), 0)
	FROM %s
	LEFT JOIN %s ON %s.%s = %s.id
	LEFT JOIN %s ON %s.id = %s.file_id
	WHERE %s.%s = %s.id
)`, fileTable, sceneTable, scenesFilesTable, scenesFilesTable, sceneIDColumn, sceneTable, fileTable, fileTable, scenesFilesTable, sceneTable, studioIDColumn, studioTable)
}

func studioOCountExprCustom() string {
	return fmt.Sprintf(`COALESCE((
	SELECT COUNT(*)
	FROM %s sod
	INNER JOIN %s s ON sod.%s = s.id
	WHERE s.%s = studios.id
), 0) + COALESCE((
	SELECT SUM(o_counter)
	FROM %s
	WHERE %s = studios.id
), 0)`, scenesODatesTable, sceneTable, sceneIDColumn, studioIDColumn, imageTable, studioIDColumn)
}

// StudioSortMetricExpressionCustom returns the same SQL expression used by a
// Studio sort when its value is not already present on the Studio card. The API
// uses it for the one active sort only.
func StudioSortMetricExpressionCustom(sort string) (string, bool) {
	if tier, ok := studioMetallicSceneSortKeysCustom[sort]; ok {
		return studioMetallicSceneCountExprCustom(tier), true
	}
	if variant, ok := studioFacialMarkerSortKeysCustom[sort]; ok {
		return studioFacialMarkerCountExprCustom(variant), true
	}

	switch sort {
	case "scenes_duration":
		return studioScenesDurationExprCustom(), true
	case "scenes_size":
		return studioScenesSizeExprCustom(), true
	case "latest_scene":
		return "(" + selectStudioLatestSceneSQL + ")", true
	case "created_at":
		return "studios.created_at", true
	case "updated_at":
		return "studios.updated_at", true
	case "o_count":
		return studioOCountExprCustom(), true
	}

	if ratingKey, ok := studioRatingCriteriaSortKeysCustom[sort]; ok {
		return studioRatingCriteriaAverageExprCustom(ratingKey), true
	}
	if category, ok := studioRatingAdvisorAverageSortKeysCustom[sort]; ok {
		return studioRatingAdvisorAverageExprCustom(category), true
	}

	return "", false
}
