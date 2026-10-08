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

// StudioSiteSyncCustom queues the site sync for a studio and returns the job ID.
func (s *Manager) StudioSiteSyncCustom(ctx context.Context, studioID int) (int, error) {
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
	if cfg.PicsPath == "" {
		return 0, fmt.Errorf("set the %s pictures folder in Settings > Custom first", studio.Name)
	}

	task := &studioSiteSyncTaskCustom{
		data:     &repoSiteSyncDataCustom{repo: s.Repository},
		site:     sitesync.New(key, sitesync.NewClient(cfg.Username, cfg.Password, siteSyncRequestDelayCustom)),
		studioID: studioID,
		picsPath: filepath.Clean(cfg.PicsPath),
	}
	name := task.site.Name()
	galleries := job.MakeJobExec(func(ctx context.Context, progress *job.Progress) error {
		return task.createGalleries(ctx, progress)
	})
	sync := job.MakeJobExec(func(ctx context.Context, progress *job.Progress) error {
		scanPaths, err := task.syncScenes(ctx, progress)
		if err != nil || job.IsCancelled(ctx) {
			return err
		}
		if len(scanPaths) == 0 {
			return task.createGalleries(ctx, progress)
		}
		// Jobs run one at a time, so the galleries job starts after the scan.
		logger.Infof("[site sync] %s: scanning %d picture folders before creating galleries", name, len(scanPaths))
		input := ScanMetadataInput{Paths: scanPaths}
		if defaults := config.GetInstance().GetDefaultScanSettings(); defaults != nil {
			input.ScanMetadataOptions = *defaults
		}
		if _, err := s.Scan(ctx, input); err != nil {
			return err
		}
		s.JobManager.Add(ctx, fmt.Sprintf("Creating %s galleries...", name), galleries)
		return nil
	})
	return s.JobManager.Add(ctx, fmt.Sprintf("Syncing %s from its site...", name), sync), nil
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
	// Code -> hand-added pictures folders, read once per run.
	folders map[string][]string
}

type siteSyncWorkCustom struct {
	scene   models.SiteSyncSceneCustom
	code    string
	newCode bool
}

// syncScenes fills codes and metadata and downloads missing pictures. It
// returns the picture folders Stash still has to scan.
func (t *studioSiteSyncTaskCustom) syncScenes(ctx context.Context, progress siteSyncProgressCustom) ([]string, error) {
	name := t.site.Name()
	scenes, err := t.data.Scenes(ctx, t.studioID)
	if err != nil {
		return nil, err
	}
	work, err := t.resolveCodes(ctx, scenes)
	if err != nil {
		return nil, err
	}

	var scrape, download []*siteSyncWorkCustom
	for _, w := range work {
		if w.newCode || w.scene.Title == "" || w.scene.Date == "" {
			scrape = append(scrape, w)
		}
		if !w.scene.HasGallery {
			download = append(download, w)
		}
	}
	progress.SetTotal(len(scrape) + len(download))
	progress.SetProcessed(0)

	updated, notOnSite, failed := 0, 0, 0
	for _, w := range scrape {
		if job.IsCancelled(ctx) {
			return nil, nil
		}
		md, err := t.site.Scrape(ctx, w.code, siteSyncSceneCustom(w.scene))
		switch {
		case errors.Is(err, sitesync.ErrUnauthorized):
			return nil, fmt.Errorf("%s: %w; check the credentials in Settings > Custom", name, err)
		case errors.Is(err, sitesync.ErrNotFound):
			notOnSite++
			logger.Infof("[site sync] %s: %s (code %s) is not on the site", name, w.scene.Basename, w.code)
		case err != nil:
			failed++
			logger.Warnf("[site sync] %s: reading %s (code %s): %v", name, w.scene.Basename, w.code, err)
		}
		// The site's image replaces the generated cover when the scene is
		// filled for the first time. It goes first so the scene update below
		// refreshes the cover's cache key.
		if md.Cover != "" && w.scene.Title == "" {
			if err := t.updateCover(ctx, w.scene.ID, md.Cover); err != nil {
				failed++
				logger.Warnf("[site sync] %s: setting the cover of %s (code %s): %v", name, w.scene.Basename, w.code, err)
			}
		}
		if partial, changed := siteSyncScenePartialCustom(w, md); changed {
			if err := t.data.UpdateScene(ctx, w.scene.ID, partial); err != nil {
				return nil, err
			}
			updated++
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
		dirs, err := t.picsDirs(w.code)
		if err != nil {
			return nil, err
		}
		created := false
		if downloads {
			created, err = sitesync.DownloadPics(ctx, picsSite, t.picsPath, w.code)
		} else if len(dirs) == 0 {
			err = sitesync.ErrNotFound
		}
		switch {
		case err == nil && created:
			downloaded++
			scanPaths = append(scanPaths, dirs...)
		case err == nil:
			// Downloaded or added before, but never scanned or scanned while
			// still empty.
			for _, dir := range dirs {
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
		default:
			failed++
			logger.Warnf("[site sync] %s: downloading pictures for code %s: %v", name, w.code, err)
		}
		progress.Increment()
	}

	logger.Infof("[site sync] %s: %d scenes updated, %d not on the site, %d picture folders downloaded, %d codes without pictures, %d failures",
		name, updated, notOnSite, downloaded, noPictures, failed)
	if downloads && t.site.Client().MembersUnavailable() {
		logger.Warnf("[site sync] %s: the members area refused the credentials or has none set, so members-only dates were skipped and %d codes still need pictures",
			name, membersClosed)
	}
	return scanPaths, nil
}

// resolveCodes picks each unpostponed scene's code: the stored one, one read
// from the file name or URLs, or for sites that need it a match against the
// site's own video links.
func (t *studioSiteSyncTaskCustom) resolveCodes(ctx context.Context, scenes []models.SiteSyncSceneCustom) ([]*siteSyncWorkCustom, error) {
	name := t.site.Name()
	taken := map[string]bool{}
	var work []*siteSyncWorkCustom
	var unresolved []sitesync.Scene
	pending := map[int]models.SiteSyncSceneCustom{}
	for _, scene := range scenes {
		if scene.Postponed {
			continue
		}
		code, newCode := scene.Code, false
		if code == "" {
			code = t.site.SceneCode(siteSyncSceneCustom(scene))
			newCode = code != ""
		}
		if code == "" {
			unresolved = append(unresolved, siteSyncSceneCustom(scene))
			pending[scene.ID] = scene
			continue
		}
		taken[code] = true
		work = append(work, &siteSyncWorkCustom{scene: scene, code: code, newCode: newCode})
	}
	// Postponed scenes still hold their codes, stored or in the file name.
	for _, scene := range scenes {
		if !scene.Postponed {
			continue
		}
		if code := cmp.Or(scene.Code, t.site.SceneCode(siteSyncSceneCustom(scene))); code != "" {
			taken[code] = true
		}
	}

	resolver, ok := t.site.(sitesync.CodeResolver)
	if !ok || len(unresolved) == 0 {
		return work, nil
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
		}
		if codes, ok := res.Taken[scene.ID]; ok {
			logger.Infof("[site sync] %s: %s matches code %s, which another scene already has", name, scene.Basename, strings.Join(codes, ", "))
		}
	}
	for _, id := range res.Unmatched {
		logger.Debugf("[site sync] %s: %s is not in the members index", name, pending[id].Basename)
	}
	logger.Infof("[site sync] %s: matched %d scenes to codes, %d ambiguous, %d matching codes already in use, %d not in the members index",
		name, len(res.Codes), len(res.Ambiguous), len(res.Taken), len(res.Unmatched))

	slices.SortFunc(work, func(a, b *siteSyncWorkCustom) int { return a.scene.ID - b.scene.ID })
	return work, nil
}

// siteSyncScenePartialCustom fills only empty fields, so values set by hand
// are never replaced, and adds URLs the scene lacks.
func siteSyncScenePartialCustom(w *siteSyncWorkCustom, md sitesync.Metadata) (models.ScenePartial, bool) {
	partial := models.NewScenePartial()
	changed := false
	if w.newCode {
		partial.Code = models.NewOptionalString(w.code)
		changed = true
	}
	if w.scene.Title == "" && md.Title != "" {
		partial.Title = models.NewOptionalString(md.Title)
		changed = true
	}
	if w.scene.Date == "" && md.Date != "" {
		if d, err := models.ParseDate(md.Date); err == nil {
			partial.Date = models.NewOptionalDate(d)
			changed = true
		}
	}
	if w.scene.Details == "" && md.Details != "" {
		partial.Details = models.NewOptionalString(md.Details)
		changed = true
	}
	var urls []string
	for _, u := range md.URLs {
		if !slices.Contains(w.scene.URLs, u) {
			urls = append(urls, u)
		}
	}
	if len(urls) > 0 {
		partial.URLs = &models.UpdateStrings{Values: urls, Mode: models.RelationshipUpdateModeAdd}
		changed = true
	}
	return partial, changed
}

// createGalleries builds a gallery for every coded scene without one whose
// pictures folder holds scanned images. Scenes without pictures get none, so
// a later run can still find them.
func (t *studioSiteSyncTaskCustom) createGalleries(ctx context.Context, progress siteSyncProgressCustom) error {
	name := t.site.Name()
	scenes, err := t.data.Scenes(ctx, t.studioID)
	if err != nil {
		return err
	}
	var todo []models.SiteSyncSceneCustom
	for _, scene := range scenes {
		if !scene.Postponed && !scene.HasGallery && scene.Code != "" {
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
