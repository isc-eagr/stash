// CUSTOM
package gallery

import (
	"context"
	"strconv"

	"github.com/stashapp/stash/pkg/models"
)

func CountByStudioIDAndPerformerID(ctx context.Context, r models.GalleryQueryer, studioID int, performerID int, depth *int) (int, error) {
	filter := &models.GalleryFilterType{
		Studios: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(studioID)},
			Modifier: models.CriterionModifierIncludes,
			Depth:    depth,
		},
		Performers: &models.MultiCriterionInput{
			Value:    []string{strconv.Itoa(performerID)},
			Modifier: models.CriterionModifierIncludes,
		},
	}

	return r.QueryCount(ctx, filter, nil)
}
