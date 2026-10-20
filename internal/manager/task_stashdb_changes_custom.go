package manager

// CUSTOM: Check linked scenes and performers for StashDB changes.

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/stashapp/stash/pkg/job"
	"github.com/stashapp/stash/pkg/logger"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/sqlite"
	"github.com/stashapp/stash/pkg/stashbox"
)

// Entities per stash-box request; each request aliases one lookup per entity.
const stashDBChangesBatchSizeCustom = 25

type stashDBChangesFetcherCustom interface {
	FindStashDBScenesCustom(ctx context.Context, stashIDs []string) (map[string]*stashbox.StashDBSceneCustom, error)
	FindStashDBPerformersCustom(ctx context.Context, stashIDs []string) (map[string]*models.ScrapedPerformer, error)
}

type stashDBChangesStoreCustom interface {
	Targets(ctx context.Context, kind models.StashDBChangesKindCustom, endpoint string) ([]models.StashDBChangesTargetCustom, error)
	SaveRun(ctx context.Context, run models.StashDBChangesRunCustom) error
}

// stashDBFetchErrorCustom marks a failed stash-box request, which skips its
// batch instead of stopping the run.
type stashDBFetchErrorCustom struct{ err error }

func (e stashDBFetchErrorCustom) Error() string { return e.err.Error() }
func (e stashDBFetchErrorCustom) Unwrap() error { return e.err }

func stashDBBoxCustom(boxes []*models.StashBox) (*models.StashBox, error) {
	for _, b := range boxes {
		if stashbox.IsStashDBEndpointCustom(b.Endpoint) {
			return b, nil
		}
	}
	return nil, errors.New("no stashdb.org stash-box endpoint is configured")
}

func (s *Manager) CheckStashDBChangesCustom(ctx context.Context, kinds []models.StashDBChangesKindCustom) (int, error) {
	if len(kinds) == 0 {
		return 0, errors.New("choose scenes, performers, or both")
	}
	box, err := stashDBBoxCustom(s.Config.GetStashBoxes())
	if err != nil {
		return 0, err
	}

	client := stashbox.NewClient(*box, stashbox.ExcludeTagPatterns(s.Config.GetScraperExcludeTagPatterns()))
	j := job.MakeJobExec(func(ctx context.Context, progress *job.Progress) error {
		check := newStashDBChangesCheckCustom(s.Repository, sqlite.StashDBChangesStoreCustom{}, client, box.Endpoint, progress, time.Now)
		runs, err := check.run(ctx, kinds)
		for _, run := range runs {
			logger.Infof("StashDB Changes (%ss): %d checked, %d differ or are gone, %d failed",
				run.Kind, run.Checked, len(run.Changes), run.Failed)
		}
		return err
	})
	// The report finds a running check by this description
	// (STASHDB_CHANGES_JOB_DESCRIPTION_CUSTOM in the UI).
	return s.JobManager.Add(ctx, "Checking StashDB Changes...", j), nil
}

type stashDBChangesCheckCustom struct {
	repo     models.Repository
	store    stashDBChangesStoreCustom
	fetcher  stashDBChangesFetcherCustom
	endpoint string
	progress stashDBMatchesProgressCustom
	now      func() time.Time

	// Studios, performers, and tags of checked scenes, loaded once per run.
	studios, performers, tags map[int]*stashDBLocalEntityCustom
}

func newStashDBChangesCheckCustom(repo models.Repository, store stashDBChangesStoreCustom, fetcher stashDBChangesFetcherCustom, endpoint string, progress stashDBMatchesProgressCustom, now func() time.Time) *stashDBChangesCheckCustom {
	return &stashDBChangesCheckCustom{
		repo:       repo,
		store:      store,
		fetcher:    fetcher,
		endpoint:   endpoint,
		progress:   progress,
		now:        now,
		studios:    map[int]*stashDBLocalEntityCustom{},
		performers: map[int]*stashDBLocalEntityCustom{},
		tags:       map[int]*stashDBLocalEntityCustom{},
	}
}

// run checks each kind in turn and saves its report, replacing the previous
// one of that kind. A stopped run saves what it checked and skips later kinds,
// which keep their previous report.
func (c *stashDBChangesCheckCustom) run(ctx context.Context, kinds []models.StashDBChangesKindCustom) ([]models.StashDBChangesRunCustom, error) {
	targets := make([][]models.StashDBChangesTargetCustom, len(kinds))
	total := 0
	if err := c.repo.WithReadTxn(ctx, func(ctx context.Context) error {
		for i, kind := range kinds {
			var err error
			if targets[i], err = c.store.Targets(ctx, kind, c.endpoint); err != nil {
				return err
			}
			total += len(targets[i])
		}
		return nil
	}); err != nil {
		return nil, err
	}
	c.progress.SetTotal(total)

	var runs []models.StashDBChangesRunCustom
	for i, kind := range kinds {
		run, err := c.runKind(ctx, kind, targets[i])
		if err != nil {
			return runs, err
		}
		runs = append(runs, run)
		if run.Cancelled {
			logger.Info("Stopping due to user request")
			break
		}
	}
	return runs, nil
}

func (c *stashDBChangesCheckCustom) runKind(ctx context.Context, kind models.StashDBChangesKindCustom, targets []models.StashDBChangesTargetCustom) (models.StashDBChangesRunCustom, error) {
	run := models.StashDBChangesRunCustom{Kind: kind, StartedAt: c.now(), Endpoint: c.endpoint}
	check := c.checkScenes
	if kind == models.StashDBChangesKindPerformerCustom {
		check = c.checkPerformers
	}

	for start := 0; start < len(targets); start += stashDBChangesBatchSizeCustom {
		if job.IsCancelled(ctx) {
			run.Cancelled = true
			break
		}

		batch := targets[start:min(start+stashDBChangesBatchSizeCustom, len(targets))]
		changes, err := check(ctx, batch)
		var fetchErr stashDBFetchErrorCustom
		if errors.As(err, &fetchErr) {
			if job.IsCancelled(ctx) {
				run.Cancelled = true
				break
			}
			logger.Warnf("StashDB Changes: skipping %d %ss after request error: %v", len(batch), kind, err)
			run.Failed += len(batch)
		} else if err != nil {
			return run, err
		}
		run.Changes = append(run.Changes, changes...)
		run.Checked += len(batch)
		c.progress.AddProcessed(len(batch))
	}

	run.FinishedAt = c.now()
	// The job context may be cancelled; still record what was checked.
	if err := c.repo.WithTxn(context.WithoutCancel(ctx), func(ctx context.Context) error {
		return c.store.SaveRun(ctx, run)
	}); err != nil {
		return run, err
	}
	return run, nil
}

func stashDBTargetIDsCustom(batch []models.StashDBChangesTargetCustom) (ids []int, stashIDs []string) {
	for _, target := range batch {
		ids = append(ids, target.ID)
		stashIDs = append(stashIDs, target.StashID)
	}
	return ids, stashIDs
}

// stashDBChangeStatusCustom sets the status of a change found on StashDB: a
// different returned ID means StashDB redirected a merged entity. It returns
// false when there is nothing to report.
func stashDBChangeStatusCustom(change *models.StashDBChangeCustom, remoteID string) bool {
	switch {
	case remoteID != "" && remoteID != change.StashID:
		change.Status = models.StashDBChangeStatusMergedCustom
		change.MergedIntoID = &remoteID
	case len(change.Fields) > 0:
		change.Status = models.StashDBChangeStatusChangedCustom
	default:
		return false
	}
	return true
}

func (c *stashDBChangesCheckCustom) checkScenes(ctx context.Context, batch []models.StashDBChangesTargetCustom) ([]models.StashDBChangeCustom, error) {
	ids, stashIDs := stashDBTargetIDsCustom(batch)
	remote, err := c.fetcher.FindStashDBScenesCustom(ctx, stashIDs)
	if err != nil {
		return nil, stashDBFetchErrorCustom{err}
	}

	var ret []models.StashDBChangeCustom
	err = c.repo.WithReadTxn(ctx, func(ctx context.Context) error {
		scenes, err := c.repo.Scene.FindByIDs(ctx, ids)
		if err != nil {
			return err
		}
		byID := make(map[int]*models.Scene, len(scenes))
		for _, scene := range scenes {
			byID[scene.ID] = scene
		}
		for _, target := range batch {
			// Deleted locally since the check started.
			scene := byID[target.ID]
			if scene == nil {
				continue
			}
			change := models.StashDBChangeCustom{ID: target.ID, StashID: target.StashID}
			r := remote[target.StashID]
			switch {
			case r == nil:
				change.Status = models.StashDBChangeStatusNotFoundCustom
			case r.Deleted:
				change.Status = models.StashDBChangeStatusDeletedCustom
			default:
				local, err := c.localScene(ctx, scene)
				if err != nil {
					return err
				}
				change.Fields = compareStashDBSceneCustom(local, r)
				if !stashDBChangeStatusCustom(&change, r.ID) {
					continue
				}
			}
			ret = append(ret, change)
		}
		return nil
	})
	return ret, err
}

func (c *stashDBChangesCheckCustom) checkPerformers(ctx context.Context, batch []models.StashDBChangesTargetCustom) ([]models.StashDBChangeCustom, error) {
	_, stashIDs := stashDBTargetIDsCustom(batch)
	remote, err := c.fetcher.FindStashDBPerformersCustom(ctx, stashIDs)
	if err != nil {
		return nil, stashDBFetchErrorCustom{err}
	}

	var ret []models.StashDBChangeCustom
	err = c.repo.WithReadTxn(ctx, func(ctx context.Context) error {
		for _, target := range batch {
			performer, err := c.repo.Performer.Find(ctx, target.ID)
			if err != nil {
				return err
			}
			if performer == nil {
				continue
			}
			change := models.StashDBChangeCustom{ID: target.ID, StashID: target.StashID}
			r := remote[target.StashID]
			switch {
			case r == nil:
				change.Status = models.StashDBChangeStatusNotFoundCustom
			case r.RemoteMergedIntoId != nil:
				change.Status = models.StashDBChangeStatusMergedCustom
				change.MergedIntoID = r.RemoteMergedIntoId
			case r.RemoteDeleted:
				change.Status = models.StashDBChangeStatusDeletedCustom
			default:
				if err := performer.LoadAliases(ctx, c.repo.Performer); err != nil {
					return err
				}
				if err := performer.LoadURLs(ctx, c.repo.Performer); err != nil {
					return err
				}
				change.Fields = compareStashDBPerformerCustom(performer, r)
				var remoteID string
				if r.RemoteSiteID != nil {
					remoteID = *r.RemoteSiteID
				}
				if !stashDBChangeStatusCustom(&change, remoteID) {
					continue
				}
			}
			ret = append(ret, change)
		}
		return nil
	})
	return ret, err
}

func (c *stashDBChangesCheckCustom) localScene(ctx context.Context, scene *models.Scene) (stashDBLocalSceneCustom, error) {
	local := stashDBLocalSceneCustom{Scene: scene}
	r := c.repo.Scene
	if err := scene.LoadURLs(ctx, r); err != nil {
		return local, err
	}
	if err := scene.LoadPerformerIDs(ctx, r); err != nil {
		return local, err
	}
	if err := scene.LoadTagIDs(ctx, r); err != nil {
		return local, err
	}

	if scene.StudioID != nil {
		studio, err := c.related(ctx, c.studios, *scene.StudioID, c.loadStudio)
		if err != nil {
			return local, err
		}
		local.Studio = &studio
	}
	for _, id := range scene.PerformerIDs.List() {
		performer, err := c.related(ctx, c.performers, id, c.loadPerformer)
		if err != nil {
			return local, err
		}
		local.Performers = append(local.Performers, performer)
	}
	for _, id := range scene.TagIDs.List() {
		tag, err := c.related(ctx, c.tags, id, c.loadTag)
		if err != nil {
			return local, err
		}
		local.Tags = append(local.Tags, tag)
	}
	return local, nil
}

func (c *stashDBChangesCheckCustom) related(ctx context.Context, cache map[int]*stashDBLocalEntityCustom, id int, load func(context.Context, int) (*stashDBLocalEntityCustom, error)) (stashDBLocalEntityCustom, error) {
	if e := cache[id]; e != nil {
		return *e, nil
	}
	e, err := load(ctx, id)
	if err != nil {
		return stashDBLocalEntityCustom{}, err
	}
	cache[id] = e
	return *e, nil
}

func (c *stashDBChangesCheckCustom) endpointIDs(ids []models.StashID) []string {
	var ret []string
	for _, id := range ids {
		if id.Endpoint == c.endpoint {
			ret = append(ret, id.StashID)
		}
	}
	return ret
}

func (c *stashDBChangesCheckCustom) loadStudio(ctx context.Context, id int) (*stashDBLocalEntityCustom, error) {
	r := c.repo.Studio
	s, err := r.Find(ctx, id)
	if err != nil {
		return nil, err
	}
	if s == nil {
		return nil, fmt.Errorf("studio %d not found", id)
	}
	if err := s.LoadAliases(ctx, r); err != nil {
		return nil, err
	}
	if err := s.LoadStashIDs(ctx, r); err != nil {
		return nil, err
	}
	return &stashDBLocalEntityCustom{Name: s.Name, Aliases: s.Aliases.List(), StashIDs: c.endpointIDs(s.StashIDs.List())}, nil
}

func (c *stashDBChangesCheckCustom) loadPerformer(ctx context.Context, id int) (*stashDBLocalEntityCustom, error) {
	r := c.repo.Performer
	p, err := r.Find(ctx, id)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, fmt.Errorf("performer %d not found", id)
	}
	if err := p.LoadAliases(ctx, r); err != nil {
		return nil, err
	}
	if err := p.LoadStashIDs(ctx, r); err != nil {
		return nil, err
	}
	return &stashDBLocalEntityCustom{Name: p.Name, Aliases: p.Aliases.List(), StashIDs: c.endpointIDs(p.StashIDs.List())}, nil
}

func (c *stashDBChangesCheckCustom) loadTag(ctx context.Context, id int) (*stashDBLocalEntityCustom, error) {
	r := c.repo.Tag
	t, err := r.Find(ctx, id)
	if err != nil {
		return nil, err
	}
	if t == nil {
		return nil, fmt.Errorf("tag %d not found", id)
	}
	if err := t.LoadAliases(ctx, r); err != nil {
		return nil, err
	}
	if err := t.LoadStashIDs(ctx, r); err != nil {
		return nil, err
	}
	return &stashDBLocalEntityCustom{Name: t.Name, Aliases: t.Aliases.List(), StashIDs: c.endpointIDs(t.StashIDs.List())}, nil
}
