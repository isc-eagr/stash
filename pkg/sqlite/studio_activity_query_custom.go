package sqlite

import (
	"context"
	"fmt"
	"strings"

	"github.com/stashapp/stash/pkg/models"
)

func studioBatchedQualityCategoryCustom(category activityPercentCategoryCustom) bool {
	switch category {
	case activityPercentOtherCustom, activityPercentOutstandingCustom, activityPercentStandardCustom,
		activityPercentUnclassifiedCustom:
		return true
	}
	return false
}

func (qb *StudioStore) getStudioSortCustom(query *queryBuilder, filter *models.FindFilterType) (string, error) {
	category := activityPercentCategoryCustom(strings.TrimSuffix(filter.GetSort("name"), "_activity_percent"))
	if !studioBatchedQualityCategoryCustom(category) || !strings.HasSuffix(filter.GetSort("name"), "_activity_percent") {
		return qb.getStudioSort(filter)
	}
	expr := studioQualityPercentExpressionCustom(query, category, true)
	return studioSortMetricOrderClauseCustom(expr, filter.GetDirection()) + ", COALESCE(studios.name, studios.id) COLLATE NATURAL_CI ASC", nil
}

// Sources are uncorrelated CTEs over the selected studios. Correlated
// materialized CTEs would be rebuilt inside each interval subquery by SQLite.
func studioQualityPercentExpressionCustom(query *queryBuilder, category activityPercentCategoryCustom, sortOnly bool) string {
	scope, args := query.toSQL(false), query.allArgs()
	query.addWith(false, "studio_quality_candidates(id) AS MATERIALIZED ("+scope+")")
	query.withArgs = append(query.withArgs, args...)
	query.addWith(false, `studio_quality_durations AS MATERIALIZED (
 SELECT s.id AS scene_id, s.studio_id, COALESCE(MAX(v.duration), 0) AS duration
 FROM studio_quality_candidates c CROSS JOIN scenes s ON s.studio_id = c.id
 LEFT JOIN scenes_files sf ON sf.scene_id = s.id
 LEFT JOIN video_files v ON v.file_id = sf.file_id GROUP BY s.id
)`, `studio_quality_activity AS MATERIALIZED (
 SELECT sm.scene_id, MAX(0, sm.seconds) AS seconds, MIN(d.duration, sm.end_seconds) AS end_seconds
 FROM studio_quality_durations d CROSS JOIN scene_markers sm ON sm.scene_id = d.scene_id
 WHERE `+activityPercentStudioRoleMarkerConditionCustom("sm")+`
)`, `studio_quality_meaningful AS MATERIALIZED (
 SELECT d.* FROM studio_quality_durations d
 WHERE d.scene_id IN (SELECT scene_id FROM studio_quality_activity WHERE end_seconds > seconds)
)`, `studio_quality_denominator AS MATERIALIZED (
 SELECT studio_id, SUM(duration) AS duration FROM studio_quality_meaningful GROUP BY studio_id
)`)
	query.addJoins(join{table: "studio_quality_denominator", onClause: "studio_quality_denominator.studio_id = studios.id", sort: sortOnly})
	duration := "COALESCE(studio_quality_denominator.duration, 0)"
	a := "SELECT scene_id, seconds, end_seconds FROM studio_quality_activity"
	n := "SELECT scene_id, seconds, end_seconds FROM studio_quality_negative"
	o := "SELECT scene_id, seconds, end_seconds FROM studio_quality_outstanding"
	if category != activityPercentOtherCustom {
		query.addWith(false, `studio_quality_negative AS MATERIALIZED (
 SELECT n.scene_id, MAX(0, n.start_seconds) AS seconds, MIN(d.duration, n.end_seconds) AS end_seconds
 FROM studio_quality_meaningful d CROSS JOIN scene_negative_markers n ON n.scene_id = d.scene_id
 WHERE n.end_seconds > n.start_seconds
)`)
	}
	if category != activityPercentOtherCustom {
		tags := GetRoleTagIDs()
		query.addWith(false, `studio_quality_outstanding AS MATERIALIZED (
 SELECT sm.scene_id, MAX(0, sm.seconds) AS seconds, MIN(d.duration, sm.end_seconds) AS end_seconds
 FROM studio_quality_meaningful d CROSS JOIN scene_markers sm ON sm.scene_id = d.scene_id
 WHERE `+activityPercentOutstandingMarkerConditionForTagIDsCustom("sm", activityPercentConfiguredTagIDsCustom(), tags.GoatTagID, tags.OrgasmTagID, tags.ReallyHotTagID)+`
)`)
	}
	merged := func(name, source string) string {
		query.addWith(false, name+` AS MATERIALIZED (
 SELECT d.studio_id, SUM(m.seconds) AS seconds FROM (`+sceneActivitySortMergedSQLCustom(source)+`) m
 JOIN studio_quality_durations d ON d.scene_id = m.scene_id GROUP BY d.studio_id
)`)
		query.addJoins(join{table: name, onClause: name + ".studio_id = studios.id", sort: sortOnly})
		return "COALESCE(" + name + ".seconds, 0)"
	}
	var numerator string
	switch category {
	case activityPercentOutstandingCustom:
		numerator = activityPercentNonNegativeDifferenceExprCustom(merged("studio_quality_total", o), merged("studio_quality_excluded", activityPercentIntersectionSourceSQLCustom(o, n)))
	case activityPercentStandardCustom:
		numerator = activityPercentNonNegativeDifferenceExprCustom(merged("studio_quality_total", a), merged("studio_quality_excluded", activityPercentIntersectionSourceSQLCustom(a, o)+" UNION ALL "+activityPercentIntersectionSourceSQLCustom(a, n)))
	case activityPercentUnclassifiedCustom:
		numerator = activityPercentNonNegativeDifferenceExprCustom(duration, merged("studio_quality_total", a+" UNION ALL "+n+" UNION ALL "+o))
	case activityPercentOtherCustom:
		numerator = activityPercentNonNegativeDifferenceExprCustom(duration, merged("studio_quality_total", a))
	}
	return activityPercentExprCustom(numerator, duration)
}

func (qb *studioFilterHandler) activityPercentagesCriterionHandlerCustom() criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		c := qb.studioFilter
		criteria := map[activityPercentCategoryCustom][]*models.IntCriterionInput{
			activityPercentSexCustom: {c.SexActivityPercent}, activityPercentOralCustom: {c.OralActivityPercent},
			activityPercentSoloCustom: {c.SoloActivityPercent}, activityPercentOtherCustom: {c.OtherActivityPercent},
			activityPercentOutstandingCustom: {c.OutstandingActivityPercent}, activityPercentStandardCustom: {c.StandardActivityPercent},
			activityPercentUnclassifiedCustom: {c.UnclassifiedActivityPercent}, activityPercentUnusableCustom: {c.UnusableActivityPercent},
		}
		if a := c.ActivityPercentages; a != nil {
			criteria[activityPercentSexCustom] = append(criteria[activityPercentSexCustom], a.SexPercent)
			criteria[activityPercentOralCustom] = append(criteria[activityPercentOralCustom], a.OralPercent)
			criteria[activityPercentSoloCustom] = append(criteria[activityPercentSoloCustom], a.SoloPercent)
			criteria[activityPercentOtherCustom] = append(criteria[activityPercentOtherCustom], a.OtherPercent)
			criteria[activityPercentUnusableCustom] = append(criteria[activityPercentUnusableCustom], a.UnusablePercent)
		}
		if q := c.QualityPercentages; q != nil {
			criteria[activityPercentOutstandingCustom] = append(criteria[activityPercentOutstandingCustom], q.OutstandingPercent)
			criteria[activityPercentStandardCustom] = append(criteria[activityPercentStandardCustom], q.StandardPercent)
			criteria[activityPercentUnclassifiedCustom] = append(criteria[activityPercentUnclassifiedCustom], q.UnclassifiedPercent)
			criteria[activityPercentUnusableCustom] = append(criteria[activityPercentUnusableCustom], q.UnusablePercent)
		}
		// Sibling boolean branches and HAVING may match independently, so only
		// local AND predicates can restrict the candidate studios for this branch.
		scope := *f
		scope.subFilter = nil
		scope.havingClauses = nil
		for _, category := range []activityPercentCategoryCustom{activityPercentSexCustom, activityPercentOralCustom, activityPercentSoloCustom, activityPercentOtherCustom, activityPercentOutstandingCustom, activityPercentStandardCustom, activityPercentUnclassifiedCustom, activityPercentUnusableCustom} {
			var active []*models.IntCriterionInput
			for _, criterion := range criteria[category] {
				if criterion != nil {
					active = append(active, criterion)
				}
			}
			if len(active) == 0 {
				continue
			}
			if !studioBatchedQualityCategoryCustom(category) {
				for _, criterion := range active {
					activityPercentCriterionHandlerCustom(criterion, activityPercentStudioPercentExprCustom(category))(ctx, f)
				}
				continue
			}
			query := studioRepository.newQuery()
			distinctIDs(&query, studioTable)
			if err := query.addFilter(&scope); err != nil {
				f.setError(err)
				return
			}
			expr := studioQualityPercentExpressionCustom(&query, category, false)
			for _, criterion := range active {
				clause, args := getIntCriterionWhereClause(activityPercentFilterExprCustom(expr), *criterion)
				query.addWhere(clause)
				query.addArg(args...)
			}
			f.addWhere(fmt.Sprintf("studios.id IN (%s)", query.toSQL(false)), query.allArgs()...)
		}
	}
}
