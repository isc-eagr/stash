package api

// CUSTOM: Studio-level Rating Advisor aggregates for the Studio Stats tab.

import (
	"context"
	"fmt"
	"math"
	"sort"

	"github.com/stashapp/stash/internal/manager"
	"github.com/stashapp/stash/pkg/models"
)

const (
	studioRatingAdvisorSoloScenesCustom  = "solo_scenes"
	studioRatingAdvisorSexScenesCustom   = "sex_scenes"
	studioRatingAdvisorGroupScenesCustom = "group_scenes"
	studioRatingAdvisorPerformersCustom  = "performers"
)

type studioRatingAdvisorMetricConfigCustom struct {
	choices []float64
	weight  float64
}

type studioRatingAdvisorSectionConfigCustom struct {
	criteria        map[string]studioRatingAdvisorMetricConfigCustom
	criterionOrder  []string
	adjustments     map[string]map[string]struct{}
	adjustmentOrder []string
}

type studioRatingAdvisorScoreRowCustom struct {
	category      string
	entityID      int
	section       string
	key           string
	rawValue      float64
	weightedValue float64
	rating100     *float64
}

type studioRatingAdvisorCriterionAccumulatorCustom struct {
	rawTotal      float64
	weightedTotal float64
	fillTotal     float64
	entityIDs     map[int]struct{}
}

type studioRatingAdvisorSectionAccumulatorCustom struct {
	entityIDs   map[int]struct{}
	ratings     map[int]float64
	criteria    map[string]*studioRatingAdvisorCriterionAccumulatorCustom
	adjustments map[string]map[int]struct{}
}

func studioRatingAdvisorRangeChoicesCustom(max int) []float64 {
	ret := make([]float64, max+1)
	for i := range ret {
		ret[i] = float64(i)
	}
	return ret
}

func studioRatingAdvisorMetricCustom(choices []float64, weight float64) studioRatingAdvisorMetricConfigCustom {
	return studioRatingAdvisorMetricConfigCustom{choices: choices, weight: weight}
}

func studioRatingAdvisorAdjustmentKeysCustom(bonuses, penalties []string) map[string]map[string]struct{} {
	ret := map[string]map[string]struct{}{
		models.RatingScoreSectionBonus:   {},
		models.RatingScoreSectionPenalty: {},
	}
	for _, key := range bonuses {
		ret[models.RatingScoreSectionBonus][key] = struct{}{}
	}
	for _, key := range penalties {
		ret[models.RatingScoreSectionPenalty][key] = struct{}{}
	}
	return ret
}

var studioRatingAdvisorConfigsCustom = map[string]studioRatingAdvisorSectionConfigCustom{
	studioRatingAdvisorSoloScenesCustom: {
		criteria: map[string]studioRatingAdvisorMetricConfigCustom{
			"soloPerformerAppeal": studioRatingAdvisorMetricCustom(studioRatingAdvisorRangeChoicesCustom(5), 1),
			"soloPerformance":     studioRatingAdvisorMetricCustom(studioRatingAdvisorRangeChoicesCustom(4), 0.75),
			"soloUsability":       studioRatingAdvisorMetricCustom(studioRatingAdvisorRangeChoicesCustom(4), 0.5),
		},
		criterionOrder: []string{"soloPerformerAppeal", "soloPerformance", "soloUsability"},
		adjustments: studioRatingAdvisorAdjustmentKeysCustom(
			[]string{"orgasm-count-bonus", "orgasmBonus", "feetBonus", "theme", "goatElement"},
			[]string{"noOrgasm", "production"},
		),
		adjustmentOrder: []string{"orgasm-count-bonus", "orgasmBonus", "feetBonus", "theme", "goatElement", "noOrgasm", "production"},
	},
	studioRatingAdvisorSexScenesCustom: {
		criteria: map[string]studioRatingAdvisorMetricConfigCustom{
			"topAttractiveness":    studioRatingAdvisorMetricCustom(studioRatingAdvisorRangeChoicesCustom(5), 0.6),
			"bottomAttractiveness": studioRatingAdvisorMetricCustom(studioRatingAdvisorRangeChoicesCustom(5), 0.2),
			"chemistry":            studioRatingAdvisorMetricCustom(studioRatingAdvisorRangeChoicesCustom(5), 0.4),
			"payoff":               studioRatingAdvisorMetricCustom(studioRatingAdvisorRangeChoicesCustom(4), 0.5),
			"standout":             studioRatingAdvisorMetricCustom(studioRatingAdvisorRangeChoicesCustom(4), 0.5),
		},
		criterionOrder: []string{"topAttractiveness", "bottomAttractiveness", "chemistry", "payoff", "standout"},
		adjustments: studioRatingAdvisorAdjustmentKeysCustom(
			[]string{"orgasm-count-bonus", "theme", "oralOnly", "godTierOrgasm", "goatElement", "unlikelyTop"},
			[]string{"noOrgasm", "production"},
		),
		adjustmentOrder: []string{"orgasm-count-bonus", "theme", "oralOnly", "godTierOrgasm", "goatElement", "unlikelyTop", "noOrgasm", "production"},
	},
	studioRatingAdvisorGroupScenesCustom: {
		criteria: map[string]studioRatingAdvisorMetricConfigCustom{
			"groupTopAttractiveness": studioRatingAdvisorMetricCustom(studioRatingAdvisorRangeChoicesCustom(5), 0.4),
			"groupEnergy":            studioRatingAdvisorMetricCustom(studioRatingAdvisorRangeChoicesCustom(5), 0.8),
			"groupPayoff":            studioRatingAdvisorMetricCustom(studioRatingAdvisorRangeChoicesCustom(4), 0.5),
			"groupUsability":         studioRatingAdvisorMetricCustom(studioRatingAdvisorRangeChoicesCustom(4), 0.5),
		},
		criterionOrder: []string{"groupTopAttractiveness", "groupEnergy", "groupPayoff", "groupUsability"},
		adjustments: studioRatingAdvisorAdjustmentKeysCustom(
			[]string{"orgasm-count-bonus", "groupBottomAttractiveness", "groupOralOnly", "theme", "godTierOrgasm", "goatElement"},
			[]string{"noOrgasm", "production"},
		),
		adjustmentOrder: []string{"orgasm-count-bonus", "groupBottomAttractiveness", "groupOralOnly", "theme", "godTierOrgasm", "goatElement", "noOrgasm", "production"},
	},
	studioRatingAdvisorPerformersCustom: {
		criteria: map[string]studioRatingAdvisorMetricConfigCustom{
			"face":        studioRatingAdvisorMetricCustom(studioRatingAdvisorRangeChoicesCustom(5), 0.6),
			"body":        studioRatingAdvisorMetricCustom(studioRatingAdvisorRangeChoicesCustom(5), 0.6),
			"performance": studioRatingAdvisorMetricCustom(studioRatingAdvisorRangeChoicesCustom(5), 0.4),
			"ethnicity":   studioRatingAdvisorMetricCustom(studioRatingAdvisorRangeChoicesCustom(3), 1.0/3.0),
			"masculinity": studioRatingAdvisorMetricCustom(studioRatingAdvisorRangeChoicesCustom(3), 1.0/3.0),
		},
		criterionOrder: []string{"face", "body", "performance", "ethnicity", "masculinity"},
		adjustments: studioRatingAdvisorAdjustmentKeysCustom(
			[]string{"orgasm-count-bonus", "consistency", "dick", "tattoosBonus"},
			[]string{"feminine"},
		),
		adjustmentOrder: []string{"orgasm-count-bonus", "consistency", "dick", "tattoosBonus", "feminine"},
	},
}

const studioRatingAdvisorStatsQueryBodyCustom = `,
eligible_entities(category, entity_type, entity_id, rating100) AS (
  SELECT 'solo_scenes', 'scene', selected_scenes.id, selected_scenes.rating100
  FROM selected_scenes
  WHERE EXISTS (
    SELECT 1 FROM rating_criteria_scores scores
    WHERE scores.entity_type = 'scene'
      AND scores.entity_id = selected_scenes.id
      AND scores.key IN ('soloPerformerAppeal', 'soloPerformance', 'soloUsability')
  )
  UNION ALL
  SELECT 'sex_scenes', 'scene', selected_scenes.id, selected_scenes.rating100
  FROM selected_scenes
  WHERE selected_scenes.performer_count BETWEEN 2 AND 3
    AND NOT EXISTS (
      SELECT 1 FROM rating_criteria_scores scores
      WHERE scores.entity_type = 'scene'
        AND scores.entity_id = selected_scenes.id
        AND scores.key IN ('soloPerformerAppeal', 'soloPerformance', 'soloUsability')
    )
    AND EXISTS (
      SELECT 1 FROM rating_criteria_scores scores
      WHERE scores.entity_type = 'scene'
        AND scores.entity_id = selected_scenes.id
        AND scores.key IN ('topAttractiveness', 'bottomAttractiveness', 'chemistry', 'payoff', 'standout')
    )
  UNION ALL
  SELECT 'group_scenes', 'scene', selected_scenes.id, selected_scenes.rating100
  FROM selected_scenes
  WHERE selected_scenes.performer_count >= 4
    AND EXISTS (
      SELECT 1 FROM rating_criteria_scores scores
      WHERE scores.entity_type = 'scene'
        AND scores.entity_id = selected_scenes.id
        AND scores.key IN ('groupTopAttractiveness', 'groupEnergy', 'groupPayoff', 'groupUsability')
    )
  UNION ALL
  SELECT DISTINCT 'performers', 'performer', performers_scenes.performer_id, performers.rating
  FROM selected_scenes
  JOIN performers_scenes ON performers_scenes.scene_id = selected_scenes.id
  JOIN performers ON performers.id = performers_scenes.performer_id
  WHERE EXISTS (
    SELECT 1 FROM rating_criteria_scores scores
    WHERE scores.entity_type = 'performer'
      AND scores.entity_id = performers_scenes.performer_id
      AND scores.key IN ('face', 'body', 'performance', 'ethnicity', 'masculinity')
  )
),
persisted_scores(category, entity_type, entity_id, section, key, raw_value, weighted_value, rating100) AS (
  SELECT eligible.category, eligible.entity_type, eligible.entity_id, 'criterion', scores.key, scores.raw_value, scores.weighted_value, eligible.rating100
  FROM eligible_entities eligible
  JOIN rating_criteria_scores scores
    ON scores.entity_type = eligible.entity_type AND scores.entity_id = eligible.entity_id
  UNION ALL
  SELECT eligible.category, eligible.entity_type, eligible.entity_id, 'bonus', scores.key, scores.raw_value, scores.weighted_value, eligible.rating100
  FROM eligible_entities eligible
  JOIN rating_bonus_scores scores
    ON scores.entity_type = eligible.entity_type AND scores.entity_id = eligible.entity_id
  WHERE scores.raw_value != 0 OR scores.weighted_value != 0
  UNION ALL
  SELECT eligible.category, eligible.entity_type, eligible.entity_id, 'penalty', scores.key, scores.raw_value, scores.weighted_value, eligible.rating100
  FROM eligible_entities eligible
  JOIN rating_penalty_scores scores
    ON scores.entity_type = eligible.entity_type AND scores.entity_id = eligible.entity_id
  WHERE scores.raw_value != 0 OR scores.weighted_value != 0
  UNION ALL
  SELECT eligible.category, eligible.entity_type, eligible.entity_id, 'bonus', 'orgasm-count-bonus', 1, 1, eligible.rating100
  FROM eligible_entities eligible
  WHERE (
    eligible.entity_type = 'scene'
    AND (SELECT COUNT(*) FROM scenes_o_dates WHERE scenes_o_dates.scene_id = eligible.entity_id) >= 3
  ) OR (
    eligible.entity_type = 'performer'
    AND (
      SELECT COUNT(*)
      FROM scenes_o_dates
      JOIN performers_scenes orgasm_scenes ON orgasm_scenes.scene_id = scenes_o_dates.scene_id
      WHERE orgasm_scenes.performer_id = eligible.entity_id
    ) >= 3
  )
)
SELECT category, entity_id, section, key, raw_value, weighted_value, rating100
FROM persisted_scores
ORDER BY category, entity_id, section, key`

const studioRatingAdvisorStatsQueryCustom = `WITH RECURSIVE selected_studios(id, depth) AS (
  SELECT ?, 0
  UNION ALL
  SELECT studios.id, selected_studios.depth + 1
  FROM studios
  JOIN selected_studios ON studios.parent_id = selected_studios.id
  WHERE ? = -1 OR selected_studios.depth < ?
),
selected_scenes(id, performer_count, rating100) AS (
  SELECT scenes.id, COUNT(DISTINCT performers_scenes.performer_id), scenes.rating
  FROM scenes
  LEFT JOIN performers_scenes ON performers_scenes.scene_id = scenes.id
  WHERE scenes.studio_id IN (SELECT id FROM selected_studios)
  GROUP BY scenes.id
)` + studioRatingAdvisorStatsQueryBodyCustom

const globalRatingAdvisorStatsQueryCustom = `WITH selected_scenes(id, performer_count, rating100) AS (
  SELECT scenes.id, COUNT(DISTINCT performers_scenes.performer_id), scenes.rating
  FROM scenes
  LEFT JOIN performers_scenes ON performers_scenes.scene_id = scenes.id
  GROUP BY scenes.id
)` + studioRatingAdvisorStatsQueryBodyCustom

func studioRatingAdvisorNearestChoiceIndexCustom(metric studioRatingAdvisorMetricConfigCustom, rawValue float64) int {
	if len(metric.choices) == 0 {
		return 0
	}

	nearestIndex := 0
	nearestDistance := math.Abs(rawValue - metric.choices[0])
	for index, choice := range metric.choices[1:] {
		distance := math.Abs(rawValue - choice)
		if distance < nearestDistance {
			nearestIndex = index + 1
			nearestDistance = distance
		}
	}
	return nearestIndex
}

func studioRatingAdvisorFillPercentCustom(metric studioRatingAdvisorMetricConfigCustom, rawValue float64) float64 {
	if len(metric.choices) <= 1 {
		return 0
	}

	nearestIndex := studioRatingAdvisorNearestChoiceIndexCustom(metric, rawValue)
	if nearestIndex == 0 {
		return 0
	}
	return float64(nearestIndex) / float64(len(metric.choices)-1) * 100
}

func studioRatingAdvisorWeightedValueCustom(metric studioRatingAdvisorMetricConfigCustom, rawValue float64) float64 {
	if len(metric.choices) == 0 {
		return 0
	}
	return metric.choices[studioRatingAdvisorNearestChoiceIndexCustom(metric, rawValue)] * metric.weight
}

func studioRatingAdvisorEmptyStatsCustom() *StudioRatingAdvisorStats {
	return &StudioRatingAdvisorStats{
		SoloScenes:  &StudioRatingAdvisorSectionStats{Criteria: []*StudioRatingAdvisorCriterionAverage{}, Adjustments: []*StudioRatingAdvisorAdjustmentCount{}},
		SexScenes:   &StudioRatingAdvisorSectionStats{Criteria: []*StudioRatingAdvisorCriterionAverage{}, Adjustments: []*StudioRatingAdvisorAdjustmentCount{}},
		GroupScenes: &StudioRatingAdvisorSectionStats{Criteria: []*StudioRatingAdvisorCriterionAverage{}, Adjustments: []*StudioRatingAdvisorAdjustmentCount{}},
		Performers:  &StudioRatingAdvisorSectionStats{Criteria: []*StudioRatingAdvisorCriterionAverage{}, Adjustments: []*StudioRatingAdvisorAdjustmentCount{}},
	}
}

func studioRatingAdvisorResultSectionCustom(ret *StudioRatingAdvisorStats, category string) *StudioRatingAdvisorSectionStats {
	switch category {
	case studioRatingAdvisorSoloScenesCustom:
		return ret.SoloScenes
	case studioRatingAdvisorSexScenesCustom:
		return ret.SexScenes
	case studioRatingAdvisorGroupScenesCustom:
		return ret.GroupScenes
	case studioRatingAdvisorPerformersCustom:
		return ret.Performers
	default:
		return nil
	}
}

func aggregateStudioRatingAdvisorRowsCustom(rows []studioRatingAdvisorScoreRowCustom) *StudioRatingAdvisorStats {
	ret := studioRatingAdvisorEmptyStatsCustom()
	accumulators := make(map[string]*studioRatingAdvisorSectionAccumulatorCustom, len(studioRatingAdvisorConfigsCustom))
	for category := range studioRatingAdvisorConfigsCustom {
		accumulators[category] = &studioRatingAdvisorSectionAccumulatorCustom{
			entityIDs:   make(map[int]struct{}),
			ratings:     make(map[int]float64),
			criteria:    make(map[string]*studioRatingAdvisorCriterionAccumulatorCustom),
			adjustments: make(map[string]map[int]struct{}),
		}
	}

	for _, row := range rows {
		config, ok := studioRatingAdvisorConfigsCustom[row.category]
		if !ok {
			continue
		}
		accumulator := accumulators[row.category]

		if row.section == models.RatingScoreSectionCriterion {
			metric, valid := config.criteria[row.key]
			if !valid {
				continue
			}
			accumulator.entityIDs[row.entityID] = struct{}{}
			if row.rating100 != nil {
				accumulator.ratings[row.entityID] = *row.rating100
			}
			criterion := accumulator.criteria[row.key]
			if criterion == nil {
				criterion = &studioRatingAdvisorCriterionAccumulatorCustom{entityIDs: make(map[int]struct{})}
				accumulator.criteria[row.key] = criterion
			}
			if _, duplicate := criterion.entityIDs[row.entityID]; duplicate {
				continue
			}
			criterion.entityIDs[row.entityID] = struct{}{}
			criterion.rawTotal += row.rawValue
			criterion.weightedTotal += studioRatingAdvisorWeightedValueCustom(metric, row.rawValue)
			criterion.fillTotal += studioRatingAdvisorFillPercentCustom(metric, row.rawValue)
			continue
		}

		sectionKeys, validSection := config.adjustments[row.section]
		if !validSection {
			continue
		}
		if _, validKey := sectionKeys[row.key]; !validKey {
			continue
		}
		if row.rawValue == 0 && row.weightedValue == 0 {
			continue
		}
		adjustmentKey := row.section + "/" + row.key
		if accumulator.adjustments[adjustmentKey] == nil {
			accumulator.adjustments[adjustmentKey] = make(map[int]struct{})
		}
		accumulator.adjustments[adjustmentKey][row.entityID] = struct{}{}
	}

	for category, config := range studioRatingAdvisorConfigsCustom {
		resultSection := studioRatingAdvisorResultSectionCustom(ret, category)
		accumulator := accumulators[category]
		resultSection.EntityCount = len(accumulator.entityIDs)
		resultSection.AverageRating100 = studioRatingAdvisorAverageCustom(accumulator.ratings)

		for _, key := range config.criterionOrder {
			criterion := accumulator.criteria[key]
			if criterion == nil || len(criterion.entityIDs) == 0 {
				continue
			}
			count := len(criterion.entityIDs)
			resultSection.Criteria = append(resultSection.Criteria, &StudioRatingAdvisorCriterionAverage{
				Key:                  key,
				AverageRawValue:      criterion.rawTotal / float64(count),
				AverageWeightedValue: criterion.weightedTotal / float64(count),
				AverageFillPercent:   criterion.fillTotal / float64(count),
				EntityCount:          count,
			})
		}

		adjustmentOrder := make(map[string]int, len(config.adjustmentOrder))
		for index, key := range config.adjustmentOrder {
			adjustmentOrder[key] = index
		}
		for adjustmentKey, entityIDs := range accumulator.adjustments {
			parts := splitStudioRatingAdvisorAdjustmentKeyCustom(adjustmentKey)
			section, key := parts[0], parts[1]
			resultSection.Adjustments = append(resultSection.Adjustments, &StudioRatingAdvisorAdjustmentCount{
				Section:     section,
				Key:         key,
				EntityCount: len(entityIDs),
			})
		}
		sort.Slice(resultSection.Adjustments, func(i, j int) bool {
			left := resultSection.Adjustments[i]
			right := resultSection.Adjustments[j]
			if left.Section != right.Section {
				return left.Section == models.RatingScoreSectionBonus
			}
			return adjustmentOrder[left.Key] < adjustmentOrder[right.Key]
		})
	}

	overallSceneRatings := make(map[int]float64)
	for _, category := range []string{
		studioRatingAdvisorSoloScenesCustom,
		studioRatingAdvisorSexScenesCustom,
		studioRatingAdvisorGroupScenesCustom,
	} {
		for entityID, rating := range accumulators[category].ratings {
			overallSceneRatings[entityID] = rating
		}
	}
	ret.OverallSceneAverageRating100 = studioRatingAdvisorAverageCustom(overallSceneRatings)

	return ret
}

func studioRatingAdvisorAverageCustom(values map[int]float64) *float64 {
	if len(values) == 0 {
		return nil
	}
	var total float64
	for _, value := range values {
		total += value
	}
	average := total / float64(len(values))
	return &average
}

func splitStudioRatingAdvisorAdjustmentKeyCustom(value string) [2]string {
	for i := range value {
		if value[i] == '/' {
			return [2]string{value[:i], value[i+1:]}
		}
	}
	return [2]string{"", value}
}

func studioRatingAdvisorStringCustom(value interface{}) string {
	if bytes, ok := value.([]byte); ok {
		return string(bytes)
	}
	return fmt.Sprint(value)
}

func queryStudioRatingAdvisorStatsCustom(ctx context.Context, studioID int, depth *int) (*StudioRatingAdvisorStats, error) {
	depthValue := 0
	if depth != nil {
		depthValue = *depth
	}

	return queryRatingAdvisorStatsCustom(
		ctx,
		studioRatingAdvisorStatsQueryCustom,
		[]interface{}{studioID, depthValue, depthValue},
	)
}

func queryGlobalRatingAdvisorStatsCustom(ctx context.Context) (*StudioRatingAdvisorStats, error) {
	return queryRatingAdvisorStatsCustom(ctx, globalRatingAdvisorStatsQueryCustom, nil)
}

func queryRatingAdvisorStatsCustom(ctx context.Context, query string, args []interface{}) (*StudioRatingAdvisorStats, error) {
	_, rawRows, err := manager.GetInstance().Database.QuerySQL(
		ctx,
		query,
		args,
	)
	if err != nil {
		return nil, err
	}

	rows := make([]studioRatingAdvisorScoreRowCustom, 0, len(rawRows))
	for _, rawRow := range rawRows {
		if len(rawRow) < 7 {
			continue
		}
		row := studioRatingAdvisorScoreRowCustom{
			category:      studioRatingAdvisorStringCustom(rawRow[0]),
			entityID:      activityStatsIntCustom(rawRow[1]),
			section:       studioRatingAdvisorStringCustom(rawRow[2]),
			key:           studioRatingAdvisorStringCustom(rawRow[3]),
			rawValue:      activityStatsFloatCustom(rawRow[4]),
			weightedValue: activityStatsFloatCustom(rawRow[5]),
		}
		if rawRow[6] != nil {
			rating := activityStatsFloatCustom(rawRow[6])
			row.rating100 = &rating
		}
		rows = append(rows, row)
	}

	return aggregateStudioRatingAdvisorRowsCustom(rows), nil
}

func (r *queryResolver) GlobalRatingAdvisorStats(ctx context.Context) (ret *StudioRatingAdvisorStats, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = queryGlobalRatingAdvisorStatsCustom(ctx)
		return err
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

func (r *studioResolver) StudioRatingAdvisorStats(ctx context.Context, obj *models.Studio, depth *int) (ret *StudioRatingAdvisorStats, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = queryStudioRatingAdvisorStatsCustom(ctx, obj.ID, depth)
		return err
	}); err != nil {
		return nil, err
	}
	return ret, nil
}
