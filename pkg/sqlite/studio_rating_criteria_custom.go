package sqlite

import (
	"context"
	"fmt"
	"strings"

	"github.com/stashapp/stash/pkg/models"
)

// CUSTOM: Studio list Rating Advisor averages.
type studioRatingCriteriaScopeCustom string

const (
	studioRatingCriteriaScenesCustom     studioRatingCriteriaScopeCustom = "scenes"
	studioRatingCriteriaPerformersCustom studioRatingCriteriaScopeCustom = "performers"
)

var studioRatingCriteriaSortKeysCustom = map[string]string{
	"rating_criteria_solo_performer_appeal":    "soloPerformerAppeal",
	"rating_criteria_solo_performance":         "soloPerformance",
	"rating_criteria_solo_usability":           "soloUsability",
	"rating_criteria_top_attractiveness":       "topAttractiveness",
	"rating_criteria_bottom_attractiveness":    "bottomAttractiveness",
	"rating_criteria_chemistry":                "chemistry",
	"rating_criteria_payoff":                   "payoff",
	"rating_criteria_standout":                 "standout",
	"rating_criteria_group_top_attractiveness": "groupTopAttractiveness",
	"rating_criteria_group_energy":             "groupEnergy",
	"rating_criteria_group_payoff":             "groupPayoff",
	"rating_criteria_group_usability":          "groupUsability",
}

type studioRatingAdvisorAverageSortCustom string

const (
	studioRatingAdvisorSoloAverageCustom      studioRatingAdvisorAverageSortCustom = "solo"
	studioRatingAdvisorStandardAverageCustom  studioRatingAdvisorAverageSortCustom = "standard"
	studioRatingAdvisorThreesomeAverageCustom studioRatingAdvisorAverageSortCustom = "threesome"
	studioRatingAdvisorGroupAverageCustom     studioRatingAdvisorAverageSortCustom = "group"
	studioRatingAdvisorPerformerAverageCustom studioRatingAdvisorAverageSortCustom = "performer"
	// Overall matches the Rating Advisor's overall scene average: scenes in any
	// of the solo, standard, threesome, or group sections.
	studioRatingAdvisorOverallAverageCustom studioRatingAdvisorAverageSortCustom = "overall"
)

var studioRatingAdvisorAverageSortKeysCustom = map[string]studioRatingAdvisorAverageSortCustom{
	"average_solo_scene_rating":     studioRatingAdvisorSoloAverageCustom,
	"average_standard_scene_rating":  studioRatingAdvisorStandardAverageCustom,
	"average_threesome_scene_rating": studioRatingAdvisorThreesomeAverageCustom,
	"average_group_scene_rating":    studioRatingAdvisorGroupAverageCustom,
	"average_performer_rating":      studioRatingAdvisorPerformerAverageCustom,
	"average_overall_scene_rating":  studioRatingAdvisorOverallAverageCustom,
}

func studioRatingCriteriaScoreSourceSQLCustom(scope studioRatingCriteriaScopeCustom, table string, scoreAlias string) string {
	if scope == studioRatingCriteriaPerformersCustom {
		return fmt.Sprintf(`FROM (
	SELECT DISTINCT studio_rating_ps.performer_id
	FROM scenes studio_rating_scene
	JOIN performers_scenes studio_rating_ps ON studio_rating_ps.scene_id = studio_rating_scene.id
	WHERE studio_rating_scene.studio_id = studios.id
) studio_rating_performer
JOIN %s %s
	ON %s.entity_type = 'performer'
	AND %s.entity_id = studio_rating_performer.performer_id
WHERE 1 = 1`, table, scoreAlias, scoreAlias, scoreAlias)
	}

	return fmt.Sprintf(`FROM scenes studio_rating_scene
JOIN %s %s
	ON %s.entity_type = 'scene'
	AND %s.entity_id = studio_rating_scene.id
WHERE studio_rating_scene.studio_id = studios.id`, table, scoreAlias, scoreAlias, scoreAlias)
}

func studioRatingCriteriaPresenceClauseCustom(
	scope studioRatingCriteriaScopeCustom,
	table string,
	key string,
	present bool,
) sqlClause {
	clause := makeClause(fmt.Sprintf(`EXISTS (
	SELECT 1
	%s
	AND studio_rating_score.key = ?
	AND (studio_rating_score.raw_value != 0 OR studio_rating_score.weighted_value != 0)
)`, studioRatingCriteriaScoreSourceSQLCustom(scope, table, "studio_rating_score")), key)
	if present {
		return clause
	}
	return clause.not()
}

func studioRatingCriteriaAveragesClauseCustom(
	scope studioRatingCriteriaScopeCustom,
	table string,
	criteria []*models.RatingScoreCriterionFilterInput,
) (sqlClause, error, bool) {
	var havingClauses []string
	var args []interface{}
	for _, item := range criteria {
		if item == nil || item.Value == nil || item.Key == "" {
			continue
		}
		if !item.Value.ValidModifier() {
			return sqlClause{}, fmt.Errorf("invalid modifier %s for studio rating criterion %s", item.Value.Modifier, item.Key), false
		}

		averageExpr := "AVG(CASE WHEN studio_rating_score.key = ? THEN studio_rating_score.raw_value END)"
		clause, criterionArgs := getFloatCriterionWhereClause(averageExpr, *item.Value)
		havingClauses = append(havingClauses, clause)
		args = append(args, item.Key)
		args = append(args, criterionArgs...)
	}

	if len(havingClauses) == 0 {
		return sqlClause{}, nil, false
	}

	return makeClause(fmt.Sprintf(`EXISTS (
	SELECT COUNT(*)
	%s
	HAVING %s
)`, studioRatingCriteriaScoreSourceSQLCustom(scope, table, "studio_rating_score"), strings.Join(havingClauses, " AND ")), args...), nil, true
}

func studioRatingCriteriaCriterionHandlerCustom(
	criterion *models.RatingCriteriaFilterInput,
	scope studioRatingCriteriaScopeCustom,
) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if criterion == nil {
			return
		}

		averageClause, err, ok := studioRatingCriteriaAveragesClauseCustom(scope, ratingCriteriaScoresTable, criterion.Criteria)
		if err != nil {
			f.setError(err)
			return
		}
		if ok {
			f.whereClauses = append(f.whereClauses, averageClause)
		}

		bonusValueClause, err, ok := studioRatingCriteriaAveragesClauseCustom(scope, ratingBonusScoresTable, criterion.BonusValues)
		if err != nil {
			f.setError(err)
			return
		}
		if ok {
			f.whereClauses = append(f.whereClauses, bonusValueClause)
		}

		for _, item := range criterion.Bonuses {
			if item == nil || item.Key == "" {
				continue
			}
			f.whereClauses = append(f.whereClauses, studioRatingCriteriaPresenceClauseCustom(scope, ratingBonusScoresTable, item.Key, item.Value))
		}

		for _, item := range criterion.Penalties {
			if item == nil || item.Key == "" {
				continue
			}
			f.whereClauses = append(f.whereClauses, studioRatingCriteriaPresenceClauseCustom(scope, ratingPenaltyScoresTable, item.Key, item.Value))
		}
	}
}

func studioRatingCriteriaAverageExprCustom(key string) string {
	return fmt.Sprintf(`(
	SELECT AVG(studio_rating_score.raw_value)
	%s
	AND studio_rating_score.key = '%s'
)`, studioRatingCriteriaScoreSourceSQLCustom(studioRatingCriteriaScenesCustom, ratingCriteriaScoresTable, "studio_rating_score"), key)
}

func (qb *StudioStore) sortByRatingCriteriaAverageCustom(key string, direction string) string {
	return fmt.Sprintf(" ORDER BY %s %s", studioRatingCriteriaAverageExprCustom(key), getSortDirection(direction))
}

// studioRatingAdvisorSceneConditionCustom limits studio_rating_scene to one
// Rating Advisor scene section.
func studioRatingAdvisorSceneConditionCustom(category studioRatingAdvisorAverageSortCustom) string {
	switch category {
	case studioRatingAdvisorSoloAverageCustom:
		return `EXISTS (
		SELECT 1 FROM rating_criteria_scores studio_rating_score
		WHERE studio_rating_score.entity_type = 'scene'
			AND studio_rating_score.entity_id = studio_rating_scene.id
			AND studio_rating_score.key IN ('soloPerformerAppeal', 'soloPerformance', 'soloUsability')
	)`
	// Standard (2 vatos) and Threesome (3 vatos) share the same rubric.
	case studioRatingAdvisorStandardAverageCustom, studioRatingAdvisorThreesomeAverageCustom:
		performerCount := 2
		if category == studioRatingAdvisorThreesomeAverageCustom {
			performerCount = 3
		}
		return fmt.Sprintf(`(
		SELECT COUNT(DISTINCT studio_rating_ps.performer_id)
		FROM performers_scenes studio_rating_ps
		WHERE studio_rating_ps.scene_id = studio_rating_scene.id
	) = %d
	AND NOT EXISTS (
		SELECT 1 FROM rating_criteria_scores studio_rating_score
		WHERE studio_rating_score.entity_type = 'scene'
			AND studio_rating_score.entity_id = studio_rating_scene.id
			AND studio_rating_score.key IN ('soloPerformerAppeal', 'soloPerformance', 'soloUsability')
	)
	AND EXISTS (
		SELECT 1 FROM rating_criteria_scores studio_rating_score
		WHERE studio_rating_score.entity_type = 'scene'
			AND studio_rating_score.entity_id = studio_rating_scene.id
			AND studio_rating_score.key IN ('topAttractiveness', 'bottomAttractiveness', 'chemistry', 'payoff', 'standout')
	)`, performerCount)
	case studioRatingAdvisorGroupAverageCustom:
		return `(
		SELECT COUNT(DISTINCT studio_rating_ps.performer_id)
		FROM performers_scenes studio_rating_ps
		WHERE studio_rating_ps.scene_id = studio_rating_scene.id
	) >= 4
	AND EXISTS (
		SELECT 1 FROM rating_criteria_scores studio_rating_score
		WHERE studio_rating_score.entity_type = 'scene'
			AND studio_rating_score.entity_id = studio_rating_scene.id
			AND studio_rating_score.key IN ('groupTopAttractiveness', 'groupEnergy', 'groupPayoff', 'groupUsability')
	)`
	default:
		return "1 = 1"
	}
}

func studioRatingAdvisorAverageExprCustom(category studioRatingAdvisorAverageSortCustom) string {
	if category == studioRatingAdvisorPerformerAverageCustom {
		return `(
	SELECT AVG(studio_rating_performer.rating)
	FROM performers studio_rating_performer
	WHERE studio_rating_performer.id IN (
		SELECT DISTINCT studio_rating_ps.performer_id
		FROM scenes studio_rating_scene
		JOIN performers_scenes studio_rating_ps ON studio_rating_ps.scene_id = studio_rating_scene.id
		WHERE studio_rating_scene.studio_id = studios.id
	)
	AND EXISTS (
		SELECT 1 FROM rating_criteria_scores studio_rating_score
		WHERE studio_rating_score.entity_type = 'performer'
			AND studio_rating_score.entity_id = studio_rating_performer.id
			AND studio_rating_score.key IN ('face', 'body', 'performance', 'ethnicity', 'masculinity')
	)
)`
	}

	condition := studioRatingAdvisorSceneConditionCustom(category)
	if category == studioRatingAdvisorOverallAverageCustom {
		condition = fmt.Sprintf("((%s) OR (%s) OR (%s) OR (%s))",
			studioRatingAdvisorSceneConditionCustom(studioRatingAdvisorSoloAverageCustom),
			studioRatingAdvisorSceneConditionCustom(studioRatingAdvisorStandardAverageCustom),
			studioRatingAdvisorSceneConditionCustom(studioRatingAdvisorThreesomeAverageCustom),
			studioRatingAdvisorSceneConditionCustom(studioRatingAdvisorGroupAverageCustom),
		)
	}
	categoryClause := "\n\tAND " + condition

	return fmt.Sprintf(`(
	SELECT AVG(studio_rating_scene.rating)
	FROM scenes studio_rating_scene
	WHERE studio_rating_scene.studio_id = studios.id%s
)`, categoryClause)
}

func (qb *StudioStore) sortByRatingAdvisorAverageCustom(category studioRatingAdvisorAverageSortCustom, direction string) string {
	return fmt.Sprintf(" ORDER BY %s %s", studioRatingAdvisorAverageExprCustom(category), getSortDirection(direction))
}
