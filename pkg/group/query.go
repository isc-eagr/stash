package group

import (
	"context"
	"strconv"

	"github.com/stashapp/stash/pkg/models"
)

func CountByStudioID(ctx context.Context, r models.GroupQueryer, id int, depth *int, performerID *string) (int, error) {
	filter := &models.GroupFilterType{
		Studios: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(id)},
			Modifier: models.CriterionModifierIncludes,
			Depth:    depth,
		},
	}

	// If performerID is provided, filter groups that have scenes with this performer
	if performerID != nil && *performerID != "" {
		filter.ScenesFilter = &models.SceneFilterType{
			Performers: &models.MultiCriterionInput{
				Value:    []string{*performerID},
				Modifier: models.CriterionModifierIncludes,
			},
		}
	}

	return r.QueryCount(ctx, filter, nil)
}

func CountByTagID(ctx context.Context, r models.GroupQueryer, id int, depth *int) (int, error) {
	filter := &models.GroupFilterType{
		Tags: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(id)},
			Modifier: models.CriterionModifierIncludes,
			Depth:    depth,
		},
	}

	return r.QueryCount(ctx, filter, nil)
}

func CountByContainingGroupID(ctx context.Context, r models.GroupQueryer, id int, depth *int) (int, error) {
	filter := &models.GroupFilterType{
		ContainingGroups: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(id)},
			Modifier: models.CriterionModifierIncludes,
			Depth:    depth,
		},
	}

	return r.QueryCount(ctx, filter, nil)
}
