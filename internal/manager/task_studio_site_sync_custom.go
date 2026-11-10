package manager

// CUSTOM: Studio site sync. One click on a supported studio's page fills
// scene codes, titles, dates, details and URLs from the studio's site,
// downloads missing members pictures (or finds the folders added by hand),
// scans the new picture folders and builds a gallery for every scene whose
// pictures are in Stash.

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/stashapp/stash/internal/manager/config"
	"github.com/stashapp/stash/pkg/job"
	"github.com/stashapp/stash/pkg/logger"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/sitesync"
	"github.com/stashapp/stash/pkg/sqlite"
)

const (
	// Pause between site requests so a full run does not hammer the site.
	siteSyncRequestDelayCustom = 250 * time.Millisecond
	// UI configuration key holding each site's credentials and pictures path.
	siteSyncConfigKeyCustom = "studioSiteSync"
)

// StudioSiteSyncStepsCustom picks the parts of a site sync to run.
type StudioSiteSyncStepsCustom struct {
	// Codes finds codes for scenes without one.
	Codes bool
	// Metadata fills titles, dates, details, links and covers.
	Metadata bool
	// Pictures downloads missing members pictures; sites without downloads
	// ignore it.
	Pictures bool
	// Galleries scans picture folders and builds the galleries.
	Galleries bool
}

// StudioSiteSyncCustom queues the site sync for a studio and returns the job ID.
func (s *Manager) StudioSiteSyncCustom(ctx context.Context, studioID int, steps StudioSiteSyncStepsCustom) (int, error) {
	if !steps.Codes && !steps.Metadata && !steps.Pictures && !steps.Galleries {
		return 0, errors.New("pick at least one step")
	}
	var studio *models.Studio
	if err := s.Repository.WithReadTxn(ctx, func(ctx context.Context) error {
		var err error
		studio, err = s.Repository.Studio.Find(ctx, studioID)
		return err
	}); err != nil {
		return 0, err
	}
	if studio == nil {
		return 0, fmt.Errorf("studio %d not found", studioID)
	}
	key := sitesync.SiteKey(studio.Name)
	if key == "" {
		return 0, fmt.Errorf("%s has no site sync", studio.Name)
	}
	cfg := studioSiteSyncConfigCustom(config.GetInstance().GetUIConfiguration(), key)
	if cfg.PicsPath == "" && key != sitesync.LatinboyzKey && (steps.Pictures || steps.Galleries) {
		return 0, fmt.Errorf("set the %s pictures folder in Settings > Custom first", studio.Name)
	}
	if cfg.PicsPath != "" {
		cfg.PicsPath = filepath.Clean(cfg.PicsPath)
	}

	site := sitesync.New(key, sitesync.NewClient(cfg.Username, cfg.Password, siteSyncRequestDelayCustom))
	name := site.Name()
	task := &studioSiteSyncTaskCustom{
		data:     &repoSiteSyncDataCustom{repo: s.Repository},
		site:     site,
		studioID: studioID,
		picsPath: cfg.PicsPath,
		steps:    steps,
		report:   newSiteSyncReportCustom(name),
	}
	sync := job.MakeJobExec(func(ctx context.Context, progress *job.Progress) (err error) {
		defer func() { task.report.finish(ctx, err) }()
		scanPaths, err := task.syncScenes(ctx, progress)
		if err != nil || job.IsCancelled(ctx) || !task.steps.Galleries {
			return err
		}
		if len(scanPaths) > 0 {
			// The scan runs inside this job so the report covers the galleries too.
			logger.Infof("[site sync] %s: scanning %d picture folders before creating galleries", name, len(scanPaths))
			input := ScanMetadataInput{Paths: scanPaths}
			if defaults := config.GetInstance().GetDefaultScanSettings(); defaults != nil {
				input.ScanMetadataOptions = *defaults
			}
			var scan *ScanJob
			if scan, err = s.newScanJob(input); err != nil {
				return err
			}
			progress.ExecuteTask(fmt.Sprintf("Scanning %d picture folders", len(scanPaths)), func() {
				err = scan.Execute(ctx, progress)
			})
			if err != nil || job.IsCancelled(ctx) {
				return err
			}
			task.report.update(func(r *models.StudioSiteSyncReport) { r.ScannedFolders = len(scanPaths) })
		}
		return task.createGalleries(ctx, progress)
	})
	jobID := s.JobManager.Add(ctx, fmt.Sprintf("Syncing %s from its site...", name), sync)
	task.report.update(func(r *models.StudioSiteSyncReport) { r.JobID = jobID })
	siteSyncReportsCustom.mu.Lock()
	siteSyncReportsCustom.byStudio[studioID] = task.report
	siteSyncReportsCustom.mu.Unlock()
	return jobID, nil
}

// studioSiteSyncConfigCustom reads uiConfig.studioSiteSync.<key>.
func studioSiteSyncConfigCustom(uiConfig map[string]interface{}, key string) sitesync.Config {
	sites, _ := uiConfig[siteSyncConfigKeyCustom].(map[string]interface{})
	site, _ := sites[key].(map[string]interface{})
	value := func(name string) string {
		v, _ := site[name].(string)
		return strings.TrimSpace(v)
	}
	return sitesync.Config{
		Username: value("username"),
		Password: value("password"),
		PicsPath: value("picsPath"),
	}
}

// siteSyncDataCustom is the storage the site sync reads and writes, each
// call in its own transaction so a cancelled run keeps finished scenes.
type siteSyncDataCustom interface {
	Scenes(ctx context.Context, studioID int) ([]models.SiteSyncSceneCustom, error)
	UpdateScene(ctx context.Context, sceneID int, partial models.ScenePartial) error
	UpdateCover(ctx context.Context, sceneID int, image []byte) error
	// FolderImageIDs lists the scanned images in dir and its subfolders, none
	// when Stash has not scanned it.
	FolderImageIDs(ctx context.Context, dir string) ([]int, error)
	// CreateGallery also gives the images the gallery's studio when they have none.
	CreateGallery(ctx context.Context, gallery *models.Gallery, imageIDs []int) error
}

type siteSyncProgressCustom interface {
	SetTotal(total int)
	SetProcessed(processed int)
	Increment()
}

type studioSiteSyncTaskCustom struct {
	data     siteSyncDataCustom
	site     sitesync.Site
	studioID int
	picsPath string
	steps    StudioSiteSyncStepsCustom
	report   *siteSyncReportCustom
	// Code -> hand-added pictures folders, read once per run.
	folders map[string][]string
	// Conflicting/ambiguous metadata must not create or attach pictures.
	blocked map[int]bool
}

type siteSyncWorkCustom struct {
	scene   models.SiteSyncSceneCustom
	code    string
	newCode bool
}

// syncScenes saves codes, fills metadata and downloads missing pictures, as
// far as the chosen steps go. It returns the picture folders Stash still has
// to scan, none when galleries are not built.
func (t *studioSiteSyncTaskCustom) syncScenes(ctx context.Context, progress siteSyncProgressCustom) ([]string, error) {
	name := t.site.Name()
	scenes, err := t.data.Scenes(ctx, t.studioID)
	if err != nil {
		return nil, err
	}
	t.preparePublicPictures()
	work, err := t.resolveCodes(ctx, scenes)
	if err != nil {
		return nil, err
	}

	var fill, download []*siteSyncWorkCustom
	public, isPublic := t.site.(sitesync.PublicSceneSite)
	for _, w := range work {
		incomplete := w.scene.Title == "" || w.scene.Date == ""
		if isPublic {
			incomplete = incomplete || w.scene.Details == "" || !public.HasSceneURL(siteSyncSceneCustom(w.scene))
		}
		if w.newCode || (w.code == "" && t.steps.Codes) || (t.steps.Metadata && incomplete) {
			fill = append(fill, w)
		}
		if !w.scene.HasGallery && (t.steps.Pictures || t.steps.Galleries) {
			download = append(download, w)
		}
	}
	progress.SetTotal(len(fill) + len(download))
	progress.SetProcessed(0)

	updated, notOnSite, failed := 0, 0, 0
	for _, w := range fill {
		if job.IsCancelled(ctx) {
			return nil, nil
		}
		var md sitesync.Metadata
		if t.steps.Metadata || (w.code == "" && t.steps.Codes) {
			md, err = t.site.Scrape(ctx, w.code, siteSyncSceneCustom(w.scene))
			switch {
			case errors.Is(err, sitesync.ErrCodeConflict), errors.Is(err, sitesync.ErrAmbiguous):
				if t.blocked == nil {
					t.blocked = map[int]bool{}
				}
				t.blocked[w.scene.ID] = true
				t.report.issue(w.scene, w.code, err.Error())
				progress.Increment()
				continue
			case errors.Is(err, sitesync.ErrUnauthorized):
				return nil, fmt.Errorf("%s: %w; check the credentials in Settings > Custom", name, err)
			case errors.Is(err, sitesync.ErrNotFound):
				notOnSite++
				logger.Infof("[site sync] %s: %s (code %s) is not on the site", name, w.scene.Basename, w.code)
				issue := fmt.Sprintf("Code %s is not on the site", w.code)
				if isPublic {
					issue = "No public match; add the public Latinboyz scene URL in Scenes > Edit > URLs"
				}
				t.report.issue(w.scene, w.code, issue)
			case err != nil:
				failed++
				logger.Warnf("[site sync] %s: reading %s (code %s): %v", name, w.scene.Basename, w.code, err)
				t.report.issue(w.scene, w.code, fmt.Sprintf("Reading the site failed: %v", err))
			}
		}
		if w.code == "" && md.Code != "" && t.steps.Codes {
			w.code, w.newCode = md.Code, true
		}
		if !t.steps.Metadata {
			md = sitesync.Metadata{}
		}
		var filled []string
		// The site's image replaces the generated cover when the scene is
		// filled for the first time. It goes first so the scene update below
		// refreshes the cover's cache key.
		if md.Cover != "" && w.scene.Title == "" {
			if err := t.updateCover(ctx, w.scene.ID, md.Cover); err != nil {
				failed++
				logger.Warnf("[site sync] %s: setting the cover of %s (code %s): %v", name, w.scene.Basename, w.code, err)
				t.report.issue(w.scene, w.code, fmt.Sprintf("Setting the cover failed: %v", err))
			} else {
				filled = append(filled, "cover")
			}
		}
		if partial, fields := siteSyncScenePartialCustom(w, md); len(fields) > 0 {
			if err := t.data.UpdateScene(ctx, w.scene.ID, partial); err != nil {
				return nil, err
			}
			updated++
			filled = append(fields, filled...)
			if partial.Title.Set {
				w.scene.Title = md.Title
			}
		}
		if len(filled) > 0 {
			t.report.note(w.scene, func(c *models.StudioSiteSyncSceneChange) {
				c.Title, c.Code = w.scene.Title, w.code
				c.Filled = append(c.Filled, filled...)
			})
		}
		progress.Increment()
	}

	picsSite, downloads := t.site.(sitesync.PicsSite)
	var scanPaths []string
	downloaded, noPictures, membersClosed := 0, 0, 0
	for _, w := range download {
		if job.IsCancelled(ctx) {
			return nil, nil
		}
		if t.blocked[w.scene.ID] || w.code == "" {
			progress.Increment()
			continue
		}
		dirs, err := t.picsDirs(w.code)
		if err != nil {
			return nil, err
		}
		created := false
		if downloads && t.steps.Pictures {
			created, err = sitesync.DownloadPics(ctx, picsSite, t.picsPath, w.code)
		} else if !downloads && len(dirs) == 0 {
			err = sitesync.ErrNotFound
		}
		switch {
		case err == nil && created:
			downloaded++
			t.report.note(w.scene, func(c *models.StudioSiteSyncSceneChange) {
				c.Code = w.code
				c.Pictures = true
			})
			if t.steps.Galleries {
				scanPaths = append(scanPaths, dirs...)
			}
		case err == nil && t.steps.Galleries:
			// Downloaded or added before, but never scanned or scanned while
			// still empty.
			for _, dir := range dirs {
				if entries, err := os.ReadDir(dir); err != nil || len(entries) == 0 {
					continue
				}
				ids, err := t.data.FolderImageIDs(ctx, dir)
				if err != nil {
					return nil, err
				}
				if len(ids) == 0 {
					scanPaths = append(scanPaths, dir)
				}
			}
		case errors.Is(err, sitesync.ErrUnauthorized):
			membersClosed++
		case errors.Is(err, sitesync.ErrNotFound):
			noPictures++
		case err != nil:
			failed++
			logger.Warnf("[site sync] %s: downloading pictures for code %s: %v", name, w.code, err)
			t.report.issue(w.scene, w.code, fmt.Sprintf("Downloading pictures failed: %v", err))
		}
		progress.Increment()
	}

	logger.Infof("[site sync] %s: %d scenes updated, %d not on the site, %d picture folders downloaded, %d codes without pictures, %d failures",
		name, updated, notOnSite, downloaded, noPictures, failed)
	t.report.update(func(r *models.StudioSiteSyncReport) { r.NoPictures = noPictures })
	// Only the metadata and pictures steps read the members area.
	if downloads && (t.steps.Metadata || t.steps.Pictures) && t.site.Client().MembersUnavailable() {
		logger.Warnf("[site sync] %s: the members area refused the credentials or has none set, so members-only dates were skipped and %d codes still need pictures",
			name, membersClosed)
		t.report.update(func(r *models.StudioSiteSyncReport) {
			r.Warnings = append(r.Warnings, fmt.Sprintf(
				"The members area refused the login (or none is set), so members-only dates were skipped and %d scenes still need pictures.", membersClosed))
		})
	}
	return scanPaths, nil
}

// resolveCodes picks each unpostponed scene's code: the stored one or, when
// codes are matched, one read from the file name or URLs, or for sites that
// need it a match against the site's own video links.
func (t *studioSiteSyncTaskCustom) resolveCodes(ctx context.Context, scenes []models.SiteSyncSceneCustom) ([]*siteSyncWorkCustom, error) {
	name := t.site.Name()
	holders := map[string]string{} // code -> scene holding it, for the report
	var work []*siteSyncWorkCustom
	var unresolved []sitesync.Scene
	pending := map[int]models.SiteSyncSceneCustom{}
	postponed := 0
	for _, scene := range scenes {
		if scene.Postponed {
			postponed++
			continue
		}
		code, newCode := scene.Code, false
		if code == "" && t.steps.Codes {
			code = t.site.SceneCode(siteSyncSceneCustom(scene))
			newCode = code != ""
		}
		if code == "" {
			if public, ok := t.site.(sitesync.PublicSceneSite); ok && t.steps.Codes {
				if public.HasSceneURL(siteSyncSceneCustom(scene)) {
					work = append(work, &siteSyncWorkCustom{scene: scene})
				} else {
					t.report.issue(scene, "", "Cannot match filename; add the public Latinboyz scene URL in Scenes > Edit > URLs, or enter Code")
				}
				continue
			}
			unresolved = append(unresolved, siteSyncSceneCustom(scene))
			pending[scene.ID] = scene
			continue
		}
		holders[code] = siteSyncSceneLabelCustom(scene)
		work = append(work, &siteSyncWorkCustom{scene: scene, code: code, newCode: newCode})
	}
	t.report.update(func(r *models.StudioSiteSyncReport) {
		r.Checked = len(scenes) - postponed
		r.Postponed = postponed
	})
	resolver, ok := t.site.(sitesync.CodeResolver)
	if !t.steps.Codes || !ok || len(unresolved) == 0 {
		return work, nil
	}

	// Postponed scenes still hold their codes, stored or in the file name.
	for _, scene := range scenes {
		if !scene.Postponed {
			continue
		}
		if code := cmp.Or(scene.Code, t.site.SceneCode(siteSyncSceneCustom(scene))); code != "" {
			holders[code] = siteSyncSceneLabelCustom(scene) + " (postponed)"
		}
	}
	taken := make(map[string]bool, len(holders))
	for code := range holders {
		taken[code] = true
	}
	res, err := resolver.ResolveCodes(ctx, unresolved, taken)
	if err != nil {
		if errors.Is(err, sitesync.ErrUnauthorized) {
			return nil, fmt.Errorf("%s: %w; check the credentials in Settings > Custom", name, err)
		}
		return nil, err
	}
	for _, scene := range unresolved {
		if code, ok := res.Codes[scene.ID]; ok {
			work = append(work, &siteSyncWorkCustom{scene: pending[scene.ID], code: code, newCode: true})
		}
	}
	for _, scene := range unresolved {
		if codes, ok := res.Ambiguous[scene.ID]; ok {
			logger.Warnf("[site sync] %s: %s could be codes %s; set its code by hand", name, scene.Basename, strings.Join(codes, ", "))
			t.report.issue(pending[scene.ID], "", fmt.Sprintf("Could be codes %s; set the code by hand", strings.Join(codes, ", ")))
		}
		if codes, ok := res.Taken[scene.ID]; ok {
			logger.Infof("[site sync] %s: %s matches code %s, which another scene already has", name, scene.Basename, strings.Join(codes, ", "))
			for _, code := range codes {
				t.report.issue(pending[scene.ID], "", fmt.Sprintf("Matches code %s, already on %s", code, holders[code]))
			}
		}
	}
	for _, id := range res.Unmatched {
		logger.Debugf("[site sync] %s: %s is not in the members index", name, pending[id].Basename)
		t.report.issue(pending[id], "", "Not in the members index or the folders after it; set the code by hand")
	}
	logger.Infof("[site sync] %s: matched %d scenes to codes, %d ambiguous, %d matching codes already in use, %d not in the members index",
		name, len(res.Codes), len(res.Ambiguous), len(res.Taken), len(res.Unmatched))

	slices.SortFunc(work, func(a, b *siteSyncWorkCustom) int { return a.scene.ID - b.scene.ID })
	return work, nil
}

// siteSyncScenePartialCustom fills only empty fields, so values set by hand
// are never replaced, and adds URLs the scene lacks. It returns the fields it
// fills.
func siteSyncScenePartialCustom(w *siteSyncWorkCustom, md sitesync.Metadata) (models.ScenePartial, []string) {
	partial := models.NewScenePartial()
	var filled []string
	if w.newCode {
		partial.Code = models.NewOptionalString(w.code)
		filled = append(filled, "code")
	}
	if w.scene.Title == "" && md.Title != "" {
		partial.Title = models.NewOptionalString(md.Title)
		filled = append(filled, "title")
	}
	if w.scene.Date == "" && md.Date != "" {
		if d, err := models.ParseDate(md.Date); err == nil {
			partial.Date = models.NewOptionalDate(d)
			filled = append(filled, "date")
		}
	}
	if w.scene.Details == "" && md.Details != "" {
		partial.Details = models.NewOptionalString(md.Details)
		filled = append(filled, "details")
	}
	var urls []string
	for _, u := range md.URLs {
		if !slices.Contains(w.scene.URLs, u) {
			urls = append(urls, u)
		}
	}
	if len(urls) > 0 {
		partial.URLs = &models.UpdateStrings{Values: urls, Mode: models.RelationshipUpdateModeAdd}
		filled = append(filled, "urls")
	}
	return partial, filled
}

// createGalleries builds a gallery for every coded scene without one whose
// pictures folder holds scanned images. Scenes without pictures get none, so
// a later run can still find them.
func (t *studioSiteSyncTaskCustom) createGalleries(ctx context.Context, progress siteSyncProgressCustom) error {
	if !t.steps.Galleries {
		return nil
	}
	name := t.site.Name()
	scenes, err := t.data.Scenes(ctx, t.studioID)
	if err != nil {
		return err
	}
	var todo []models.SiteSyncSceneCustom
	for _, scene := range scenes {
		if !scene.Postponed && !scene.HasGallery && scene.Code != "" && !t.blocked[scene.ID] {
			todo = append(todo, scene)
		}
	}
	progress.SetTotal(len(todo))
	progress.SetProcessed(0)

	created, empty := 0, 0
	for _, scene := range todo {
		if job.IsCancelled(ctx) {
			return nil
		}
		ids, err := t.picsImageIDs(ctx, scene.Code)
		if err != nil {
			return err
		}
		if len(ids) == 0 {
			empty++
			progress.Increment()
			continue
		}

		gallery := models.NewGallery()
		gallery.Title = scene.Title
		if gallery.Title == "" {
			gallery.Title = strings.TrimSuffix(scene.Basename, filepath.Ext(scene.Basename))
		}
		gallery.Code = scene.Code
		gallery.Details = scene.Details
		if d, err := models.ParseDate(scene.Date); scene.Date != "" && err == nil {
			gallery.Date = &d
		}
		studioID := t.studioID
		gallery.StudioID = &studioID
		gallery.URLs = models.NewRelatedStrings(scene.URLs)
		gallery.SceneIDs = models.NewRelatedIDs([]int{scene.ID})
		if err := t.data.CreateGallery(ctx, &gallery, ids); err != nil {
			return err
		}
		t.report.note(scene, func(c *models.StudioSiteSyncSceneChange) { c.GalleryID = &gallery.ID })
		created++
		progress.Increment()
	}
	logger.Infof("[site sync] %s: created %d galleries; %d coded scenes have no scanned pictures yet", name, created, empty)
	return nil
}

// picsDirs lists the folders holding code's pictures: its download folder,
// or every hand-added folder named with it.
func (t *studioSiteSyncTaskCustom) picsDirs(code string) ([]string, error) {
	switch site := t.site.(type) {
	case sitesync.PicsSite:
		return []string{sitesync.PicsDir(site, t.picsPath, code)}, nil
	case sitesync.FolderCoder:
		if t.folders == nil {
			folders, err := sitesync.FoldersByCode(site, t.picsPath)
			if err != nil {
				return nil, fmt.Errorf("reading the %s pictures folder: %w", t.site.Name(), err)
			}
			t.folders = folders
		}
		return t.folders[code], nil
	}
	return nil, nil
}

// picsImageIDs lists the scanned images in code's picture folders, each once.
func (t *studioSiteSyncTaskCustom) picsImageIDs(ctx context.Context, code string) ([]int, error) {
	dirs, err := t.picsDirs(code)
	if err != nil {
		return nil, err
	}
	var ret []int
	seen := map[int]bool{}
	for _, dir := range dirs {
		ids, err := t.data.FolderImageIDs(ctx, dir)
		if err != nil {
			return nil, err
		}
		for _, id := range ids {
			if !seen[id] {
				seen[id] = true
				ret = append(ret, id)
			}
		}
	}
	return ret, nil
}

func (t *studioSiteSyncTaskCustom) updateCover(ctx context.Context, sceneID int, coverURL string) error {
	image, err := t.site.Client().Body(ctx, coverURL, false)
	if err != nil {
		return err
	}
	return t.data.UpdateCover(ctx, sceneID, image)
}

// siteSyncSceneLabelCustom names a scene in the report: its title, or its
// file name when it has none.
func siteSyncSceneLabelCustom(s models.SiteSyncSceneCustom) string {
	return cmp.Or(s.Title, s.Basename)
}

func siteSyncSceneCustom(s models.SiteSyncSceneCustom) sitesync.Scene {
	return sitesync.Scene{ID: s.ID, Basename: s.Basename, Size: s.Size, URLs: s.URLs}
}

type repoSiteSyncDataCustom struct {
	repo  models.Repository
	store sqlite.StudioSiteSyncStoreCustom
	// Folder IDs of scanned pictures paths; a miss is not kept because the
	// queued scan may add the folder.
	roots map[string]int
}

func (d *repoSiteSyncDataCustom) Scenes(ctx context.Context, studioID int) (ret []models.SiteSyncSceneCustom, err error) {
	err = d.repo.WithReadTxn(ctx, func(ctx context.Context) error {
		ret, err = d.store.Scenes(ctx, studioID)
		return err
	})
	return ret, err
}

func (d *repoSiteSyncDataCustom) UpdateScene(ctx context.Context, sceneID int, partial models.ScenePartial) error {
	return d.repo.WithTxn(ctx, func(ctx context.Context) error {
		_, err := d.repo.Scene.UpdatePartial(ctx, sceneID, partial)
		return err
	})
}

func (d *repoSiteSyncDataCustom) UpdateCover(ctx context.Context, sceneID int, image []byte) error {
	return d.repo.WithTxn(ctx, func(ctx context.Context) error {
		return d.repo.Scene.UpdateCover(ctx, sceneID, image)
	})
}

func (d *repoSiteSyncDataCustom) FolderImageIDs(ctx context.Context, dir string) (ids []int, err error) {
	parent := filepath.Dir(dir)
	err = d.repo.WithReadTxn(ctx, func(ctx context.Context) error {
		parentID, found := d.roots[parent]
		if !found {
			var err error
			if parentID, found, err = d.store.FolderID(ctx, parent); err != nil || !found {
				return err
			}
			if d.roots == nil {
				d.roots = map[string]int{}
			}
			d.roots[parent] = parentID
		}
		ids, err = d.store.ChildFolderImageIDs(ctx, parentID, filepath.Base(dir))
		return err
	})
	return ids, err
}

func (d *repoSiteSyncDataCustom) CreateGallery(ctx context.Context, gallery *models.Gallery, imageIDs []int) error {
	return d.repo.WithTxn(ctx, func(ctx context.Context) error {
		if err := d.repo.Gallery.Create(ctx, &models.CreateGalleryInput{Gallery: gallery}); err != nil {
			return err
		}
		if err := d.repo.Gallery.AddImages(ctx, gallery.ID, imageIDs...); err != nil {
			return err
		}
		return d.store.SetImagesStudio(ctx, imageIDs, *gallery.StudioID)
	})
}
