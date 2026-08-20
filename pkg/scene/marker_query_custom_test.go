package scene

import (
	"context"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	modelmocks "github.com/stashapp/stash/pkg/models/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestSumMarkerDurationsCustom(t *testing.T) {
	end := 25.5
	backwardsEnd := 4.0
	markers := []*models.SceneMarker{
		{Seconds: 10, EndSeconds: &end},
		{Seconds: 5},
		{Seconds: 8, EndSeconds: &backwardsEnd},
		nil,
	}

	assert.InDelta(t, 15.5, SumMarkerDurationsCustom(markers), 0.0001)
}

func TestMarkerDurationByTagIDQueriesAllMatchingMarkers(t *testing.T) {
	reader := &modelmocks.SceneMarkerReaderWriter{}
	end := 18.0
	depth := 2
	reader.On(
		"Query",
		mock.Anything,
		mock.MatchedBy(func(filter *models.SceneMarkerFilterType) bool {
			return filter != nil &&
				filter.Tags != nil &&
				filter.Tags.Modifier == models.CriterionModifierIncludes &&
				len(filter.Tags.Value) == 1 &&
				filter.Tags.Value[0] == "42" &&
				filter.Tags.Depth == &depth
		}),
		mock.MatchedBy(func(filter *models.FindFilterType) bool {
			return filter != nil && filter.PerPage != nil && *filter.PerPage == -1
		}),
	).Return([]*models.SceneMarker{{Seconds: 3, EndSeconds: &end}}, 1, nil).Once()

	duration, err := MarkerDurationByTagID(context.Background(), reader, 42, &depth)

	assert.NoError(t, err)
	assert.Equal(t, 15.0, duration)
	reader.AssertExpectations(t)
}

func TestMarkerDurationByFilterCustomIgnoresPagination(t *testing.T) {
	reader := &modelmocks.SceneMarkerReaderWriter{}
	end := 14.0
	hasEndTime := true
	filter := &models.SceneMarkerFilterType{HasEndTime: &hasEndTime}
	reader.On(
		"Query",
		mock.Anything,
		filter,
		mock.MatchedBy(func(findFilter *models.FindFilterType) bool {
			return findFilter != nil && findFilter.PerPage != nil && *findFilter.PerPage == -1
		}),
	).Return([]*models.SceneMarker{{Seconds: 4, EndSeconds: &end}}, 1, nil).Once()

	duration, err := MarkerDurationByFilterCustom(context.Background(), reader, filter)

	assert.NoError(t, err)
	assert.Equal(t, 10.0, duration)
	reader.AssertExpectations(t)
}
