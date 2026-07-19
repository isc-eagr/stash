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

func TestCanonicalRatingScoreContributionHonorsSparseChoices(t *testing.T) {
	row := ratingScoreRow{
		EntityType: models.RatingEntityScene,
		Section:    models.RatingScoreSectionCriterion,
		Key:        "payoff",
		RawValue:   1,
	}

	assert.Zero(t, canonicalRatingScoreContributionCustom(row))
}

func TestCanonicalRatingScoreInputRejectsUnsupportedValues(t *testing.T) {
	_, _, err := canonicalRatingScoreInputCustom(
		defaultSceneRatingRubricCustom,
		models.RatingScoreSectionCriterion,
		"payoff",
		1,
	)
	assert.Error(t, err)

	raw, weighted, err := canonicalRatingScoreInputCustom(
		performerRatingRubricCustom,
		models.RatingScoreSectionCriterion,
		"face",
		5,
	)
	assert.NoError(t, err)
	assert.Equal(t, 5.0, raw)
	assert.InDelta(t, 3, weighted, 0.0001)
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
