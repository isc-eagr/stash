package sqlite

import (
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/assert"
)

func TestDefaultPerformerGenderCustom(t *testing.T) {
	t.Run("defaults missing gender to male", func(t *testing.T) {
		input := &models.CreatePerformerInput{Performer: &models.Performer{}}

		defaultPerformerGenderCustom(input)

		if assert.NotNil(t, input.Gender) {
			assert.Equal(t, models.GenderEnumMale, *input.Gender)
		}
	})

	t.Run("preserves explicit gender", func(t *testing.T) {
		gender := models.GenderEnumFemale
		input := &models.CreatePerformerInput{
			Performer: &models.Performer{Gender: &gender},
		}

		defaultPerformerGenderCustom(input)

		if assert.NotNil(t, input.Gender) {
			assert.Equal(t, models.GenderEnumFemale, *input.Gender)
		}
	})

	t.Run("accepts incomplete input", func(t *testing.T) {
		assert.NotPanics(t, func() {
			defaultPerformerGenderCustom(nil)
			defaultPerformerGenderCustom(&models.CreatePerformerInput{})
		})
	})
}
