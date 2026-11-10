package sqlite

import (
	"context"

	"github.com/stashapp/stash/pkg/models"
)

func (qb *sceneFilterHandler) activityPercentagesCriterionHandlerCustom() criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		c := qb.sceneFilter
		criteria := map[activityPercentCategoryCustom][]*models.IntCriterionInput{
			activityPercentSexCustom:          {c.SexActivityPercent},
			activityPercentOralCustom:         {c.OralActivityPercent},
			activityPercentSoloCustom:         {c.SoloActivityPercent},
			activityPercentOtherCustom:        {c.OtherActivityPercent},
			activityPercentOutstandingCustom:  {c.OutstandingActivityPercent},
			activityPercentStandardCustom:     {c.StandardActivityPercent},
			activityPercentUnclassifiedCustom: {c.UnclassifiedActivityPercent},
			activityPercentUnusableCustom:     {c.UnusableActivityPercent},
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
		// Only the local AND criteria restrict this metric's candidates. Including
		// a sibling OR/NOT branch would change the meaning of nested filters.
		scope := *f
		scope.subFilter = nil
		// HAVING is combined separately by the repository. An OR branch can
		// satisfy it without satisfying this branch's local HAVING, so it cannot
		// safely narrow this predicate's candidate set.
		scope.havingClauses = nil
		for _, category := range []activityPercentCategoryCustom{
			activityPercentSexCustom, activityPercentOralCustom, activityPercentSoloCustom,
			activityPercentOtherCustom, activityPercentOutstandingCustom, activityPercentStandardCustom,
			activityPercentUnclassifiedCustom, activityPercentUnusableCustom,
		} {
			var active []*models.IntCriterionInput
			for _, criterion := range criteria[category] {
				if criterion != nil {
					active = append(active, criterion)
				}
			}
			if len(active) == 0 {
				continue
			}
			query := sceneRepository.newQuery()
			distinctIDs(&query, sceneTable)
			if err := query.addFilter(&scope); err != nil {
				f.setError(err)
				return
			}
			expr := sceneActivityPercentExpressionCustom(&query, category, false)
			for _, criterion := range active {
				clause, args := getIntCriterionWhereClause(activityPercentFilterExprCustom(expr), *criterion)
				query.addWhere(clause)
				query.addArg(args...)
			}
			// A self-contained ID subquery keeps aliases local to each category and
			// nested branch, and works identically for counts and paginated results.
			f.addWhere("scenes.id IN ("+query.toSQL(false)+")", query.allArgs()...)
		}
	}
}
