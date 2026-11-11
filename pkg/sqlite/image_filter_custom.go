package sqlite

// CUSTOM: Custom criterion handlers for image filters.

import (
	"context"

	"github.com/stashapp/stash/pkg/models"
)

func (qb *imageFilterHandler) performerEthnicityCriterionHandler(pe *models.StringCriterionInput) criterionHandlerFunc {
	return imagePerformersCustom.ethnicityCriterionHandler(pe)
}

func (qb *imageFilterHandler) performerCountryCriterionHandler(pc *models.StringCriterionInput) criterionHandlerFunc {
	return imagePerformersCustom.countryCriterionHandler(pc)
}

func (qb *imageFilterHandler) performerRatingCriterionHandler(pr *models.IntCriterionInput, ratingAll *bool) criterionHandlerFunc {
	return criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
		if pr != nil {
			modeAll := true
			if ratingAll != nil {
				modeAll = *ratingAll
			}

			if !modeAll {
				f.addInnerJoin("performers_images", "", "images.id = performers_images.image_id")
				f.addInnerJoin("performers", "", "performers_images.performer_id = performers.id")
				intCriterionHandler(pr, "performers.rating", nil)(ctx, f)
				return
			}

			existsPerformer := "EXISTS (SELECT 1 FROM performers_images pi WHERE pi.image_id = images.id)"
			switch pr.Modifier {
			case models.CriterionModifierEquals:
				f.addWhere("NOT EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND (p.rating IS NULL OR p.rating != ?))", pr.Value)
				f.addWhere(existsPerformer)
			case models.CriterionModifierNotEquals:
				f.addWhere("NOT EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND p.rating = ?)", pr.Value)
				f.addWhere(existsPerformer)
			case models.CriterionModifierGreaterThan:
				f.addWhere("NOT EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND (p.rating IS NULL OR p.rating <= ?))", pr.Value)
				f.addWhere(existsPerformer)
			case models.CriterionModifierLessThan:
				f.addWhere("NOT EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND (p.rating IS NULL OR p.rating >= ?))", pr.Value)
				f.addWhere(existsPerformer)
			case models.CriterionModifierBetween:
				f.addWhere("NOT EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND (p.rating IS NULL OR p.rating < ? OR p.rating > ?))", pr.Value, pr.Value2)
				f.addWhere(existsPerformer)
			case models.CriterionModifierNotBetween:
				f.addWhere("NOT EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND (p.rating IS NULL OR (p.rating >= ? AND p.rating <= ?)))", pr.Value, pr.Value2)
				f.addWhere(existsPerformer)
			case models.CriterionModifierNotNull:
				f.addWhere("NOT EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND p.rating IS NULL)")
				f.addWhere(existsPerformer)
			case models.CriterionModifierIsNull:
				f.addWhere("NOT EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND p.rating IS NOT NULL)")
				f.addWhere(existsPerformer)
			default:
				f.addInnerJoin("performers_images", "", "images.id = performers_images.image_id")
				f.addInnerJoin("performers", "", "performers_images.performer_id = performers.id")
				intCriterionHandler(pr, "performers.rating", nil)(ctx, f)
			}
		}
	})
}
