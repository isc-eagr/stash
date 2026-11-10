package sqlite

import (
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/assert"
)

func TestRatingScoreResolveUsesGloballyUniqueGraphQLIDCustom(t *testing.T) {
	criterion := ratingScoreRow{
		ID:         332,
		EntityType: models.RatingEntityScene,
		EntityID:   29071,
		Key:        "payoff",
	}.resolve(models.RatingScoreSectionCriterion)
	bonus := ratingScoreRow{
		ID:         332,
		EntityType: models.RatingEntityScene,
		EntityID:   29071,
		Key:        "goatElement",
	}.resolve(models.RatingScoreSectionBonus)

	assert.Equal(t, "scene:29071:criterion:payoff", criterion.ID)
	assert.Equal(t, "scene:29071:bonus:goatElement", bonus.ID)
	assert.NotEqual(t, criterion.ID, bonus.ID, "rows from separate score tables must not collide in the GraphQL cache")
}
