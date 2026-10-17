package manager

// CUSTOM: Studio site sync report. Each run collects what it changed and what
// still needs a manual fix; only the latest run per studio is kept, in memory,
// so a restart drops it.

import (
	"cmp"
	"context"
	"slices"
	"sync"

	"github.com/stashapp/stash/pkg/job"
	"github.com/stashapp/stash/pkg/models"
)

type siteSyncReportCustom struct {
	mu     sync.Mutex
	report models.StudioSiteSyncReport
	scenes map[int]*models.StudioSiteSyncSceneChange
}

func newSiteSyncReportCustom(site string) *siteSyncReportCustom {
	return &siteSyncReportCustom{
		report: models.StudioSiteSyncReport{Site: site},
		scenes: map[int]*models.StudioSiteSyncSceneChange{},
	}
}

func (r *siteSyncReportCustom) update(fn func(report *models.StudioSiteSyncReport)) {
	r.mu.Lock()
	defer r.mu.Unlock()
	fn(&r.report)
}

// note records something the run did to or found about scene.
func (r *siteSyncReportCustom) note(scene models.SiteSyncSceneCustom, fn func(c *models.StudioSiteSyncSceneChange)) {
	r.mu.Lock()
	defer r.mu.Unlock()
	c, ok := r.scenes[scene.ID]
	if !ok {
		c = &models.StudioSiteSyncSceneChange{SceneID: scene.ID, Title: scene.Title, Basename: scene.Basename, Code: scene.Code}
		r.scenes[scene.ID] = c
	}
	fn(c)
}

func (r *siteSyncReportCustom) issue(scene models.SiteSyncSceneCustom, code, issue string) {
	r.note(scene, func(c *models.StudioSiteSyncSceneChange) {
		c.Code = cmp.Or(c.Code, code)
		c.Issues = append(c.Issues, issue)
	})
}

func (r *siteSyncReportCustom) finish(ctx context.Context, err error) {
	r.update(func(report *models.StudioSiteSyncReport) {
		report.Finished = true
		report.Cancelled = job.IsCancelled(ctx)
		if err != nil {
			msg := err.Error()
			report.Error = &msg
		}
	})
}

// snapshot copies the report with its scenes in ID order.
func (r *siteSyncReportCustom) snapshot() *models.StudioSiteSyncReport {
	r.mu.Lock()
	defer r.mu.Unlock()
	ret := r.report
	ret.Warnings = slices.Clone(r.report.Warnings)
	ret.Scenes = make([]*models.StudioSiteSyncSceneChange, 0, len(r.scenes))
	for _, c := range r.scenes {
		copied := *c
		copied.Filled = slices.Clone(c.Filled)
		copied.Issues = slices.Clone(c.Issues)
		ret.Scenes = append(ret.Scenes, &copied)
	}
	slices.SortFunc(ret.Scenes, func(a, b *models.StudioSiteSyncSceneChange) int { return a.SceneID - b.SceneID })
	return &ret
}

// Latest report per studio ID.
var siteSyncReportsCustom = struct {
	mu       sync.Mutex
	byStudio map[int]*siteSyncReportCustom
}{byStudio: map[int]*siteSyncReportCustom{}}

// StudioSiteSyncReportCustom returns the studio's latest site sync report
// since the last restart, or nil.
func (s *Manager) StudioSiteSyncReportCustom(studioID int) *models.StudioSiteSyncReport {
	siteSyncReportsCustom.mu.Lock()
	r := siteSyncReportsCustom.byStudio[studioID]
	siteSyncReportsCustom.mu.Unlock()
	if r == nil {
		return nil
	}
	ret := r.snapshot()
	if !ret.Finished {
		// A job cancelled before it started never ran its own finish.
		if j := s.JobManager.GetJob(ret.JobID); j == nil || slices.Contains([]job.Status{job.StatusFinished, job.StatusFailed, job.StatusCancelled}, j.Status) {
			ret.Finished, ret.Cancelled = true, true
		}
	}
	return ret
}
