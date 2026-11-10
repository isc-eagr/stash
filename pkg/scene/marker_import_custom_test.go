package scene

import (
	"context"
	"testing"
	"time"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/models/mocks"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestMarkerImportUpdatesTagMembershipAtomicallyCustom(t *testing.T) {
	store := &mocks.SceneMarkerReaderWriter{}
	now := time.Now()
	importer := &MarkerImporter{ReaderWriter: store, marker: models.SceneMarker{PrimaryTagID: 20, Title: "Swap", CreatedAt: now, UpdatedAt: now}, tags: []*models.Tag{{ID: 10}}}
	store.On("UpdatePartial", mock.Anything, 1, mock.MatchedBy(func(partial models.SceneMarkerPartial) bool {
		return partial.PrimaryTagID.Value == 20 && partial.TagIDs != nil && len(partial.TagIDs.IDs) == 1 && partial.TagIDs.IDs[0] == 10 && partial.EndSeconds.Null && partial.CreatedAt.Value.Equal(now)
	})).Return(&models.SceneMarker{ID: 1}, nil).Once()
	require.NoError(t, importer.Update(context.Background(), 1))
	store.AssertExpectations(t)
}
