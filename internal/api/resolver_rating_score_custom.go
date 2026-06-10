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

func (r *queryResolver) RatingScores(ctx context.Context, entityType string, entityID string) (ret []*models.RatingScore, err error) {
	id, err := strconv.Atoi(entityID)
	if err != nil {
		return nil, fmt.Errorf("converting entity id: %w", err)
	}

	normalizedEntityType := strings.ToLower(strings.TrimSpace(entityType))
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.RatingScore.FindByEntity(ctx, normalizedEntityType, id)
		return err
	}); err != nil {
		return nil, err
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
