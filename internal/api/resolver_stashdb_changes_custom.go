package api

// CUSTOM: StashDB Changes check and report.

import (
	"context"
	"strconv"

	"github.com/stashapp/stash/internal/manager"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/sliceutil"
	"github.com/stashapp/stash/pkg/sqlite"
)

func (r *mutationResolver) CheckStashDBChanges(ctx context.Context, input StashDBChangesCheckInput) (string, error) {
	var kinds []models.StashDBChangesKindCustom
	if input.Scenes {
		kinds = append(kinds, models.StashDBChangesKindSceneCustom)
	}
	if input.Performers {
		kinds = append(kinds, models.StashDBChangesKindPerformerCustom)
	}
	jobID, err := manager.GetInstance().CheckStashDBChangesCustom(ctx, kinds)
	if err != nil {
		return "", err
	}
	return strconv.Itoa(jobID), nil
}

func (r *queryResolver) StashDBChangesReport(ctx context.Context) (*StashDBChangesReport, error) {
	ret := &StashDBChangesReport{
		Scenes:     []*StashDBSceneChange{},
		Performers: []*StashDBPerformerChange{},
	}
	store := sqlite.StashDBChangesStoreCustom{}
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		sceneRun, err := store.GetRun(ctx, models.StashDBChangesKindSceneCustom)
		if err != nil {
			return err
		}
		if sceneRun != nil {
			ret.SceneRun = stashDBChangesRunCustom(sceneRun)
			scenes, err := r.repository.Scene.FindMany(ctx, stashDBChangeIDsCustom(sceneRun))
			if err != nil {
				return err
			}
			byID := make(map[int]*models.Scene, len(scenes))
			for _, scene := range scenes {
				byID[scene.ID] = scene
			}
			for _, change := range sceneRun.Changes {
				ret.Scenes = append(ret.Scenes, &StashDBSceneChange{
					Scene:        byID[change.ID],
					StashID:      change.StashID,
					Status:       StashDBChangeStatus(change.Status),
					MergedIntoID: change.MergedIntoID,
					Fields:       stashDBFieldChangesCustom(change.Fields),
				})
			}
		}

		performerRun, err := store.GetRun(ctx, models.StashDBChangesKindPerformerCustom)
		if err != nil {
			return err
		}
		if performerRun != nil {
			ret.PerformerRun = stashDBChangesRunCustom(performerRun)
			performers, err := r.repository.Performer.FindMany(ctx, stashDBChangeIDsCustom(performerRun))
			if err != nil {
				return err
			}
			byID := make(map[int]*models.Performer, len(performers))
			for _, performer := range performers {
				byID[performer.ID] = performer
			}
			for _, change := range performerRun.Changes {
				ret.Performers = append(ret.Performers, &StashDBPerformerChange{
					Performer:    byID[change.ID],
					StashID:      change.StashID,
					Status:       StashDBChangeStatus(change.Status),
					MergedIntoID: change.MergedIntoID,
					Fields:       stashDBFieldChangesCustom(change.Fields),
				})
			}
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

// An entity linked to several StashDB entries appears once per link.
func stashDBChangeIDsCustom(run *models.StashDBChangesRunCustom) []int {
	ids := make([]int, len(run.Changes))
	for i, change := range run.Changes {
		ids[i] = change.ID
	}
	return sliceutil.AppendUniques(nil, ids)
}

func stashDBChangesRunCustom(run *models.StashDBChangesRunCustom) *StashDBChangesRun {
	return &StashDBChangesRun{
		StartedAt:  run.StartedAt,
		FinishedAt: run.FinishedAt,
		Endpoint:   run.Endpoint,
		Checked:    run.Checked,
		Failed:     run.Failed,
		Cancelled:  run.Cancelled,
	}
}

func stashDBFieldChangesCustom(fields []models.StashDBFieldChangeCustom) []*StashDBFieldChange {
	ret := make([]*StashDBFieldChange, len(fields))
	for i, f := range fields {
		ret[i] = &StashDBFieldChange{
			Field:   f.Field,
			Local:   f.Local,
			Remote:  f.Remote,
			Added:   append([]string{}, f.Added...),
			Removed: append([]string{}, f.Removed...),
		}
	}
	return ret
}
