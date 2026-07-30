package sqlite

import (
	"fmt"
	"math"

	"github.com/stashapp/stash/pkg/models"
)

// CUSTOM: canonical advisor rubrics keep validation and recalculation
// independent from client-provided or stale persisted weighted_value rows.
type ratingScoreMetricCustom struct {
	choices []float64
	weight  float64
}

type ratingScoreRubricCustom map[string]map[string]ratingScoreMetricCustom

func ratingRangeChoicesCustom(max int) []float64 {
	ret := make([]float64, max+1)
	for i := range ret {
		ret[i] = float64(i)
	}
	return ret
}

var defaultSceneRatingRubricCustom = ratingScoreRubricCustom{
	models.RatingScoreSectionCriterion: {
		"topAttractiveness":    {choices: ratingRangeChoicesCustom(5), weight: 0.6},
		"bottomAttractiveness": {choices: ratingRangeChoicesCustom(5), weight: 0.2},
		"chemistry":            {choices: ratingRangeChoicesCustom(5), weight: 0.4},
		"payoff":               {choices: ratingRangeChoicesCustom(4), weight: 0.5},
		"standout":             {choices: ratingRangeChoicesCustom(4), weight: 0.5},
	},
	models.RatingScoreSectionBonus: {
		"theme":         {choices: []float64{0, 0.5}, weight: 1},
		"oralOnly":      {choices: []float64{0, 0.5}, weight: 1},
		"godTierOrgasm": {choices: []float64{0, 1}, weight: 1},
		"goatElement":   {choices: []float64{0, 2}, weight: 1},
		"unlikelyTop":   {choices: []float64{0, 0.5}, weight: 1},
	},
	models.RatingScoreSectionPenalty: {
		"noOrgasm":   {choices: []float64{0, -2}, weight: 1},
		"production": {choices: []float64{0, -1}, weight: 1},
	},
}

var groupSceneRatingRubricCustom = ratingScoreRubricCustom{
	models.RatingScoreSectionCriterion: {
		"groupTopAttractiveness": {choices: ratingRangeChoicesCustom(5), weight: 0.4},
		"groupEnergy":            {choices: ratingRangeChoicesCustom(5), weight: 0.8},
		"groupPayoff":            {choices: ratingRangeChoicesCustom(4), weight: 0.5},
		"groupUsability":         {choices: ratingRangeChoicesCustom(4), weight: 0.5},
	},
	models.RatingScoreSectionBonus: {
		"groupBottomAttractiveness": {choices: []float64{0, 1}, weight: 1},
		"groupOralOnly":             {choices: []float64{0, 2}, weight: 1},
		"theme":                     {choices: []float64{0, 0.5}, weight: 1},
		"godTierOrgasm":             {choices: []float64{0, 1}, weight: 1},
		"goatElement":               {choices: []float64{0, 2}, weight: 1},
	},
	models.RatingScoreSectionPenalty: {
		"noOrgasm":   {choices: []float64{0, -2}, weight: 1},
		"production": {choices: []float64{0, -1}, weight: 1},
	},
}

var soloSceneRatingRubricCustom = ratingScoreRubricCustom{
	models.RatingScoreSectionCriterion: {
		"soloPerformerAppeal": {choices: ratingRangeChoicesCustom(5), weight: 1},
		"soloPerformance":     {choices: ratingRangeChoicesCustom(4), weight: 0.75},
		"soloUsability":       {choices: ratingRangeChoicesCustom(4), weight: 0.5},
	},
	models.RatingScoreSectionBonus: {
		"orgasmBonus": {choices: []float64{0, 1}, weight: 1},
		"feetBonus":   {choices: []float64{0, 1}, weight: 1},
		"goatElement": {choices: []float64{0, 2}, weight: 1},
		"theme":       {choices: []float64{0, 0.5}, weight: 1},
	},
	models.RatingScoreSectionPenalty: {
		"noOrgasm":   {choices: []float64{0, -2}, weight: 1},
		"production": {choices: []float64{0, -1}, weight: 1},
	},
}

var performerRatingRubricCustom = ratingScoreRubricCustom{
	models.RatingScoreSectionCriterion: {
		"face":        {choices: ratingRangeChoicesCustom(5), weight: 0.6},
		"body":        {choices: ratingRangeChoicesCustom(5), weight: 0.6},
		"performance": {choices: ratingRangeChoicesCustom(5), weight: 0.4},
		"ethnicity":   {choices: ratingRangeChoicesCustom(3), weight: 1.0 / 3.0},
		"masculinity": {choices: ratingRangeChoicesCustom(3), weight: 1.0 / 3.0},
	},
	models.RatingScoreSectionBonus: {
		"consistency":  {choices: []float64{0, 0.5}, weight: 1},
		"dick":         {choices: []float64{0, 0.5}, weight: 1},
		"tattoosBonus": {choices: []float64{0, 0.5}, weight: 1},
	},
	models.RatingScoreSectionPenalty: {
		"feminine": {choices: []float64{0, -1}, weight: 1},
	},
}

func ratingScoreKeysForRubricCustom(rubric ratingScoreRubricCustom) map[string]map[string]struct{} {
	ret := make(map[string]map[string]struct{}, len(rubric))
	for section, metrics := range rubric {
		ret[section] = make(map[string]struct{}, len(metrics))
		for key := range metrics {
			ret[section][key] = struct{}{}
		}
	}
	return ret
}

func ratingScoreMetricForRowCustom(row ratingScoreRow) (ratingScoreMetricCustom, bool) {
	rubrics := []ratingScoreRubricCustom{performerRatingRubricCustom}
	if row.EntityType == models.RatingEntityScene {
		rubrics = []ratingScoreRubricCustom{
			defaultSceneRatingRubricCustom,
			groupSceneRatingRubricCustom,
			soloSceneRatingRubricCustom,
		}
	}

	for _, rubric := range rubrics {
		if metric, ok := rubric[row.Section][row.Key]; ok {
			return metric, true
		}
	}
	return ratingScoreMetricCustom{}, false
}

func nearestRatingScoreChoiceCustom(rawValue float64, choices []float64) float64 {
	nearest := choices[0]
	nearestDistance := math.Abs(rawValue - nearest)
	for _, choice := range choices[1:] {
		distance := math.Abs(rawValue - choice)
		if distance < nearestDistance {
			nearest = choice
			nearestDistance = distance
		}
	}
	return nearest
}

func exactRatingScoreChoiceCustom(rawValue float64, choices []float64) (float64, bool) {
	for _, choice := range choices {
		if math.Abs(rawValue-choice) < 0.000001 {
			return choice, true
		}
	}
	return 0, false
}

func canonicalRatingScoreInputCustom(rubric ratingScoreRubricCustom, section, key string, rawValue float64) (float64, float64, error) {
	metric, ok := rubric[section][key]
	if !ok {
		return 0, 0, fmt.Errorf("rating score %s/%s is not valid for the current rubric", section, key)
	}

	choice, ok := exactRatingScoreChoiceCustom(rawValue, metric.choices)
	if !ok {
		return 0, 0, fmt.Errorf("rating score %s/%s has unsupported raw value %g", section, key, rawValue)
	}

	return choice, choice * metric.weight, nil
}

func canonicalRatingScoreContributionCustom(row ratingScoreRow) float64 {
	metric, ok := ratingScoreMetricForRowCustom(row)
	if !ok || len(metric.choices) == 0 {
		return 0
	}

	return nearestRatingScoreChoiceCustom(row.RawValue, metric.choices) * metric.weight
}
