package manager

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/models/mocks"
	"github.com/stashapp/stash/pkg/stashbox"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

const stashDBChangesEndpointCustom = "https://stashdb.org/graphql"

type fakeStashDBChangesStoreCustom struct {
	t       *testing.T
	targets map[models.StashDBChangesKindCustom][]models.StashDBChangesTargetCustom
	saved   []models.StashDBChangesRunCustom
}

func (f *fakeStashDBChangesStoreCustom) Targets(_ context.Context, kind models.StashDBChangesKindCustom, endpoint string) ([]models.StashDBChangesTargetCustom, error) {
	require.Equal(f.t, stashDBChangesEndpointCustom, endpoint)
	return f.targets[kind], nil
}

func (f *fakeStashDBChangesStoreCustom) SaveRun(ctx context.Context, run models.StashDBChangesRunCustom) error {
	require.NoError(f.t, ctx.Err(), "reports save with an uncancelled context")
	f.saved = append(f.saved, run)
	return nil
}

// Scene requests after the first fail.
type fakeStashDBChangesFetcherCustom struct {
	scenes         map[string]*stashbox.StashDBSceneCustom
	performers     map[string]*models.ScrapedPerformer
	sceneCalls     [][]string
	performerCalls [][]string
}

func (f *fakeStashDBChangesFetcherCustom) FindStashDBScenesCustom(_ context.Context, ids []string) (map[string]*stashbox.StashDBSceneCustom, error) {
	f.sceneCalls = append(f.sceneCalls, ids)
	if len(f.sceneCalls) > 1 {
		return nil, errors.New("stash-box unavailable")
	}
	ret := map[string]*stashbox.StashDBSceneCustom{}
	for _, id := range ids {
		if s := f.scenes[id]; s != nil {
			ret[id] = s
		}
	}
	return ret, nil
}

func (f *fakeStashDBChangesFetcherCustom) FindStashDBPerformersCustom(_ context.Context, ids []string) (map[string]*models.ScrapedPerformer, error) {
	f.performerCalls = append(f.performerCalls, ids)
	ret := map[string]*models.ScrapedPerformer{}
	for _, id := range ids {
		if p := f.performers[id]; p != nil {
			ret[id] = p
		}
	}
	return ret, nil
}

func stashDBChangesSceneCustom(id int, studioID *int, performerIDs, tagIDs []int) *models.Scene {
	return &models.Scene{
		ID:           id,
		Title:        fmt.Sprintf("Scene %d", id),
		StudioID:     studioID,
		URLs:         models.NewRelatedStrings([]string{}),
		PerformerIDs: models.NewRelatedIDs(append([]int{}, performerIDs...)),
		TagIDs:       models.NewRelatedIDs(append([]int{}, tagIDs...)),
	}
}

func stashDBChangesPerformerCustom(id int, name string, stashIDs ...string) *models.Performer {
	var ids []models.StashID
	for _, s := range stashIDs {
		ids = append(ids, models.StashID{Endpoint: stashDBChangesEndpointCustom, StashID: s})
	}
	return &models.Performer{
		ID:       id,
		Name:     name,
		Aliases:  models.NewRelatedStrings([]string{}),
		URLs:     models.NewRelatedStrings([]string{}),
		StashIDs: models.NewRelatedStashIDs(ids),
	}
}

func newStashDBChangesFixtureCustom(t *testing.T) (*mocks.Database, *fakeStashDBChangesStoreCustom, *fakeStashDBChangesFetcherCustom) {
	studioID := 10
	store := &fakeStashDBChangesStoreCustom{t: t, targets: map[models.StashDBChangesKindCustom][]models.StashDBChangesTargetCustom{}}
	fetcher := &fakeStashDBChangesFetcherCustom{scenes: map[string]*stashbox.StashDBSceneCustom{}, performers: map[string]*models.ScrapedPerformer{}}
	db := mocks.NewDatabase()

	var scenes []*models.Scene
	for id := 1; id <= 27; id++ {
		stashID := fmt.Sprintf("s%d", id)
		store.targets[models.StashDBChangesKindSceneCustom] = append(store.targets[models.StashDBChangesKindSceneCustom],
			models.StashDBChangesTargetCustom{ID: id, StashID: stashID})
		title := fmt.Sprintf("Scene %d", id)
		fetcher.scenes[stashID] = &stashbox.StashDBSceneCustom{ID: stashID, Title: &title}
		if id != 6 { // deleted locally after the targets were listed
			scene := stashDBChangesSceneCustom(id, nil, nil, nil)
			if id <= 2 {
				scene = stashDBChangesSceneCustom(id, &studioID, []int{20}, []int{30})
			}
			scenes = append(scenes, scene)
		}
	}
	newTitle := "New title"
	fetcher.scenes["s1"].Title = &newTitle
	delete(fetcher.scenes, "s3")
	fetcher.scenes["s4"].Deleted = true
	fetcher.scenes["s5"].ID = "s5-merged"
	for _, id := range []string{"s1", "s2"} {
		fetcher.scenes[id].Studio = &stashbox.StashDBEntityCustom{ID: "studio", Name: "Studio"}
		fetcher.scenes[id].Performers = []stashbox.StashDBEntityCustom{{ID: "p20", Name: "Papi"}}
		fetcher.scenes[id].Tags = []stashbox.StashDBEntityCustom{{ID: "t30", Name: "Kissing"}}
	}

	db.Scene.On("FindByIDs", mock.Anything, mock.Anything).Return(scenes, nil).Once()
	// Studio, performer, and tag of both scenes load once.
	db.Studio.On("Find", mock.Anything, studioID).Return(&models.Studio{
		Name:     "Studio",
		Aliases:  models.NewRelatedStrings([]string{}),
		StashIDs: models.NewRelatedStashIDs([]models.StashID{{Endpoint: stashDBChangesEndpointCustom, StashID: "studio"}}),
	}, nil).Once()
	db.Performer.On("Find", mock.Anything, 20).Return(stashDBChangesPerformerCustom(20, "Papi", "p20"), nil).Once()
	db.Tag.On("Find", mock.Anything, 30).Return(&models.Tag{
		Name:     "Kissing",
		Aliases:  models.NewRelatedStrings([]string{}),
		StashIDs: models.NewRelatedStashIDs([]models.StashID{{Endpoint: stashDBChangesEndpointCustom, StashID: "t30"}}),
	}, nil).Once()

	merged := "p-new"
	for id, p := range map[string]*models.ScrapedPerformer{
		"p101": {Name: stashDBStrCustom("Renamed"), RemoteSiteID: stashDBStrCustom("p101")},
		"p102": {Name: stashDBStrCustom("Gone"), RemoteSiteID: stashDBStrCustom("p102"), RemoteDeleted: true, RemoteMergedIntoId: &merged},
		"p103": {Name: stashDBStrCustom("Gone"), RemoteSiteID: stashDBStrCustom("p103"), RemoteDeleted: true},
		"p105": {Name: stashDBStrCustom("Same"), RemoteSiteID: stashDBStrCustom("p105")},
	} {
		fetcher.performers[id] = p
	}
	for id := 101; id <= 105; id++ {
		stashID := fmt.Sprintf("p%d", id)
		store.targets[models.StashDBChangesKindPerformerCustom] = append(store.targets[models.StashDBChangesKindPerformerCustom],
			models.StashDBChangesTargetCustom{ID: id, StashID: stashID})
		name := "Same"
		if id == 101 {
			name = "Original"
		}
		db.Performer.On("Find", mock.Anything, id).Return(stashDBChangesPerformerCustom(id, name, stashID), nil).Maybe()
	}
	return db, store, fetcher
}

func TestCheckStashDBChangesCustom(t *testing.T) {
	db, store, fetcher := newStashDBChangesFixtureCustom(t)
	progress := &fakeStashDBMatchesProgressCustom{}
	clock := time.Date(2026, 10, 16, 14, 0, 0, 0, time.UTC)
	now := func() time.Time { clock = clock.Add(time.Minute); return clock }

	check := newStashDBChangesCheckCustom(db.Repository(), store, fetcher, stashDBChangesEndpointCustom, progress, now)
	runs, err := check.run(context.Background(), []models.StashDBChangesKindCustom{
		models.StashDBChangesKindSceneCustom, models.StashDBChangesKindPerformerCustom,
	})
	require.NoError(t, err)
	require.Equal(t, store.saved, runs, "each kind's run is saved")
	require.Len(t, runs, 2)

	require.Len(t, fetcher.sceneCalls, 2)
	require.Len(t, fetcher.sceneCalls[0], stashDBChangesBatchSizeCustom)
	require.Equal(t, []string{"s26", "s27"}, fetcher.sceneCalls[1])

	scenes := runs[0]
	require.Equal(t, models.StashDBChangesKindSceneCustom, scenes.Kind)
	require.Equal(t, stashDBChangesEndpointCustom, scenes.Endpoint)
	require.Equal(t, []int{27, 2}, []int{scenes.Checked, scenes.Failed})
	require.False(t, scenes.Cancelled)
	require.Equal(t, time.Date(2026, 10, 16, 14, 1, 0, 0, time.UTC), scenes.StartedAt)
	require.Equal(t, time.Date(2026, 10, 16, 14, 2, 0, 0, time.UTC), scenes.FinishedAt)
	mergedScene := "s5-merged"
	require.Equal(t, []models.StashDBChangeCustom{
		{ID: 1, StashID: "s1", Status: models.StashDBChangeStatusChangedCustom, Fields: []models.StashDBFieldChangeCustom{
			{Field: "title", Local: stashDBStrCustom("Scene 1"), Remote: stashDBStrCustom("New title")},
		}},
		{ID: 3, StashID: "s3", Status: models.StashDBChangeStatusNotFoundCustom},
		{ID: 4, StashID: "s4", Status: models.StashDBChangeStatusDeletedCustom},
		{ID: 5, StashID: "s5", Status: models.StashDBChangeStatusMergedCustom, MergedIntoID: &mergedScene},
	}, scenes.Changes, "unchanged scenes, locally deleted scenes, and failed batches are not listed")

	performers := runs[1]
	require.Equal(t, []int{5, 0}, []int{performers.Checked, performers.Failed})
	mergedInto := "p-new"
	require.Equal(t, []models.StashDBChangeCustom{
		{ID: 101, StashID: "p101", Status: models.StashDBChangeStatusChangedCustom, Fields: []models.StashDBFieldChangeCustom{
			{Field: "name", Local: stashDBStrCustom("Original"), Remote: stashDBStrCustom("Renamed")},
		}},
		{ID: 102, StashID: "p102", Status: models.StashDBChangeStatusMergedCustom, MergedIntoID: &mergedInto},
		{ID: 103, StashID: "p103", Status: models.StashDBChangeStatusDeletedCustom},
		{ID: 104, StashID: "p104", Status: models.StashDBChangeStatusNotFoundCustom},
	}, performers.Changes)

	require.Equal(t, 32, progress.total)
	require.Equal(t, 32, progress.processed)
	db.AssertExpectations(t)
}

func TestCheckStashDBChangesCustomCancelled(t *testing.T) {
	db, store, fetcher := newStashDBChangesFixtureCustom(t)
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	progress := &fakeStashDBMatchesProgressCustom{afterProcessed: cancel}

	check := newStashDBChangesCheckCustom(db.Repository(), store, fetcher, stashDBChangesEndpointCustom, progress, time.Now)
	runs, err := check.run(ctx, []models.StashDBChangesKindCustom{
		models.StashDBChangesKindSceneCustom, models.StashDBChangesKindPerformerCustom,
	})
	require.NoError(t, err)
	require.Len(t, store.saved, 1, "performers keep their previous report")
	require.Equal(t, store.saved, runs)
	require.True(t, runs[0].Cancelled)
	require.Equal(t, 25, runs[0].Checked)
	require.Len(t, runs[0].Changes, 4, "the partial run keeps what it checked")
	require.Len(t, fetcher.sceneCalls, 1)
	require.Empty(t, fetcher.performerCalls)
}
