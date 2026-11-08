package scene

import (
	"context"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	modelmocks "github.com/stashapp/stash/pkg/models/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// GOAT beats Really Hot, which beats plain; a Facial tag files it as a facial.
func TestNutTypeCountsCustom(t *testing.T) {
	goat := map[int]bool{50: true, 51: true}
	hot := map[int]bool{60: true}
	var counts NutTypeCountsCustom
	counts.add(false, nutQualityCustom([]int{1}, goat, hot))
	counts.add(false, nutQualityCustom([]int{1, 60}, goat, hot))
	counts.add(false, nutQualityCustom([]int{1, 60, 51}, goat, hot))
	counts.add(true, nutQualityCustom([]int{2, 60}, goat, hot))
	counts.add(true, nutQualityCustom([]int{2}, nil, nil))
	assert.Equal(t, NutTypeCountsCustom{
		Nut:    NutQualityCountsCustom{1, 1, 1},
		Facial: NutQualityCountsCustom{1, 1, 0},
	}, counts)
}

// Studio counts: one event per top (one with no top); 2nd camera and release
// markers are left out.
func TestStudioNutTypeCountsCustom(t *testing.T) {
	const facial, orgasm, secondCamera, goat, hot = 2, 1, 3, 50, 60
	ctx := context.Background()
	sceneQB := &modelmocks.SceneReaderWriter{}
	sceneQB.On("Query", mock.Anything, mock.Anything).
		Return(&models.SceneQueryResult{QueryResult: models.QueryResult[int]{IDs: []int{42}}}, nil).Once()
	tagQB := &modelmocks.TagReaderWriter{}
	tagQB.On("FindAllDescendants", mock.Anything, mock.Anything, mock.Anything).Return([]*models.TagPath{}, nil)
	release := 9
	markerQB := &modelmocks.SceneMarkerReaderWriter{}
	markerQB.On("Query", mock.Anything, mock.MatchedBy(func(f *models.SceneMarkerFilterType) bool {
		return f.Scenes.Value[0] == "42" && len(f.Tags.Value) == 2 && *f.Tags.Depth == -1
	}), mock.Anything).Return([]*models.SceneMarker{
		{ID: 1, SceneID: 42, PrimaryTagID: orgasm},                      // two tops
		{ID: 2, SceneID: 42, PrimaryTagID: orgasm},                      // no top, GOAT
		{ID: 3, SceneID: 42, PrimaryTagID: facial},                      // Really Hot facial
		{ID: 4, SceneID: 42, PrimaryTagID: orgasm},                      // 2nd camera
		{ID: 5, SceneID: 42, PrimaryTagID: orgasm, ReleaseID: &release}, // release-owned
	}, 5, nil).Once()
	markerQB.On("GetTagIDsForMarkers", mock.Anything, mock.Anything).Return(map[int][]int{
		2: {goat}, 3: {hot}, 4: {secondCamera},
	}, nil).Once()
	markerQB.On("GetPerformersForMarkers", mock.Anything, mock.Anything).Return(map[int][]*models.MarkerPerformer{
		1: {{PerformerID: 7, Role: "top"}, {PerformerID: 8, Role: "top"}, {PerformerID: 9, Role: "bottom"}},
		3: {{PerformerID: 7, Role: "top"}},
	}, nil).Once()

	got, err := StudioNutTypeCountsCustom(ctx, markerQB, sceneQB, tagQB, 10, nil, facial, orgasm, secondCamera, goat, hot)
	require.NoError(t, err)
	assert.Equal(t, NutTypeCountsCustom{
		Nut:    NutQualityCountsCustom{2, 0, 1},
		Facial: NutQualityCountsCustom{0, 1, 0},
	}, got)
	markerQB.AssertExpectations(t)
}
