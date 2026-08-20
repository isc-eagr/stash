package sqlite

import (
	"context"
	"fmt"
	"strings"

	"github.com/stashapp/stash/pkg/models"
)

type activityPercentCategoryCustom string

const (
	activityPercentSexCustom         activityPercentCategoryCustom = "sex"
	activityPercentOralCustom        activityPercentCategoryCustom = "oral"
	activityPercentSoloCustom        activityPercentCategoryCustom = "solo"
	activityPercentOtherCustom       activityPercentCategoryCustom = "other"
	activityPercentOutstandingCustom activityPercentCategoryCustom = "outstanding"
	activityPercentStandardCustom    activityPercentCategoryCustom = "standard"
	activityPercentUnusableCustom    activityPercentCategoryCustom = "unusable"
)

func activityPercentTagIDCustom(category activityPercentCategoryCustom) int {
	tags := GetRoleTagIDs()
	switch category {
	case activityPercentSexCustom:
		return tags.SexTagID
	case activityPercentOralCustom:
		return tags.OralTagID
	case activityPercentSoloCustom:
		return tags.SoloTagID
	default:
		return 0
	}
}

func activityPercentStrictMarkerConditionCustom(markerAlias string, tagID int) string {
	return fmt.Sprintf(`%[1]s.primary_tag_id = %[2]d
AND %[1]s.end_seconds IS NOT NULL
AND %[1]s.end_seconds > %[1]s.seconds
AND NOT EXISTS (
	SELECT 1 FROM scene_markers_tags smt_activity
	WHERE smt_activity.scene_marker_id = %[1]s.id
)`, markerAlias, tagID)
}

func activityPercentMergedSecondsExprCustom(intervalSourceSQL string) string {
	return fmt.Sprintf(`COALESCE((
	SELECT SUM(
		CASE
			WHEN activity_ranges.end_seconds > COALESCE(activity_ranges.prev_end, activity_ranges.seconds)
			THEN activity_ranges.end_seconds - CASE
				WHEN activity_ranges.prev_end > activity_ranges.seconds THEN activity_ranges.prev_end
				ELSE activity_ranges.seconds
			END
			ELSE 0
		END
	)
	FROM (
		SELECT
			activity_intervals.scene_id,
			activity_intervals.seconds,
			activity_intervals.end_seconds,
			MAX(activity_intervals.end_seconds) OVER (
				PARTITION BY activity_intervals.scene_id
				ORDER BY activity_intervals.seconds, activity_intervals.end_seconds
				ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
			) AS prev_end
		FROM (%s) activity_intervals
	) activity_ranges
), 0)`, intervalSourceSQL)
}

func activityPercentSceneDurationExprCustom(sceneIDExpr string) string {
	return fmt.Sprintf(`COALESCE((
	SELECT vf_activity.duration
	FROM scenes_files sf_activity
	JOIN video_files vf_activity ON vf_activity.file_id = sf_activity.file_id
	WHERE sf_activity.scene_id = %s
	ORDER BY vf_activity.duration DESC
	LIMIT 1
), 0)`, sceneIDExpr)
}

func activityPercentExprCustom(numeratorExpr string, denominatorExpr string) string {
	return fmt.Sprintf("COALESCE(100.0 * (%s) / NULLIF((%s), 0), 0)", numeratorExpr, denominatorExpr)
}

func activityPercentSceneSecondsExprCustom(sceneIDExpr string, category activityPercentCategoryCustom) string {
	switch category {
	case activityPercentOtherCustom:
		return activityPercentSceneOtherSecondsExprCustom(sceneIDExpr)
	case activityPercentOutstandingCustom:
		return activityPercentSceneOutstandingSecondsExprCustom(sceneIDExpr)
	case activityPercentStandardCustom:
		return activityPercentSceneStandardSecondsExprCustom(sceneIDExpr)
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

func activityPercentOutstandingMarkerConditionForTagIDsCustom(markerAlias string, tagIDs []int, goatTagID int, orgasmTagID int, reallyHotTagID int) string {
	validRange := fmt.Sprintf(`%[1]s.end_seconds IS NOT NULL
AND %[1]s.end_seconds > %[1]s.seconds`, markerAlias)
	if len(tagIDs) == 0 {
		return validRange
	}

	parts := make([]string, 0, len(tagIDs))
	for _, id := range tagIDs {
		parts = append(parts, fmt.Sprintf("%d", id))
	}

	goatCondition := "0"
	if goatTagID != 0 {
		goatCondition = sceneMarkerEffectiveTagHierarchyConditionCustom(markerAlias, goatTagID)
	}
	orgasmCondition := "0"
	if orgasmTagID != 0 {
		orgasmCondition = sceneMarkerEffectiveTagHierarchyConditionCustom(markerAlias, orgasmTagID)
	}
	reallyHotCondition := "0"
	if reallyHotTagID != 0 {
		reallyHotCondition = sceneMarkerEffectiveTagHierarchyConditionCustom(markerAlias, reallyHotTagID)
	}

	return fmt.Sprintf(`%[1]s
AND (
	%[4]s
	OR (
		NOT %[5]s
		AND (
			%[2]s.primary_tag_id NOT IN (%[3]s)
			OR EXISTS (
				SELECT 1 FROM scene_markers_tags smt_quality
				WHERE smt_quality.scene_marker_id = %[2]s.id
			)
		)
	)
	OR (%[5]s AND %[6]s)
)`, validRange, markerAlias, strings.Join(parts, ","), goatCondition, orgasmCondition, reallyHotCondition)
}

func activityPercentSceneOutstandingSourceForTagIDsSQLCustom(sceneIDExpr string, tagIDs []int, goatTagID int, orgasmTagID int, reallyHotTagID int) string {
	return fmt.Sprintf(`SELECT sm.scene_id,
MAX(0, sm.seconds) AS seconds,
MIN((%[2]s), sm.end_seconds) AS end_seconds
FROM scene_markers sm
WHERE sm.scene_id = %[1]s
AND %[3]s`, sceneIDExpr, activityPercentSceneDurationExprCustom(sceneIDExpr), activityPercentOutstandingMarkerConditionForTagIDsCustom("sm", tagIDs, goatTagID, orgasmTagID, reallyHotTagID))
}

func activityPercentIntersectionSourceSQLCustom(firstSourceSQL string, secondSourceSQL string) string {
	return fmt.Sprintf(`SELECT first_intervals.scene_id,
MAX(first_intervals.seconds, second_intervals.seconds) AS seconds,
MIN(first_intervals.end_seconds, second_intervals.end_seconds) AS end_seconds
FROM (%s) first_intervals
JOIN (%s) second_intervals ON second_intervals.scene_id = first_intervals.scene_id
WHERE first_intervals.seconds < second_intervals.end_seconds
AND second_intervals.seconds < first_intervals.end_seconds`, firstSourceSQL, secondSourceSQL)
}

func activityPercentOutstandingSecondsFromSourcesExprCustom(outstandingSourceSQL string, unusableSourceSQL string) string {
	return activityPercentNonNegativeDifferenceExprCustom(
		activityPercentMergedSecondsExprCustom(outstandingSourceSQL),
		activityPercentMergedSecondsExprCustom(activityPercentIntersectionSourceSQLCustom(outstandingSourceSQL, unusableSourceSQL)),
	)
}

func activityPercentStandardSecondsFromSourcesExprCustom(totalExpr string, outstandingSourceSQL string, unusableSourceSQL string) string {
	coveredSourceSQL := fmt.Sprintf("%s\nUNION ALL\n%s", outstandingSourceSQL, unusableSourceSQL)
	return activityPercentNonNegativeDifferenceExprCustom(
		totalExpr,
		activityPercentMergedSecondsExprCustom(coveredSourceSQL),
	)
}

func activityPercentSceneOutstandingSecondsExprCustom(sceneIDExpr string) string {
	tags := GetRoleTagIDs()
	outstandingSourceSQL := activityPercentSceneOutstandingSourceForTagIDsSQLCustom(sceneIDExpr, activityPercentConfiguredTagIDsCustom(), tags.GoatTagID, tags.OrgasmTagID, tags.ReallyHotTagID)
	return activityPercentOutstandingSecondsFromSourcesExprCustom(
		outstandingSourceSQL,
		activityPercentSceneNegativeSourceSQLCustom(sceneIDExpr),
	)
}

func activityPercentSceneStandardSecondsExprCustom(sceneIDExpr string) string {
	tags := GetRoleTagIDs()
	return activityPercentStandardSecondsFromSourcesExprCustom(
		activityPercentSceneDurationExprCustom(sceneIDExpr),
		activityPercentSceneOutstandingSourceForTagIDsSQLCustom(sceneIDExpr, activityPercentConfiguredTagIDsCustom(), tags.GoatTagID, tags.OrgasmTagID, tags.ReallyHotTagID),
		activityPercentSceneNegativeSourceSQLCustom(sceneIDExpr),
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

func activityPercentNonNegativeDifferenceExprCustom(totalExpr string, coveredExpr string) string {
	return fmt.Sprintf(`CASE
WHEN (%[1]s) > (%[2]s) THEN (%[1]s) - (%[2]s)
ELSE 0
END`, totalExpr, coveredExpr)
}

func activityPercentSceneOtherSecondsExprCustom(sceneIDExpr string) string {
	return activityPercentNonNegativeDifferenceExprCustom(
		activityPercentSceneDurationExprCustom(sceneIDExpr),
		activityPercentSceneCoveredSecondsExprCustom(sceneIDExpr),
	)
}

func activityPercentScenePercentExprCustom(category activityPercentCategoryCustom) string {
	return activityPercentExprCustom(
		activityPercentSceneSecondsExprCustom("scenes.id", category),
		activityPercentSceneDurationExprCustom("scenes.id"),
	)
}

func activityPercentConfiguredTagIDsCustom() []int {
	tags := GetRoleTagIDs()
	ret := []int{}
	for _, id := range []int{tags.SexTagID, tags.OralTagID, tags.SoloTagID} {
		if id != 0 {
			ret = append(ret, id)
		}
	}
	return ret
}

func activityPercentStrictAnyMarkerConditionCustom(markerAlias string) string {
	tagIDs := activityPercentConfiguredTagIDsCustom()
	if len(tagIDs) == 0 {
		return "0"
	}

	parts := make([]string, 0, len(tagIDs))
	for _, id := range tagIDs {
		parts = append(parts, fmt.Sprintf("%d", id))
	}

	return fmt.Sprintf(`%[1]s.primary_tag_id IN (%[2]s)
AND %[1]s.end_seconds IS NOT NULL
AND %[1]s.end_seconds > %[1]s.seconds
AND NOT EXISTS (
	SELECT 1 FROM scene_markers_tags smt_activity_any
	WHERE smt_activity_any.scene_marker_id = %[1]s.id
)`, markerAlias, strings.Join(parts, ","))
}

func activityPercentStudioDenominatorExprCustom() string {
	return fmt.Sprintf(`COALESCE((
	SELECT SUM(%s)
	FROM scenes s_activity_total
	WHERE s_activity_total.studio_id = studios.id
	AND %s
), 0)`,
		activityPercentSceneDurationExprCustom("s_activity_total.id"),
		activityPercentStudioMeaningfulSceneConditionCustom("s_activity_total"),
	)
}

func activityPercentStudioRoleMarkerConditionCustom(markerAlias string) string {
	tagIDs := activityPercentConfiguredTagIDsCustom()
	if len(tagIDs) == 0 {
		return "0"
	}

	parts := make([]string, 0, len(tagIDs))
	for _, id := range tagIDs {
		parts = append(parts, fmt.Sprintf("%d", id))
	}

	return fmt.Sprintf(`%[1]s.primary_tag_id IN (%[2]s)
AND %[1]s.end_seconds IS NOT NULL
AND %[1]s.end_seconds > %[1]s.seconds`, markerAlias, strings.Join(parts, ","))
}

func activityPercentStudioMeaningfulSceneConditionCustom(sceneAlias string) string {
	return fmt.Sprintf(`EXISTS (
	SELECT 1 FROM scene_markers sm_studio_meaningful
	WHERE sm_studio_meaningful.scene_id = %[1]s.id
	AND %[2]s
	AND MIN((%[3]s), sm_studio_meaningful.end_seconds) > MAX(0, sm_studio_meaningful.seconds)
)`, sceneAlias, activityPercentStudioRoleMarkerConditionCustom("sm_studio_meaningful"), activityPercentSceneDurationExprCustom(sceneAlias+".id"))
}

func activityPercentStudioSecondsExprCustom(category activityPercentCategoryCustom) string {
	switch category {
	case activityPercentOtherCustom:
		return activityPercentStudioOtherSecondsExprCustom()
	case activityPercentOutstandingCustom:
		return activityPercentStudioOutstandingSecondsExprCustom()
	case activityPercentStandardCustom:
		return activityPercentStudioStandardSecondsExprCustom()
	case activityPercentUnusableCustom:
		return activityPercentStudioUnusableSecondsExprCustom()
	}

	tagID := activityPercentTagIDCustom(category)
	if tagID == 0 {
		return "0"
	}

	sourceSQL := fmt.Sprintf(`SELECT sm.scene_id,
MAX(0, sm.seconds) AS seconds,
MIN((%s), sm.end_seconds) AS end_seconds
FROM scene_markers sm
JOIN scenes s_activity ON s_activity.id = sm.scene_id
WHERE s_activity.studio_id = studios.id
AND %s`, activityPercentSceneDurationExprCustom("s_activity.id"), activityPercentStudioRoleMarkerConditionCustom("sm"))

	// Keep the configured category exact even though the shared role condition
	// accepts any configured sex/oral/solo primary marker.
	sourceSQL += fmt.Sprintf("\nAND sm.primary_tag_id = %d", tagID)

	return activityPercentMergedSecondsExprCustom(sourceSQL)
}

func activityPercentStudioAnyActivitySourceSQLCustom() string {
	return fmt.Sprintf(`SELECT sm.scene_id,
MAX(0, sm.seconds) AS seconds,
MIN((%s), sm.end_seconds) AS end_seconds
FROM scene_markers sm
JOIN scenes s_activity ON s_activity.id = sm.scene_id
WHERE s_activity.studio_id = studios.id
AND %s`, activityPercentSceneDurationExprCustom("s_activity.id"), activityPercentStudioRoleMarkerConditionCustom("sm"))
}

func activityPercentStudioNegativeSourceSQLCustom() string {
	return fmt.Sprintf(`SELECT snm.scene_id,
MAX(0, snm.start_seconds) AS seconds,
MIN((%s), snm.end_seconds) AS end_seconds
FROM scene_negative_markers snm
JOIN scenes s_negative ON s_negative.id = snm.scene_id
WHERE s_negative.studio_id = studios.id
AND snm.end_seconds > snm.start_seconds
AND %s`, activityPercentSceneDurationExprCustom("s_negative.id"), activityPercentStudioMeaningfulSceneConditionCustom("s_negative"))
}

func activityPercentStudioOutstandingSourceSQLCustom() string {
	return fmt.Sprintf(`SELECT sm.scene_id,
MAX(0, sm.seconds) AS seconds,
MIN((%s), sm.end_seconds) AS end_seconds
FROM scene_markers sm
JOIN scenes s_outstanding ON s_outstanding.id = sm.scene_id
WHERE s_outstanding.studio_id = studios.id
AND %s
AND %s`,
		activityPercentSceneDurationExprCustom("s_outstanding.id"),
		activityPercentOutstandingMarkerConditionForTagIDsCustom("sm", activityPercentConfiguredTagIDsCustom(), GetRoleTagIDs().GoatTagID, GetRoleTagIDs().OrgasmTagID, GetRoleTagIDs().ReallyHotTagID),
		activityPercentStudioMeaningfulSceneConditionCustom("s_outstanding"),
	)
}

func activityPercentStudioUnusableSecondsExprCustom() string {
	return activityPercentMergedSecondsExprCustom(activityPercentStudioNegativeSourceSQLCustom())
}

func activityPercentStudioOutstandingSecondsExprCustom() string {
	return activityPercentOutstandingSecondsFromSourcesExprCustom(
		activityPercentStudioOutstandingSourceSQLCustom(),
		activityPercentStudioNegativeSourceSQLCustom(),
	)
}

func activityPercentStudioStandardSecondsExprCustom() string {
	return activityPercentStandardSecondsFromSourcesExprCustom(
		activityPercentStudioDenominatorExprCustom(),
		activityPercentStudioOutstandingSourceSQLCustom(),
		activityPercentStudioNegativeSourceSQLCustom(),
	)
}

func activityPercentStudioOtherSecondsExprCustom() string {
	return activityPercentNonNegativeDifferenceExprCustom(
		activityPercentStudioDenominatorExprCustom(),
		activityPercentMergedSecondsExprCustom(activityPercentStudioAnyActivitySourceSQLCustom()),
	)
}

func activityPercentStudioPercentExprCustom(category activityPercentCategoryCustom) string {
	return activityPercentExprCustom(
		activityPercentStudioSecondsExprCustom(category),
		activityPercentStudioDenominatorExprCustom(),
	)
}

func activityPercentPerformerSecondsExprCustom(category activityPercentCategoryCustom, role string, studioSQL string) string {
	tagID := activityPercentTagIDCustom(category)
	if tagID == 0 {
		return "0"
	}

	roleSQL := ""
	if role != "" {
		roleSQL = fmt.Sprintf("AND smp.role = '%s'", role)
	}

	sourceSQL := fmt.Sprintf(`SELECT sm.scene_id, sm.seconds, sm.end_seconds
FROM scene_markers sm
JOIN scene_marker_performers smp ON smp.scene_marker_id = sm.id
WHERE smp.performer_id = performers.id
%s
%s
AND %s`, roleSQL, studioSQL, activityPercentStrictMarkerConditionCustom("sm", tagID))

	return activityPercentMergedSecondsExprCustom(sourceSQL)
}

func activityPercentPerformerTotalExprCustom(studioSQL string) string {
	return fmt.Sprintf("(%s + %s + %s)",
		activityPercentPerformerSecondsExprCustom(activityPercentSexCustom, "", studioSQL),
		activityPercentPerformerSecondsExprCustom(activityPercentOralCustom, "", studioSQL),
		activityPercentPerformerSecondsExprCustom(activityPercentSoloCustom, "", studioSQL),
	)
}

func activityPercentPerformerCategoryPercentExprCustom(category activityPercentCategoryCustom, studioSQL string) string {
	return activityPercentExprCustom(
		activityPercentPerformerSecondsExprCustom(category, "", studioSQL),
		activityPercentPerformerTotalExprCustom(studioSQL),
	)
}

func activityPercentPerformerRolePercentExprCustom(category activityPercentCategoryCustom, role string, studioSQL string) string {
	return activityPercentExprCustom(
		activityPercentPerformerSecondsExprCustom(category, role, studioSQL),
		activityPercentPerformerSecondsExprCustom(category, "", studioSQL),
	)
}

func activityPercentCriterionHandlerCustom(criterion *models.IntCriterionInput, expr string) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if criterion == nil {
			return
		}

		clause, args := getIntCriterionWhereClause(expr, *criterion)
		f.addWhere(clause, args...)
	}
}

func activityPercentFilterHandlerCustom(c *models.ActivityPercentFilterInput, exprFn func(activityPercentCategoryCustom) string) criterionHandler {
	if c == nil {
		return compoundHandler{}
	}

	return compoundHandler{
		activityPercentCriterionHandlerCustom(c.SexPercent, exprFn(activityPercentSexCustom)),
		activityPercentCriterionHandlerCustom(c.OralPercent, exprFn(activityPercentOralCustom)),
		activityPercentCriterionHandlerCustom(c.SoloPercent, exprFn(activityPercentSoloCustom)),
		activityPercentCriterionHandlerCustom(c.OtherPercent, exprFn(activityPercentOtherCustom)),
		activityPercentCriterionHandlerCustom(c.UnusablePercent, exprFn(activityPercentUnusableCustom)),
	}
}

func qualityPercentFilterHandlerCustom(c *models.QualityPercentFilterInput, exprFn func(activityPercentCategoryCustom) string) criterionHandler {
	if c == nil {
		return compoundHandler{}
	}

	return compoundHandler{
		activityPercentCriterionHandlerCustom(c.OutstandingPercent, exprFn(activityPercentOutstandingCustom)),
		activityPercentCriterionHandlerCustom(c.StandardPercent, exprFn(activityPercentStandardCustom)),
		activityPercentCriterionHandlerCustom(c.UnusablePercent, exprFn(activityPercentUnusableCustom)),
	}
}

func performerActivityPercentFilterHandlerCustom(c *models.PerformerActivityPercentFilterInput, studioSQL string) criterionHandler {
	if c == nil {
		return compoundHandler{}
	}

	return compoundHandler{
		activityPercentCriterionHandlerCustom(c.SexPercent, activityPercentPerformerCategoryPercentExprCustom(activityPercentSexCustom, studioSQL)),
		activityPercentCriterionHandlerCustom(c.OralPercent, activityPercentPerformerCategoryPercentExprCustom(activityPercentOralCustom, studioSQL)),
		activityPercentCriterionHandlerCustom(c.SoloPercent, activityPercentPerformerCategoryPercentExprCustom(activityPercentSoloCustom, studioSQL)),
		activityPercentCriterionHandlerCustom(c.SexTopPercent, activityPercentPerformerRolePercentExprCustom(activityPercentSexCustom, "top", studioSQL)),
		activityPercentCriterionHandlerCustom(c.SexBottomPercent, activityPercentPerformerRolePercentExprCustom(activityPercentSexCustom, "bottom", studioSQL)),
		activityPercentCriterionHandlerCustom(c.OralTopPercent, activityPercentPerformerRolePercentExprCustom(activityPercentOralCustom, "top", studioSQL)),
		activityPercentCriterionHandlerCustom(c.OralBottomPercent, activityPercentPerformerRolePercentExprCustom(activityPercentOralCustom, "bottom", studioSQL)),
	}
}

func activityPercentPerformerStudioSQLCustom(filter *models.PerformerFilterType) string {
	if filter != nil && filter.Studios != nil &&
		filter.Studios.Modifier == models.CriterionModifierIncludes &&
		len(filter.Studios.Value) > 0 {
		return " AND sm.scene_id IN (SELECT id FROM scenes WHERE studio_id IN (SELECT item_id FROM studio))"
	}
	return ""
}

func (qb *SceneStore) sortByActivityPercentCustom(category activityPercentCategoryCustom, direction string) string {
	return fmt.Sprintf(" ORDER BY %s %s", activityPercentScenePercentExprCustom(category), getSortDirection(direction))
}

func (qb *StudioStore) sortByActivityPercentCustom(category activityPercentCategoryCustom, direction string) string {
	return fmt.Sprintf(" ORDER BY %s %s", activityPercentStudioPercentExprCustom(category), getSortDirection(direction))
}

func (qb *PerformerStore) sortByActivityPercentCustom(category activityPercentCategoryCustom, direction string, studioSQL string) string {
	return fmt.Sprintf(" ORDER BY %s %s", activityPercentPerformerCategoryPercentExprCustom(category, studioSQL), getSortDirection(direction))
}

func (qb *PerformerStore) sortByActivityRolePercentCustom(category activityPercentCategoryCustom, role string, direction string, studioSQL string) string {
	return fmt.Sprintf(" ORDER BY %s %s", activityPercentPerformerRolePercentExprCustom(category, role, studioSQL), getSortDirection(direction))
}
