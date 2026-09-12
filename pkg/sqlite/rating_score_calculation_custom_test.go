package sqlite

import (
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/assert"
)

func TestCanonicalRatingScoreContributionIgnoresPersistedWeight(t *testing.T) {
	row := ratingScoreRow{
		EntityType:    models.RatingEntityScene,
		Section:       models.RatingScoreSectionCriterion,
		Key:           "chemistry",
		RawValue:      9,
		WeightedValue: 3.6,
	}

	assert.InDelta(t, 2, canonicalRatingScoreContributionCustom(row), 0.0001)
}

func TestCanonicalRatingScoreContributionUsesCurrentScales(t *testing.T) {
	tests := []struct {
		name     string
		row      ratingScoreRow
		expected float64
	}{
		{
			name: "solo performance",
			row: ratingScoreRow{
				EntityType: models.RatingEntityScene,
				Section:    models.RatingScoreSectionCriterion,
				Key:        "soloPerformance",
				RawValue:   4,
			},
			expected: 3,
		},
		{
			name: "group energy coordination",
			row: ratingScoreRow{
				EntityType: models.RatingEntityScene,
				Section:    models.RatingScoreSectionCriterion,
				Key:        "groupEnergy",
				RawValue:   5,
			},
			expected: 4,
		},
		{
			name: "bonus uses raw contribution",
			row: ratingScoreRow{
				EntityType:    models.RatingEntityScene,
				Section:       models.RatingScoreSectionBonus,
				Key:           "godTierOrgasm",
				RawValue:      1,
				WeightedValue: 2,
			},
			expected: 1,
		},
		{
			name: "group attractive bottom bonus is five rating points",
			row: ratingScoreRow{
				EntityType: models.RatingEntityScene,
				Section:    models.RatingScoreSectionBonus,
				Key:        "groupBottomAttractiveness",
				RawValue:   0.5,
			},
			expected: 0.5,
		},
		{
			name: "retired criterion",
			row: ratingScoreRow{
				EntityType:    models.RatingEntityScene,
				Section:       models.RatingScoreSectionCriterion,
				Key:           "performerAppeal",
				RawValue:      7,
				WeightedValue: 2.8,
			},
			expected: 0,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.InDelta(t, test.expected, canonicalRatingScoreContributionCustom(test.row), 0.0001)
		})
	}
}

func TestCanonicalRatingScoreContributionRecomputesPerformerWeight(t *testing.T) {
	row := ratingScoreRow{
		EntityType:    models.RatingEntityPerformer,
		Section:       models.RatingScoreSectionCriterion,
		Key:           "face",
		RawValue:      8,
		WeightedValue: 2.4,
	}

	assert.InDelta(t, 3, canonicalRatingScoreContributionCustom(row), 0.0001)
}

func TestCanonicalRatingScoreContributionSupportsEveryOrgasmQualityLevel(t *testing.T) {
	for _, key := range []string{"payoff", "groupPayoff"} {
		for rawValue, expected := range []float64{0, 0.5, 1, 1.5, 2} {
			row := ratingScoreRow{
				EntityType: models.RatingEntityScene,
				Section:    models.RatingScoreSectionCriterion,
				Key:        key,
				RawValue:   float64(rawValue),
			}

			assert.InDelta(
				t,
				expected,
				canonicalRatingScoreContributionCustom(row),
				0.0001,
				"%s level %d",
				key,
				rawValue,
			)
		}
	}
}

func TestGoatElementSupportsEveryBonusLevelInEverySceneRubric(t *testing.T) {
	for name, rubric := range map[string]ratingScoreRubricCustom{
		"standard": defaultSceneRatingRubricCustom,
		"solo":     soloSceneRatingRubricCustom,
		"group":    groupSceneRatingRubricCustom,
	} {
		t.Run(name, func(t *testing.T) {
			_, _, err := canonicalRatingScoreInputCustom(
				rubric,
				models.RatingScoreSectionBonus,
				"goatElement",
				0,
			)
			assert.Error(t, err, "an absent GOAT bonus must be deleted instead of stored as zero")

			for _, expected := range []float64{0.5, 1, 1.5, 2} {
				raw, weighted, err := canonicalRatingScoreInputCustom(
					rubric,
					models.RatingScoreSectionBonus,
					"goatElement",
					expected,
				)
				assert.NoError(t, err)
				assert.Equal(t, expected, raw)
				assert.Equal(t, expected, weighted)
			}
		})
	}
}

func TestCanonicalRatingScoreContributionTreatsLegacyGoatZeroAsAbsent(t *testing.T) {
	row := ratingScoreRow{
		EntityType: models.RatingEntityScene,
		Section:    models.RatingScoreSectionBonus,
		Key:        "goatElement",
		RawValue:   0,
	}

	assert.Zero(t, canonicalRatingScoreContributionCustom(row))
}

func TestCanonicalRatingScoreInputRejectsUnsupportedValues(t *testing.T) {
	_, _, err := canonicalRatingScoreInputCustom(
		defaultSceneRatingRubricCustom,
		models.RatingScoreSectionCriterion,
		"payoff",
		1.5,
	)
	assert.Error(t, err)

	raw, weighted, err := canonicalRatingScoreInputCustom(
		defaultSceneRatingRubricCustom,
		models.RatingScoreSectionCriterion,
		"payoff",
		1,
	)
	assert.NoError(t, err)
	assert.Equal(t, 1.0, raw)
	assert.InDelta(t, 0.5, weighted, 0.0001)

	raw, weighted, err = canonicalRatingScoreInputCustom(
		performerRatingRubricCustom,
		models.RatingScoreSectionCriterion,
		"face",
		5,
	)
	assert.NoError(t, err)
	assert.Equal(t, 5.0, raw)
	assert.InDelta(t, 3, weighted, 0.0001)
}

func TestGroupAttractiveBottomBonusAcceptsFivePoints(t *testing.T) {
	raw, weighted, err := canonicalRatingScoreInputCustom(
		groupSceneRatingRubricCustom,
		models.RatingScoreSectionBonus,
		"groupBottomAttractiveness",
		0.5,
	)
	assert.NoError(t, err)
	assert.Equal(t, 0.5, raw)
	assert.Equal(t, 0.5, weighted)

	_, _, err = canonicalRatingScoreInputCustom(
		groupSceneRatingRubricCustom,
		models.RatingScoreSectionBonus,
		"groupBottomAttractiveness",
		1,
	)
	assert.Error(t, err)
}

func TestExtremelyPolishedPenaltyIsSupportedByEverySceneRubric(t *testing.T) {
	for name, rubric := range map[string]ratingScoreRubricCustom{
		"standard": defaultSceneRatingRubricCustom,
		"solo":     soloSceneRatingRubricCustom,
		"group":    groupSceneRatingRubricCustom,
	} {
		t.Run(name, func(t *testing.T) {
			raw, weighted, err := canonicalRatingScoreInputCustom(
				rubric,
				models.RatingScoreSectionPenalty,
				"extremelyPolished",
				-1,
			)
			assert.NoError(t, err)
			assert.Equal(t, -1.0, raw)
			assert.Equal(t, -1.0, weighted)
		})
	}
}

func TestRetiredSceneRatingKeysAreExcludedFromEveryRubric(t *testing.T) {
	retiredBySection := map[string][]string{
		models.RatingScoreSectionCriterion: {
			"performerAppeal",
			"cameraWork",
			"groupParticipation",
			"groupStandout",
		},
		models.RatingScoreSectionBonus: {
			"largeGroup",
			"outstandingPerformance",
			"standoutAct",
		},
	}
	rubrics := []map[string]map[string]struct{}{
		defaultSceneRatingScoreKeys,
		groupSceneRatingScoreKeys,
		soloSceneRatingScoreKeys,
	}

	for _, rubric := range rubrics {
		for section, keys := range retiredBySection {
			for _, key := range keys {
				assert.False(t, ratingScoreKeyAllowed(rubric, section, key), "%s/%s must stay retired", section, key)
			}
		}
	}
}

func TestCalculateOrgasmRatingBonusUsesProgressiveDoublingTiers(t *testing.T) {
	tests := []struct {
		name       string
		entityType string
		count      int
		expected   int
	}{
		{name: "scene before activation", entityType: models.RatingEntityScene, count: 2, expected: 0},
		{name: "scene fourth O stays in first tier", entityType: models.RatingEntityScene, count: 4, expected: 2},
		{name: "scene sixth O enters second tier", entityType: models.RatingEntityScene, count: 6, expected: 5},
		{name: "scene twelfth O enters third tier", entityType: models.RatingEntityScene, count: 12, expected: 18},
		{name: "scene twenty fourth O enters fourth tier", entityType: models.RatingEntityScene, count: 24, expected: 55},
		{name: "performer before activation", entityType: models.RatingEntityPerformer, count: 2, expected: 0},
		{name: "performer does not award the fourth O", entityType: models.RatingEntityPerformer, count: 4, expected: 1},
		{name: "performer seventh O enters second tier", entityType: models.RatingEntityPerformer, count: 7, expected: 4},
		{name: "performer does not award the twelfth O", entityType: models.RatingEntityPerformer, count: 12, expected: 8},
		{name: "performer thirteenth O enters third tier", entityType: models.RatingEntityPerformer, count: 13, expected: 11},
		{name: "unsupported entity", entityType: "studio", count: 24, expected: 0},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.expected, calculateOrgasmRatingBonus(test.entityType, test.count))
		})
	}
}
