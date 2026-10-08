package api

import (
	"context"
	"errors"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/models/mocks"
	"github.com/stretchr/testify/require"
)

func TestSetUpdatedSceneStashDBMatchesCustom(t *testing.T) {
	seven, zero := 7, 0
	for _, tt := range []struct {
		name    string
		updated bool
		ids     []models.StashID
		matches *int
		want    *int
	}{
		{name: "stale count after clearing IDs", updated: true, matches: &seven, want: &zero},
		{name: "null count after clearing IDs", updated: true, want: &zero},
		{name: "only other box remains", updated: true, ids: []models.StashID{{Endpoint: "https://fansdb.cc/graphql"}}, matches: &seven, want: &zero},
		{name: "fresh StashDB scrape", updated: true, ids: []models.StashID{{Endpoint: "https://stashdb.org/graphql", StashID: "new"}}, matches: &seven, want: &seven},
		{name: "count only", matches: &seven, want: &seven},
		{name: "explicit count clear", want: nil},
	} {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			qb := &mocks.SceneReaderWriter{}
			if tt.updated {
				qb.On("GetStashIDs", ctx, 1).Return(tt.ids, nil).Once()
			}
			qb.On("SetStashDBMatchesCustom", ctx, 1, tt.want).Return(nil).Once()
			require.NoError(t, setUpdatedSceneStashDBMatchesCustom(ctx, qb, 1, tt.matches, tt.updated))
			qb.AssertExpectations(t)
		})
	}

	t.Run("read error", func(t *testing.T) {
		ctx := context.Background()
		qb := &mocks.SceneReaderWriter{}
		readErr := errors.New("reading stash IDs")
		qb.On("GetStashIDs", ctx, 1).Return(nil, readErr).Once()
		require.ErrorIs(t, setUpdatedSceneStashDBMatchesCustom(ctx, qb, 1, &seven, true), readErr)
		qb.AssertExpectations(t)
	})
}
