package sqlite

// CUSTOM: Custom criterion handlers for gallery filters.

import (
	"context"
	"fmt"
	"strings"

	"github.com/stashapp/stash/pkg/models"
)

func (qb *galleryFilterHandler) performerEthnicityCriterionHandler(pe *models.StringCriterionInput) criterionHandlerFunc {
	return criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
		if pe != nil {
			if !pe.Modifier.IsValid() {
				return
			}

			selected := []string{}
			for _, e := range strings.Split(pe.Value, ",") {
				e = strings.TrimSpace(e)
				if e != "" {
					selected = append(selected, e)
				}
			}
			if len(selected) == 0 {
				return
			}

			expandForFilter := func(s string) []string {
				out := []string{s}
				if strings.EqualFold(s, "Black") {
					out = append(out, "Mixed", "Afrolatino")
				}
				if strings.EqualFold(s, "White") {
					out = append(out, "Mixed")
				}
				if strings.EqualFold(s, "Latino") {
					out = append(out, "Afrolatino")
				}
				return out
			}

			allowedSet := map[string]struct{}{}
			for _, s := range selected {
				for _, v := range expandForFilter(s) {
					allowedSet[v] = struct{}{}
				}
			}
			allowed := make([]string, 0, len(allowedSet))
			for v := range allowedSet {
				allowed = append(allowed, v)
			}

			placeholders := strings.Repeat("?,", len(allowed))
			placeholders = placeholders[:len(placeholders)-1]
			args := make([]interface{}, len(allowed))
			for i, v := range allowed {
				args[i] = v
			}

			existsPerformer := "EXISTS (SELECT 1 FROM performers_galleries pg WHERE pg.gallery_id = galleries.id)"

			switch pe.Modifier {
			case models.CriterionModifierIncludes:
				clause := fmt.Sprintf("EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND p.ethnicity IN (%s))", placeholders)
				f.addWhere(clause, args...)
				f.addWhere(existsPerformer)
			case models.CriterionModifierIncludesAll:
				for _, s := range selected {
					group := expandForFilter(s)
					ph := strings.Repeat("?,", len(group))
					ph = ph[:len(ph)-1]
					gargs := make([]interface{}, len(group))
					for i, v := range group {
						gargs[i] = v
					}
					f.addWhere(fmt.Sprintf("EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND p.ethnicity IN (%s))", ph), gargs...)
				}
			case models.CriterionModifierEquals:
				clause := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND (p.ethnicity IS NULL OR TRIM(p.ethnicity) = '' OR p.ethnicity NOT IN (%s)))", placeholders)
				f.addWhere(clause, args...)
				f.addWhere(existsPerformer)
				for _, s := range selected {
					group := expandForFilter(s)
					ph := strings.Repeat("?,", len(group))
					ph = ph[:len(ph)-1]
					gargs := make([]interface{}, len(group))
					for i, v := range group {
						gargs[i] = v
					}
					f.addWhere(fmt.Sprintf("EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND p.ethnicity IN (%s))", ph), gargs...)
				}
			case models.CriterionModifierNotEquals:
				clause := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND p.ethnicity IN (%s))", placeholders)
				f.addWhere(clause, args...)
				f.addWhere(existsPerformer)
			default:
				clause := fmt.Sprintf("EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND p.ethnicity IN (%s))", placeholders)
				f.addWhere(clause, args...)
				f.addWhere(existsPerformer)
			}
		}
	})
}

func (qb *galleryFilterHandler) performerCountryCriterionHandler(pc *models.StringCriterionInput) criterionHandlerFunc {
	return criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
		if pc != nil {
			if !pc.Modifier.IsValid() {
				return
			}

			countries := []string{}
			for _, c := range strings.Split(pc.Value, ",") {
				c = strings.TrimSpace(c)
				if c != "" {
					countries = append(countries, c)
				}
			}
			if len(countries) == 0 {
				return
			}

			placeholders := strings.Repeat("?,", len(countries))
			placeholders = placeholders[:len(placeholders)-1]
			args := make([]interface{}, len(countries))
			for i, v := range countries {
				args[i] = v
			}

			existsPerformer := "EXISTS (SELECT 1 FROM performers_galleries pg WHERE pg.gallery_id = galleries.id)"

			switch pc.Modifier {
			case models.CriterionModifierIncludes:
				clause := fmt.Sprintf("EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND p.country IN (%s))", placeholders)
				f.addWhere(clause, args...)
				f.addWhere(existsPerformer)
			case models.CriterionModifierIncludesAll:
				for _, c := range countries {
					f.addWhere("EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND p.country = ?)", c)
				}
			case models.CriterionModifierEquals:
				clause := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND (p.country IS NULL OR TRIM(p.country) = '' OR p.country NOT IN (%s)))", placeholders)
				f.addWhere(clause, args...)
				f.addWhere(existsPerformer)
				for _, c := range countries {
					f.addWhere("EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND p.country = ?)", c)
				}
			case models.CriterionModifierNotEquals:
				clause := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND p.country IN (%s))", placeholders)
				f.addWhere(clause, args...)
				f.addWhere(existsPerformer)
			default:
				clause := fmt.Sprintf("EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND p.country IN (%s))", placeholders)
				f.addWhere(clause, args...)
				f.addWhere(existsPerformer)
			}
		}
	})
}

func (qb *galleryFilterHandler) performerRatingCriterionHandler(pr *models.IntCriterionInput, ratingAll *bool) criterionHandlerFunc {
	return criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
		if pr != nil {
			modeAll := true
			if ratingAll != nil {
				modeAll = *ratingAll
			}

			if !modeAll {
				f.addInnerJoin("performers_galleries", "", "galleries.id = performers_galleries.gallery_id")
				f.addInnerJoin("performers", "", "performers_galleries.performer_id = performers.id")
				intCriterionHandler(pr, "performers.rating", nil)(ctx, f)
				return
			}

			existsPerformer := "EXISTS (SELECT 1 FROM performers_galleries pg WHERE pg.gallery_id = galleries.id)"
			switch pr.Modifier {
			case models.CriterionModifierEquals:
				f.addWhere("NOT EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND (p.rating IS NULL OR p.rating != ?))", pr.Value)
				f.addWhere(existsPerformer)
			case models.CriterionModifierNotEquals:
				f.addWhere("NOT EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND p.rating = ?)", pr.Value)
				f.addWhere(existsPerformer)
			case models.CriterionModifierGreaterThan:
				f.addWhere("NOT EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND (p.rating IS NULL OR p.rating <= ?))", pr.Value)
				f.addWhere(existsPerformer)
			case models.CriterionModifierLessThan:
				f.addWhere("NOT EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND (p.rating IS NULL OR p.rating >= ?))", pr.Value)
				f.addWhere(existsPerformer)
			case models.CriterionModifierBetween:
				f.addWhere("NOT EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND (p.rating IS NULL OR p.rating < ? OR p.rating > ?))", pr.Value, pr.Value2)
				f.addWhere(existsPerformer)
			case models.CriterionModifierNotBetween:
				f.addWhere("NOT EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND (p.rating IS NULL OR (p.rating >= ? AND p.rating <= ?)))", pr.Value, pr.Value2)
				f.addWhere(existsPerformer)
			case models.CriterionModifierNotNull:
				f.addWhere("NOT EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND p.rating IS NULL)")
				f.addWhere(existsPerformer)
			case models.CriterionModifierIsNull:
				f.addWhere("NOT EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND p.rating IS NOT NULL)")
				f.addWhere(existsPerformer)
			default:
				f.addInnerJoin("performers_galleries", "", "galleries.id = performers_galleries.gallery_id")
				f.addInnerJoin("performers", "", "performers_galleries.performer_id = performers.id")
				intCriterionHandler(pr, "performers.rating", nil)(ctx, f)
			}
		}
	})
}
