package manager

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/models/mocks"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

type fakeStashDBMatchesFetcherCustom struct {
	calls [][]string
}

// The first batch answers; later batches fail.
func (f *fakeStashDBMatchesFetcherCustom) FindStashDBMatchesCustom(ctx context.Context, stashIDs []string) (map[string]int, error) {
	f.calls = append(f.calls, stashIDs)
	if len(f.calls) > 1 {
		return nil, errors.New("stash-box unavailable")
	}
	ret := map[string]int{}
	for _, id := range stashIDs {
		if id != "id4" {
			ret[id] = 1
		}
	}
	ret["id1"] = 5
	ret["id2"] = 3
	ret["id3"] = 9
	return ret, nil
}

type fakeStashDBMatchesProgressCustom struct {
	total, processed int
}

func (p *fakeStashDBMatchesProgressCustom) SetTotal(total int) { p.total = total }
func (p *fakeStashDBMatchesProgressCustom) AddProcessed(v int) { p.processed += v }

func TestRefreshStashDBMatchesCustom(t *testing.T) {
	const endpoint = "https://stashdb.org/graphql"
	five, seven, one := 5, 7, 1
	targets := make([]models.StashDBMatchTargetCustom, 27)
	for i := range targets {
		targets[i] = models.StashDBMatchTargetCustom{SceneID: i + 1, StashID: fmt.Sprintf("id%d", i+1)}
	}
	targets[0].Matches = &five  // unchanged
	targets[2].Matches = &seven // changed to 9
	targets[4].Matches = &one   // unchanged

	db := mocks.NewDatabase()
	db.Scene.On("FindStashDBMatchTargetsCustom", mock.Anything, endpoint).Return(targets, nil).Once()
	written := map[int]int{}
	db.Scene.On("SetStashDBMatchesCustom", mock.Anything, mock.Anything, mock.Anything).
		Run(func(args mock.Arguments) { written[args.Int(1)] = *args.Get(2).(*int) }).
		Return(nil)

	var saved models.StashDBMatchesReportCustom
	db.Scene.On("SaveStashDBMatchesReportCustom", mock.Anything, mock.Anything).
		Run(func(args mock.Arguments) { saved = args.Get(1).(models.StashDBMatchesReportCustom) }).
		Return(nil).Once()

	fetcher := &fakeStashDBMatchesFetcherCustom{}
	progress := &fakeStashDBMatchesProgressCustom{}
	clock := time.Date(2026, 10, 5, 14, 0, 0, 0, time.UTC)
	now := func() time.Time { clock = clock.Add(time.Minute); return clock }
	report, err := refreshStashDBMatchesCustom(context.Background(), db.Repository(), fetcher, endpoint, progress, now)
	require.NoError(t, err)

	require.Len(t, fetcher.calls, 2)
	require.Len(t, fetcher.calls[0], stashDBMatchesBatchSizeCustom)
	require.Equal(t, []string{"id26", "id27"}, fetcher.calls[1])

	want := map[int]int{2: 3, 3: 9}
	for scene := 6; scene <= 25; scene++ {
		want[scene] = 1 // first-time counts
	}
	require.Equal(t, want, written, "only new or changed counts are written")
	require.Equal(t, report, saved, "the returned report is the one saved")
	require.Equal(t, time.Date(2026, 10, 5, 14, 1, 0, 0, time.UTC), saved.StartedAt)
	require.Equal(t, time.Date(2026, 10, 5, 14, 2, 0, 0, time.UTC), saved.FinishedAt)
	require.Equal(t, []int{27, 22, 2, 1, 2}, []int{saved.Checked, saved.Changed, saved.Unchanged, saved.NotFound, saved.Failed})
	require.False(t, saved.Cancelled)
	require.Len(t, saved.Changes, 22)
	require.Equal(t, models.StashDBMatchesChangeCustom{SceneID: 3, Previous: &seven, Current: 9}, saved.Changes[1])
	require.Nil(t, saved.Changes[0].Previous, "scene 2 was never fetched before")
	require.Equal(t, 27, progress.total)
	require.Equal(t, 27, progress.processed)
	db.AssertExpectations(t)
}
