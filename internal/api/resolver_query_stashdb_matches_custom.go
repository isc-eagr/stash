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

		ids := make([]int, len(report.Changes))
		for i, change := range report.Changes {
			ids[i] = change.SceneID
		}
		scenes, err := r.repository.Scene.FindMany(ctx, ids)
		if err != nil {
			return err
		}
		byID := make(map[int]*models.Scene, len(scenes))
		for _, scene := range scenes {
			byID[scene.ID] = scene
		}

		ret = &StashDBMatchesReport{
			StartedAt:  report.StartedAt,
			FinishedAt: report.FinishedAt,
			Checked:    report.Checked,
			Changed:    report.Changed,
			Unchanged:  report.Unchanged,
			NotFound:   report.NotFound,
			Failed:     report.Failed,
			Cancelled:  report.Cancelled,
			Changes:    make([]*StashDBMatchesChange, 0, len(report.Changes)),
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
