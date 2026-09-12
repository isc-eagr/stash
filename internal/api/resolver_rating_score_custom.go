package api

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/stashapp/stash/pkg/models"
)

func normalizeRatingScoreInput(input models.RatingScoreInput) (models.RatingScore, error) {
	entityType := strings.ToLower(strings.TrimSpace(input.EntityType))
	section := strings.ToLower(strings.TrimSpace(input.Section))
	key := strings.TrimSpace(input.Key)

	if entityType != models.RatingEntityScene && entityType != models.RatingEntityPerformer {
		return models.RatingScore{}, fmt.Errorf("%w: unsupported rating entity type %q", ErrInput, input.EntityType)
	}
	if section != models.RatingScoreSectionCriterion && section != models.RatingScoreSectionBonus && section != models.RatingScoreSectionPenalty {
		return models.RatingScore{}, fmt.Errorf("%w: unsupported rating score section %q", ErrInput, input.Section)
	}
	if input.EntityID <= 0 {
		return models.RatingScore{}, fmt.Errorf("%w: entity_id is required", ErrInput)
	}
	if key == "" {
		return models.RatingScore{}, fmt.Errorf("%w: key is required", ErrInput)
	}

	return models.RatingScore{
		EntityType:    entityType,
		EntityID:      input.EntityID,
		Section:       section,
		Key:           key,
		RawValue:      input.RawValue,
		WeightedValue: input.WeightedValue,
		Label:         input.Label,
	}, nil
}

func normalizeRatingScoreDeleteInput(input models.RatingScoreDeleteInput) (models.RatingScoreDeleteInput, error) {
	input.EntityType = strings.ToLower(strings.TrimSpace(input.EntityType))
	input.Section = strings.ToLower(strings.TrimSpace(input.Section))
	input.Key = strings.TrimSpace(input.Key)
	if input.EntityType != models.RatingEntityScene && input.EntityType != models.RatingEntityPerformer {
		return models.RatingScoreDeleteInput{}, fmt.Errorf("%w: unsupported rating entity type %q", ErrInput, input.EntityType)
	}
	if input.Section != models.RatingScoreSectionCriterion && input.Section != models.RatingScoreSectionBonus && input.Section != models.RatingScoreSectionPenalty {
		return models.RatingScoreDeleteInput{}, fmt.Errorf("%w: unsupported rating score section %q", ErrInput, input.Section)
	}
	if input.EntityID <= 0 {
		return models.RatingScoreDeleteInput{}, fmt.Errorf("%w: entity_id is required", ErrInput)
	}
	if input.Key == "" {
		return models.RatingScoreDeleteInput{}, fmt.Errorf("%w: key is required", ErrInput)
	}
	return input, nil
}

func (r *Resolver) ensureRatingScoreEntityExists(ctx context.Context, entityType string, entityID int) error {
	switch entityType {
	case models.RatingEntityScene:
		scene, err := r.repository.Scene.Find(ctx, entityID)
		if err != nil {
			return err
		}
		if scene == nil {
			return fmt.Errorf("scene %d not found", entityID)
		}
	case models.RatingEntityPerformer:
		performer, err := r.repository.Performer.Find(ctx, entityID)
		if err != nil {
			return err
		}
		if performer == nil {
			return fmt.Errorf("performer %d not found", entityID)
		}
	default:
		return fmt.Errorf("%w: unsupported rating entity type %q", ErrInput, entityType)
	}

	return nil
}

func (r *Resolver) recalculateRatingIfAdvisorScoresExist(ctx context.Context, entityType string, entityID int) error {
	scores, err := r.repository.RatingScore.FindByEntity(ctx, entityType, entityID)
	if err != nil {
		return err
	}
	if !hasEffectiveRatingAdvisorScoresCustom(scores) {
		return nil
	}

	_, err = r.repository.RatingScore.RecalculateRating(ctx, entityType, entityID)
	return err
}

func hasEffectiveRatingAdvisorScoresCustom(scores []*models.RatingScore) bool {
	for _, score := range scores {
		if score == nil {
			continue
		}
		if score.Section == models.RatingScoreSectionCriterion || score.RawValue != 0 || score.WeightedValue != 0 {
			return true
		}
	}
	return false
}

func (r *Resolver) currentRating100Custom(ctx context.Context, entityType string, entityID int) (int, error) {
	switch entityType {
	case models.RatingEntityScene:
		entity, err := r.repository.Scene.Find(ctx, entityID)
		if err != nil {
			return 0, err
		}
		if entity == nil {
			return 0, fmt.Errorf("scene %d not found", entityID)
		}
		if entity.Rating != nil {
			return *entity.Rating, nil
		}
	case models.RatingEntityPerformer:
		entity, err := r.repository.Performer.Find(ctx, entityID)
		if err != nil {
			return 0, err
		}
		if entity == nil {
			return 0, fmt.Errorf("performer %d not found", entityID)
		}
		if entity.Rating != nil {
			return *entity.Rating, nil
		}
	}
	return 0, nil
}

func (r *Resolver) ratingScoreUpdateResultCustom(ctx context.Context, entityType string, entityID int, recalculate bool) (*models.RatingScoreUpdateResult, error) {
	scores, err := r.repository.RatingScore.FindByEntity(ctx, entityType, entityID)
	if err != nil {
		return nil, err
	}

	var rating100 int
	if recalculate && hasEffectiveRatingAdvisorScoresCustom(scores) {
		rating100, err = r.repository.RatingScore.RecalculateRating(ctx, entityType, entityID)
	} else {
		rating100, err = r.currentRating100Custom(ctx, entityType, entityID)
	}
	if err != nil {
		return nil, err
	}

	return &models.RatingScoreUpdateResult{
		EntityType: entityType,
		EntityID:   entityID,
		Rating100:  rating100,
		Scores:     scores,
	}, nil
}

func uniqueRatingEntityIDsCustom(groups ...[]int) []int {
	seen := make(map[int]struct{})
	var ret []int
	for _, ids := range groups {
		for _, id := range ids {
			if id <= 0 {
				continue
			}
			if _, ok := seen[id]; ok {
				continue
			}
			seen[id] = struct{}{}
			ret = append(ret, id)
		}
	}
	return ret
}

func (r *Resolver) recalculatePerformerAdvisorRatingsCustom(ctx context.Context, performerIDs []int) error {
	for _, performerID := range uniqueRatingEntityIDsCustom(performerIDs) {
		if err := r.recalculateRatingIfAdvisorScoresExist(ctx, models.RatingEntityPerformer, performerID); err != nil {
			return fmt.Errorf("recalculating performer %d advisor rating: %w", performerID, err)
		}
	}
	return nil
}

func (r *Resolver) sceneRatingModesCustom(ctx context.Context, sceneIDs []int) (map[int]string, error) {
	ret := make(map[int]string)
	for _, sceneID := range uniqueRatingEntityIDsCustom(sceneIDs) {
		mode, err := r.repository.RatingScore.SceneMode(ctx, sceneID)
		if err != nil {
			return nil, fmt.Errorf("detecting scene %d advisor mode: %w", sceneID, err)
		}
		ret[sceneID] = mode
	}
	return ret, nil
}

func (r *Resolver) resetSceneAdvisorsIfModeChangedCustom(ctx context.Context, previousModes map[int]string) error {
	for sceneID, previousMode := range previousModes {
		updatedMode, err := r.repository.RatingScore.SceneMode(ctx, sceneID)
		if err != nil {
			return fmt.Errorf("detecting updated scene %d advisor mode: %w", sceneID, err)
		}
		if previousMode == updatedMode {
			continue
		}
		if _, err := r.repository.RatingScore.ResetSceneScores(ctx, sceneID); err != nil {
			return fmt.Errorf("resetting scene %d advisor after %s-to-%s mode change: %w", sceneID, previousMode, updatedMode, err)
		}
	}
	return nil
}

func ratingAdvisorRoleTagIDsCustom(uiConfig map[string]interface{}) [3]string {
	var ret [3]string
	roleTagIDs, _ := uiConfig["roleTagIds"].(map[string]interface{})
	if roleTagIDs == nil {
		return ret
	}

	keys := [...]string{"sexTagId", "oralTagId", "soloTagId"}
	for i, key := range keys {
		ret[i], _ = roleTagIDs[key].(string)
	}
	return ret
}

func (r *Resolver) resetSceneAdvisorsAfterRoleTagConfigChangeCustom(ctx context.Context, previous [3]string, updated map[string]interface{}) error {
	if previous == ratingAdvisorRoleTagIDsCustom(updated) {
		return nil
	}

	return r.withTxn(ctx, func(ctx context.Context) error {
		_, err := r.repository.RatingScore.ResetAllSceneScores(ctx)
		return err
	})
}

func (r *Resolver) syncSceneAdvisorAfterCastChangeCustom(ctx context.Context, sceneID int, previousPerformerIDs []int) error {
	updatedPerformerIDs, err := r.repository.Scene.GetPerformerIDs(ctx, sceneID)
	if err != nil {
		return fmt.Errorf("finding updated performers for scene %d rating mode: %w", sceneID, err)
	}

	if castSceneRatingModeCustom(len(previousPerformerIDs)) != castSceneRatingModeCustom(len(updatedPerformerIDs)) {
		if _, err := r.repository.RatingScore.ResetSceneScores(ctx, sceneID); err != nil {
			return err
		}
	}

	return r.recalculatePerformerAdvisorRatingsCustom(
		ctx,
		uniqueRatingEntityIDsCustom(previousPerformerIDs, updatedPerformerIDs),
	)
}

func usesGroupSceneRatingCustom(performerCount int) bool {
	return performerCount >= 4
}

func castSceneRatingModeCustom(performerCount int) string {
	if usesGroupSceneRatingCustom(performerCount) {
		return models.RatingSceneModeGroup
	}
	if performerCount == 1 {
		return models.RatingSceneModeSolo
	}
	return models.RatingSceneModeDefault
}

func (r *mutationResolver) RatingScoreSet(ctx context.Context, input models.RatingScoreInput) (ret *models.RatingScoreUpdateResult, err error) {
	score, err := normalizeRatingScoreInput(input)
	if err != nil {
		return nil, err
	}

	if err := r.withTxn(ctx, func(ctx context.Context) error {
		if err := r.ensureRatingScoreEntityExists(ctx, score.EntityType, score.EntityID); err != nil {
			return err
		}
		if err := r.repository.RatingScore.Upsert(ctx, &score); err != nil {
			return err
		}
		rating100, err := r.repository.RatingScore.RecalculateRating(ctx, score.EntityType, score.EntityID)
		if err != nil {
			return err
		}
		scores, err := r.repository.RatingScore.FindByEntity(ctx, score.EntityType, score.EntityID)
		if err != nil {
			return err
		}

		ret = &models.RatingScoreUpdateResult{
			EntityType: score.EntityType,
			EntityID:   score.EntityID,
			Rating100:  rating100,
			Scores:     scores,
		}
		return nil
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

func (r *mutationResolver) RatingScoreDelete(ctx context.Context, input models.RatingScoreDeleteInput) (ret *models.RatingScoreUpdateResult, err error) {
	input, err = normalizeRatingScoreDeleteInput(input)
	if err != nil {
		return nil, err
	}

	if err := r.withTxn(ctx, func(ctx context.Context) error {
		if err := r.ensureRatingScoreEntityExists(ctx, input.EntityType, input.EntityID); err != nil {
			return err
		}
		if _, err := r.repository.RatingScore.Delete(ctx, input.EntityType, input.EntityID, input.Section, input.Key); err != nil {
			return err
		}
		ret, err = r.ratingScoreUpdateResultCustom(ctx, input.EntityType, input.EntityID, true)
		return err
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

func (r *mutationResolver) RatingScoreReset(ctx context.Context, entityType string, entityID string) (ret *models.RatingScoreUpdateResult, err error) {
	id, err := strconv.Atoi(entityID)
	if err != nil || id <= 0 {
		return nil, fmt.Errorf("%w: invalid entity id %q", ErrInput, entityID)
	}
	entityType = strings.ToLower(strings.TrimSpace(entityType))
	if entityType != models.RatingEntityScene && entityType != models.RatingEntityPerformer {
		return nil, fmt.Errorf("%w: unsupported rating entity type %q", ErrInput, entityType)
	}

	if err := r.withTxn(ctx, func(ctx context.Context) error {
		if err := r.ensureRatingScoreEntityExists(ctx, entityType, id); err != nil {
			return err
		}
		if err := r.repository.RatingScore.DeleteByEntity(ctx, entityType, id); err != nil {
			return err
		}
		if entityType == models.RatingEntityScene {
			updatedScene := models.NewScenePartial()
			updatedScene.Rating = models.NewOptionalIntPtr(nil)
			if _, err := r.repository.Scene.UpdatePartial(ctx, id, updatedScene); err != nil {
				return fmt.Errorf("resetting scene %d advisor rating: %w", id, err)
			}
		}
		ret, err = r.ratingScoreUpdateResultCustom(ctx, entityType, id, false)
		return err
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

func (r *queryResolver) RatingScores(ctx context.Context, entityType string, entityID string) (ret []*models.RatingScore, err error) {
	id, err := strconv.Atoi(entityID)
	if err != nil {
		return nil, fmt.Errorf("converting entity id: %w", err)
	}

	normalizedEntityType := strings.ToLower(strings.TrimSpace(entityType))
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		if err := r.ensureRatingScoreEntityExists(ctx, normalizedEntityType, id); err != nil {
			return err
		}
		ret, err = r.repository.RatingScore.FindByEntity(ctx, normalizedEntityType, id)
		return err
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

func (r *queryResolver) RatingOrgasmCount(ctx context.Context, entityType string, entityID string) (ret int, err error) {
	id, err := strconv.Atoi(entityID)
	if err != nil {
		return 0, fmt.Errorf("converting entity id: %w", err)
	}

	normalizedEntityType := strings.ToLower(strings.TrimSpace(entityType))
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		if err := r.ensureRatingScoreEntityExists(ctx, normalizedEntityType, id); err != nil {
			return err
		}
		switch normalizedEntityType {
		case models.RatingEntityScene:
			ret, err = r.repository.Scene.GetOCount(ctx, id)
		case models.RatingEntityPerformer:
			ret, err = r.repository.Scene.OCountByPerformerID(ctx, id)
		default:
			err = fmt.Errorf("%w: unsupported rating entity type %q", ErrInput, entityType)
		}
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

func (r *sceneResolver) RatingScores(ctx context.Context, obj *models.Scene) (ret []*models.RatingScore, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.RatingScore.FindByEntity(ctx, models.RatingEntityScene, obj.ID)
		return err
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

func (r *performerResolver) RatingScores(ctx context.Context, obj *models.Performer) (ret []*models.RatingScore, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.RatingScore.FindByEntity(ctx, models.RatingEntityPerformer, obj.ID)
		return err
	}); err != nil {
		return nil, err
	}

	return ret, nil
}
