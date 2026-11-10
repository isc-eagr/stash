package scene

import (
	"context"
	"strconv"

	"github.com/stashapp/stash/pkg/models"
)

// MarkerDurationByTagID returns the summed length of timed markers matching a
// tag. Markers without a valid end time contribute zero seconds. // CUSTOM
func MarkerDurationByTagID(ctx context.Context, r models.SceneMarkerQueryer, id int, depth *int) (float64, error) {
	filter := &models.SceneMarkerFilterType{
		Tags: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(id)},
			Modifier: models.CriterionModifierIncludes,
			Depth:    depth,
		},
	}
	return MarkerDurationByFilterCustom(ctx, r, filter)
}

// MarkerDurationByFilterCustom returns the summed duration across every marker
// matching a scene-marker filter, independently of list pagination. // CUSTOM
func MarkerDurationByFilterCustom(ctx context.Context, r models.SceneMarkerQueryer, filter *models.SceneMarkerFilterType) (float64, error) {
	return MarkerDurationByQueryCustom(ctx, r, filter, nil)
}

// MarkerDurationByQueryCustom includes text search but ignores pagination and
// sorting. SQLite aggregates directly; other stores retain the portable fallback.
func MarkerDurationByQueryCustom(ctx context.Context, r models.SceneMarkerQueryer, filter *models.SceneMarkerFilterType, findFilter *models.FindFilterType) (float64, error) {
	if aggregate, ok := r.(interface {
		QueryDurationCustom(context.Context, *models.SceneMarkerFilterType, *models.FindFilterType) (float64, error)
	}); ok {
		return aggregate.QueryDurationCustom(ctx, filter, findFilter)
	}
	allResults := -1
	allFilter := &models.FindFilterType{PerPage: &allResults}
	if findFilter != nil {
		allFilter.Q = findFilter.Q
	}
	markers, _, err := r.Query(ctx, filter, allFilter)
	if err != nil {
		return 0, err
	}

	return SumMarkerDurationsCustom(markers), nil
}

// SumMarkerDurationsCustom sums marker lengths without allowing malformed
// backwards ranges to reduce the total. // CUSTOM
func SumMarkerDurationsCustom(markers []*models.SceneMarker) float64 {
	var total float64
	for _, marker := range markers {
		if marker == nil || marker.EndSeconds == nil || *marker.EndSeconds <= marker.Seconds {
			continue
		}
		total += *marker.EndSeconds - marker.Seconds
	}
	return total
}
