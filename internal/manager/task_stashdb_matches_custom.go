package manager

// CUSTOM: Refresh StashDB Matches for every scene linked to StashDB.

import (
	"context"
	"errors"
	"time"

	"github.com/stashapp/stash/pkg/job"
	"github.com/stashapp/stash/pkg/logger"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/stashbox"
)

// Scenes per stash-box request; each request aliases one findScene per scene.
const stashDBMatchesBatchSizeCustom = 25

type stashDBMatchesFetcherCustom interface {
	FindStashDBMatchesCustom(ctx context.Context, stashIDs []string) (map[string]stashbox.StashDBMatchCustom, error)
}

type stashDBMatchesProgressCustom interface {
	SetTotal(total int)
	AddProcessed(v int)
}

func (s *Manager) RefreshStashDBMatchesCustom(ctx context.Context) (int, error) {
	var box *models.StashBox
	for _, b := range s.Config.GetStashBoxes() {
		if stashbox.IsStashDBEndpointCustom(b.Endpoint) {
			box = b
			break
		}
	}
	if box == nil {
		return 0, errors.New("no stashdb.org stash-box endpoint is configured")
	}

	client := stashbox.NewClient(*box)
	j := job.MakeJobExec(func(ctx context.Context, progress *job.Progress) error {
		report, err := refreshStashDBMatchesCustom(ctx, s.Repository, client, box.Endpoint, progress, time.Now)
		if err != nil {
			return err
		}
		logger.Infof("StashDB Matches refreshed: %d changed, %d unchanged, %d not found on StashDB, %d failed",
			report.Changed, report.Unchanged, report.NotFound, report.Failed)
		return nil
	})
	return s.JobManager.Add(ctx, "Refreshing StashDB Matches...", j), nil
}

// refreshStashDBMatchesCustom re-reads every linked scene's count and writes
// only the ones that differ from the stored value, including first-time counts.
// A failed request skips its batch so one bad response does not stop the run.
// The run's report replaces the previous one, also when the job is cancelled.
func refreshStashDBMatchesCustom(ctx context.Context, repo models.Repository, fetcher stashDBMatchesFetcherCustom, endpoint string, progress stashDBMatchesProgressCustom, now func() time.Time) (models.StashDBMatchesReportCustom, error) {
	report := models.StashDBMatchesReportCustom{StartedAt: now(), Endpoint: &endpoint}

	var targets []models.StashDBMatchTargetCustom
	if err := repo.WithReadTxn(ctx, func(ctx context.Context) error {
		var err error
		targets, err = repo.Scene.FindStashDBMatchTargetsCustom(ctx, endpoint)
		return err
	}); err != nil {
		return report, err
	}
	progress.SetTotal(len(targets))

	for start := 0; start < len(targets); start += stashDBMatchesBatchSizeCustom {
		if job.IsCancelled(ctx) {
			report.Cancelled = true
			break
		}

		batch := targets[start:min(start+stashDBMatchesBatchSizeCustom, len(targets))]
		ids := make([]string, len(batch))
		for i, target := range batch {
			ids[i] = target.StashID
		}

		results, err := fetcher.FindStashDBMatchesCustom(ctx, ids)
		if err != nil {
			if job.IsCancelled(ctx) {
				report.Cancelled = true
				break
			}
			logger.Warnf("StashDB Matches: skipping %d scenes after request error: %v", len(batch), err)
			report.Failed += len(batch)
			report.Checked += len(batch)
			progress.AddProcessed(len(batch))
			continue
		}

		var changes []models.StashDBMatchesChangeCustom
		for _, target := range batch {
			result, found := results[target.StashID]
			if found && !result.Submitted {
				report.Unsubmitted = append(report.Unsubmitted, models.StashDBUnsubmittedSceneCustom{
					SceneID: target.SceneID,
					StashID: target.StashID,
					Matches: result.Matches,
				})
			}
			switch {
			case !found:
				report.NotFound++
			case target.Matches != nil && *target.Matches == result.Matches:
				report.Unchanged++
			default:
				changes = append(changes, models.StashDBMatchesChangeCustom{
					SceneID:  target.SceneID,
					Previous: target.Matches,
					Current:  result.Matches,
				})
			}
		}

		if len(changes) > 0 {
			if err := repo.WithTxn(ctx, func(ctx context.Context) error {
				for _, change := range changes {
					if err := repo.Scene.SetStashDBMatchesCustom(ctx, change.SceneID, &change.Current); err != nil {
						return err
					}
				}
				return nil
			}); err != nil {
				return report, err
			}
			report.Changes = append(report.Changes, changes...)
			report.Changed += len(changes)
		}
		report.Checked += len(batch)
		progress.AddProcessed(len(batch))
	}

	if report.Cancelled {
		logger.Info("Stopping due to user request")
	}
	report.FinishedAt = now()
	// The job context may be cancelled; still record what was written.
	if err := repo.WithTxn(context.WithoutCancel(ctx), func(ctx context.Context) error {
		return repo.Scene.SaveStashDBMatchesReportCustom(ctx, report)
	}); err != nil {
		return report, err
	}
	return report, nil
}
