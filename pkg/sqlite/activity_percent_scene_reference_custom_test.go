package sqlite

import (
	"fmt"
	"strings"
)

// Per-scene scalar activity/quality expressions. Production filters and sorts
// use the batched interval CTEs; these remain only as the reference the
// equivalence tests compare against.

func activityPercentSceneSecondsExprCustom(sceneIDExpr string, category activityPercentCategoryCustom) string {
	switch category {
	case activityPercentOtherCustom:
		return activityPercentSceneOtherSecondsExprCustom(sceneIDExpr)
	case activityPercentOutstandingCustom:
		return activityPercentSceneOutstandingSecondsExprCustom(sceneIDExpr)
	case activityPercentStandardCustom:
		return activityPercentSceneStandardSecondsExprCustom(sceneIDExpr)
	case activityPercentUnclassifiedCustom:
		return activityPercentSceneUnclassifiedSecondsExprCustom(sceneIDExpr)
	case activityPercentUnusableCustom:
		return activityPercentSceneUnusableSecondsExprCustom(sceneIDExpr)
	}

	tagID := activityPercentTagIDCustom(category)
	if tagID == 0 {
		return "0"
	}

	sourceSQL := fmt.Sprintf(`SELECT sm.scene_id, sm.seconds, sm.end_seconds
FROM scene_markers sm
WHERE sm.scene_id = %s
AND %s`, sceneIDExpr, activityPercentStrictMarkerConditionCustom("sm", tagID))

	return activityPercentMergedSecondsExprCustom(sourceSQL)
}

func activityPercentSceneAnyActivitySourceSQLCustom(sceneIDExpr string) string {
	return fmt.Sprintf(`SELECT sm.scene_id, sm.seconds, sm.end_seconds
FROM scene_markers sm
WHERE sm.scene_id = %s
AND %s`, sceneIDExpr, activityPercentStrictAnyMarkerConditionCustom("sm"))
}

func activityPercentSceneNegativeSourceSQLCustom(sceneIDExpr string) string {
	durationExpr := activityPercentSceneDurationExprCustom(sceneIDExpr)
	return fmt.Sprintf(`SELECT snm.scene_id,
MAX(0, snm.start_seconds) AS seconds,
MIN((%[2]s), snm.end_seconds) AS end_seconds
FROM scene_negative_markers snm
WHERE snm.scene_id = %[1]s
AND snm.end_seconds > snm.start_seconds`, sceneIDExpr, durationExpr)
}

func activityPercentSceneOutstandingSourceForTagIDsSQLCustom(sceneIDExpr string, tagIDs []int, goatTagID int, orgasmTagID int, reallyHotTagID int) string {
	return fmt.Sprintf(`SELECT sm.scene_id,
MAX(0, sm.seconds) AS seconds,
MIN((%[2]s), sm.end_seconds) AS end_seconds
FROM scene_markers sm
WHERE sm.scene_id = %[1]s
AND %[3]s`, sceneIDExpr, activityPercentSceneDurationExprCustom(sceneIDExpr), activityPercentOutstandingMarkerConditionForTagIDsCustom("sm", tagIDs, goatTagID, orgasmTagID, reallyHotTagID))
}

func activityPercentQualityActivitySourceSQLCustom(sceneIDExpr string) string {
	tagIDs := activityPercentConfiguredTagIDsCustom()
	if len(tagIDs) == 0 {
		return "SELECT NULL AS scene_id, 0 AS seconds, 0 AS end_seconds WHERE 0"
	}

	parts := make([]string, 0, len(tagIDs))
	for _, id := range tagIDs {
		parts = append(parts, fmt.Sprintf("%d", id))
	}

	return fmt.Sprintf(`SELECT sm.scene_id,
MAX(0, sm.seconds) AS seconds,
MIN((%[2]s), sm.end_seconds) AS end_seconds
FROM scene_markers sm
WHERE sm.scene_id = %[1]s
AND sm.primary_tag_id IN (%[3]s)
AND sm.end_seconds IS NOT NULL
AND sm.end_seconds > sm.seconds`, sceneIDExpr, activityPercentSceneDurationExprCustom(sceneIDExpr), strings.Join(parts, ","))
}

func activityPercentSceneOutstandingSecondsExprCustom(sceneIDExpr string) string {
	tags := GetRoleTagIDs()
	outstandingSourceSQL := activityPercentSceneOutstandingSourceForTagIDsSQLCustom(
		sceneIDExpr,
		activityPercentConfiguredTagIDsCustom(),
		tags.GoatTagID,
		tags.OrgasmTagID,
		tags.ReallyHotTagID,
	)
	return activityPercentOutstandingSecondsFromSourcesExprCustom(
		outstandingSourceSQL,
		activityPercentSceneNegativeSourceSQLCustom(sceneIDExpr),
	)
}

func activityPercentSceneStandardSecondsExprCustom(sceneIDExpr string) string {
	tags := GetRoleTagIDs()
	return activityPercentStandardSecondsFromSourcesExprCustom(
		activityPercentQualityActivitySourceSQLCustom(sceneIDExpr),
		activityPercentSceneOutstandingSourceForTagIDsSQLCustom(sceneIDExpr, activityPercentConfiguredTagIDsCustom(), tags.GoatTagID, tags.OrgasmTagID, tags.ReallyHotTagID),
		activityPercentSceneNegativeSourceSQLCustom(sceneIDExpr),
	)
}

func activityPercentSceneUnclassifiedSecondsExprCustom(sceneIDExpr string) string {
	tags := GetRoleTagIDs()
	outstandingSourceSQL := activityPercentSceneOutstandingSourceForTagIDsSQLCustom(
		sceneIDExpr,
		activityPercentConfiguredTagIDsCustom(),
		tags.GoatTagID,
		tags.OrgasmTagID,
		tags.ReallyHotTagID,
	)
	coveredSourceSQL := fmt.Sprintf("%s\nUNION ALL\n%s\nUNION ALL\n%s",
		activityPercentQualityActivitySourceSQLCustom(sceneIDExpr),
		activityPercentSceneNegativeSourceSQLCustom(sceneIDExpr),
		outstandingSourceSQL,
	)
	return activityPercentNonNegativeDifferenceExprCustom(
		activityPercentSceneDurationExprCustom(sceneIDExpr),
		activityPercentMergedSecondsExprCustom(coveredSourceSQL),
	)
}

func activityPercentSceneUnusableSecondsExprCustom(sceneIDExpr string) string {
	return activityPercentMergedSecondsExprCustom(activityPercentSceneNegativeSourceSQLCustom(sceneIDExpr))
}

func activityPercentSceneCoveredSecondsExprCustom(sceneIDExpr string) string {
	sourceSQL := fmt.Sprintf(`%s
UNION ALL
%s`,
		activityPercentSceneAnyActivitySourceSQLCustom(sceneIDExpr),
		activityPercentSceneNegativeSourceSQLCustom(sceneIDExpr),
	)
	return activityPercentMergedSecondsExprCustom(sourceSQL)
}

func activityPercentSceneOtherSecondsExprCustom(sceneIDExpr string) string {
	return activityPercentNonNegativeDifferenceExprCustom(
		activityPercentSceneDurationExprCustom(sceneIDExpr),
		activityPercentSceneCoveredSecondsExprCustom(sceneIDExpr),
	)
}

func activityPercentSceneClassifiedTotalExprCustom(sceneIDExpr string) string {
	return fmt.Sprintf("(%s + %s + %s)",
		activityPercentSceneSecondsExprCustom(sceneIDExpr, activityPercentSexCustom),
		activityPercentSceneSecondsExprCustom(sceneIDExpr, activityPercentOralCustom),
		activityPercentSceneSecondsExprCustom(sceneIDExpr, activityPercentSoloCustom),
	)
}

func activityPercentScenePercentExprCustom(category activityPercentCategoryCustom) string {
	denominator := activityPercentSceneDurationExprCustom("scenes.id")
	if activityPercentIsClassifiedTypeCustom(category) {
		denominator = activityPercentSceneClassifiedTotalExprCustom("scenes.id")
	}
	return activityPercentExprCustom(
		activityPercentSceneSecondsExprCustom("scenes.id", category),
		denominator,
	)
}
