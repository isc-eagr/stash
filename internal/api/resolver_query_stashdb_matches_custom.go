package api

// CUSTOM: StashDB Matches refresh report.

import (
	"context"

	"github.com/stashapp/stash/pkg/models"
)

func (r *queryResolver) StashDBMatchesReport(ctx context.Context) (ret *StashDBMatchesReport, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		report, err := r.repository.Scene.GetStashDBMatchesReportCustom(ctx)
		if err != nil || report == nil {
			return err
		}

		ids := make([]int, len(report.Changes), len(report.Changes)+len(report.Unsubmitted))
		for i, change := range report.Changes {
			ids[i] = change.SceneID
		}
		for _, scene := range report.Unsubmitted {
			ids = append(ids, scene.SceneID)
		}
		// A scene can appear in both sections; FindByIDs allows repeated IDs.
		scenes, err := r.repository.Scene.FindByIDs(ctx, ids)
		if err != nil {
			return err
		}
		byID := make(map[int]*models.Scene, len(scenes))
		for _, scene := range scenes {
			byID[scene.ID] = scene
		}

		ret = &StashDBMatchesReport{
			StartedAt:   report.StartedAt,
			FinishedAt:  report.FinishedAt,
			Checked:     report.Checked,
			Changed:     report.Changed,
			Unchanged:   report.Unchanged,
			NotFound:    report.NotFound,
			Failed:      report.Failed,
			Cancelled:   report.Cancelled,
			Endpoint:    report.Endpoint,
			Changes:     make([]*StashDBMatchesChange, 0, len(report.Changes)),
			Unsubmitted: make([]*StashDBUnsubmittedScene, 0, len(report.Unsubmitted)),
		}
		for _, entry := range report.Unsubmitted {
			if scene := byID[entry.SceneID]; scene != nil {
				ret.Unsubmitted = append(ret.Unsubmitted, &StashDBUnsubmittedScene{
					Scene:   scene,
					StashID: entry.StashID,
					Matches: entry.Matches,
				})
			}
		}
		for _, change := range report.Changes {
			if scene := byID[change.SceneID]; scene != nil {
				ret.Changes = append(ret.Changes, &StashDBMatchesChange{
					Scene:    scene,
					Previous: change.Previous,
					Current:  change.Current,
				})
			}
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return ret, nil
}
