package api

import (
	"context"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/models/mocks"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestUsesGroupSceneRatingCustom(t *testing.T) {
	require.False(t, usesGroupSceneRatingCustom(3))
	require.True(t, usesGroupSceneRatingCustom(4))
	require.True(t, usesGroupSceneRatingCustom(8))
}

func TestHasEffectiveRatingAdvisorScoresCustom(t *testing.T) {
	require.False(t, hasEffectiveRatingAdvisorScoresCustom([]*models.RatingScore{{
		Section:  models.RatingScoreSectionBonus,
		RawValue: 0,
	}}))
	require.True(t, hasEffectiveRatingAdvisorScoresCustom([]*models.RatingScore{{
		Section:  models.RatingScoreSectionCriterion,
		RawValue: 0,
	}}))
	require.True(t, hasEffectiveRatingAdvisorScoresCustom([]*models.RatingScore{{
		Section:  models.RatingScoreSectionPenalty,
		RawValue: -1,
	}}))
}

func TestSyncSceneAdvisorAfterCastChangeCustom(t *testing.T) {
	db := mocks.NewDatabase()
	resolver := newResolver(db)
	db.Scene.On("GetPerformerIDs", mock.Anything, 1).Return([]int{2, 3, 4, 5}, nil).Once()
	db.RatingScore.On("ResetSceneScores", mock.Anything, 1).Return(true, nil).Once()
	for _, performerID := range []int{1, 2, 3, 4, 5} {
		db.RatingScore.On("FindByEntity", mock.Anything, models.RatingEntityPerformer, performerID).
			Return([]*models.RatingScore{}, nil).Once()
	}

	err := resolver.syncSceneAdvisorAfterCastChangeCustom(context.Background(), 1, []int{1, 2, 3})
	require.NoError(t, err)
	db.AssertExpectations(t)
}

func TestResetSceneAdvisorsIfModeChangedCustom(t *testing.T) {
	db := mocks.NewDatabase()
	resolver := newResolver(db)
	db.RatingScore.On("SceneMode", mock.Anything, 9).Return(models.RatingSceneModeSolo, nil).Once()
	db.RatingScore.On("ResetSceneScores", mock.Anything, 9).Return(true, nil).Once()

	err := resolver.resetSceneAdvisorsIfModeChangedCustom(context.Background(), map[int]string{
		9: models.RatingSceneModeDefault,
	})
	require.NoError(t, err)
	db.AssertExpectations(t)
}

func TestRatingAdvisorRoleTagIDsCustom(t *testing.T) {
	actual := ratingAdvisorRoleTagIDsCustom(map[string]interface{}{
		"roleTagIds": map[string]interface{}{
			"sexTagId":    "11",
			"oralTagId":   "12",
			"soloTagId":   "13",
			"orgasmTagId": "14",
		},
	})
	require.Equal(t, [3]string{"11", "12", "13"}, actual)
}

func TestResetSceneAdvisorsAfterRoleTagConfigChangeCustom(t *testing.T) {
	db := mocks.NewDatabase()
	resolver := newResolver(db)
	db.RatingScore.On("ResetAllSceneScores", mock.Anything).Return(2, nil).Once()

	err := resolver.resetSceneAdvisorsAfterRoleTagConfigChangeCustom(
		context.Background(),
		[3]string{"11", "12", "13"},
		map[string]interface{}{"roleTagIds": map[string]interface{}{
			"sexTagId":  "11",
			"oralTagId": "12",
			"soloTagId": "99",
		}},
	)
	require.NoError(t, err)
	db.AssertExpectations(t)
}

func TestResetSceneAdvisorsSkipsUnchangedRoleTagConfigCustom(t *testing.T) {
	db := mocks.NewDatabase()
	resolver := newResolver(db)

	err := resolver.resetSceneAdvisorsAfterRoleTagConfigChangeCustom(
		context.Background(),
		[3]string{"11", "12", "13"},
		map[string]interface{}{"roleTagIds": map[string]interface{}{
			"sexTagId":  "11",
			"oralTagId": "12",
			"soloTagId": "13",
		}},
	)
	require.NoError(t, err)
	db.AssertExpectations(t)
}

func TestRatingScoreDeleteRecalculatesRemainingAdvisorRows(t *testing.T) {
	db := mocks.NewDatabase()
	resolver := newResolver(db)
	rating := 70
	db.Scene.On("Find", mock.Anything, 4).Return(&models.Scene{ID: 4, Rating: &rating}, nil).Once()
	db.RatingScore.On(
		"Delete",
		mock.Anything,
		models.RatingEntityScene,
		4,
		models.RatingScoreSectionBonus,
		"theme",
	).Return(true, nil).Once()
	remaining := []*models.RatingScore{{
		EntityType: models.RatingEntityScene,
		EntityID:   4,
		Section:    models.RatingScoreSectionCriterion,
		Key:        "topAttractiveness",
		RawValue:   0,
	}}
	db.RatingScore.On("FindByEntity", mock.Anything, models.RatingEntityScene, 4).Return(remaining, nil).Once()
	db.RatingScore.On("RecalculateRating", mock.Anything, models.RatingEntityScene, 4).Return(42, nil).Once()

	result, err := resolver.Mutation().RatingScoreDelete(context.Background(), models.RatingScoreDeleteInput{
		EntityType: models.RatingEntityScene,
		EntityID:   4,
		Section:    models.RatingScoreSectionBonus,
		Key:        "theme",
	})
	require.NoError(t, err)
	require.Equal(t, 42, result.Rating100)
	require.Equal(t, remaining, result.Scores)
	db.AssertExpectations(t)
}

func TestRatingScoreResetPreservesCurrentRating(t *testing.T) {
	db := mocks.NewDatabase()
	resolver := newResolver(db)
	rating := 83
	db.Performer.On("Find", mock.Anything, 8).Return(&models.Performer{ID: 8, Rating: &rating}, nil).Twice()
	db.RatingScore.On("DeleteByEntity", mock.Anything, models.RatingEntityPerformer, 8).Return(nil).Once()
	db.RatingScore.On("FindByEntity", mock.Anything, models.RatingEntityPerformer, 8).Return([]*models.RatingScore{}, nil).Once()

	result, err := resolver.Mutation().RatingScoreReset(context.Background(), models.RatingEntityPerformer, "8")
	require.NoError(t, err)
	require.Equal(t, 83, result.Rating100)
	require.Empty(t, result.Scores)
	db.AssertExpectations(t)
}
