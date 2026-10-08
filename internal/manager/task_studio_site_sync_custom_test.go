package manager

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/sitesync"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeSiteSyncDataCustom struct {
	scenes    []models.SiteSyncSceneCustom
	updates   map[int]models.ScenePartial
	covers    map[int]string
	folders   map[string][]int // scanned folders -> image IDs
	galleries []models.Gallery
	images    map[int][]int // gallery index -> image IDs
}

func (f *fakeSiteSyncDataCustom) Scenes(ctx context.Context, studioID int) ([]models.SiteSyncSceneCustom, error) {
	return f.scenes, nil
}

func (f *fakeSiteSyncDataCustom) UpdateScene(ctx context.Context, sceneID int, partial models.ScenePartial) error {
	f.updates[sceneID] = partial
	return nil
}

func (f *fakeSiteSyncDataCustom) UpdateCover(ctx context.Context, sceneID int, image []byte) error {
	f.covers[sceneID] = string(image)
	return nil
}

func (f *fakeSiteSyncDataCustom) FolderImageIDs(ctx context.Context, dir string) ([]int, error) {
	return f.folders[dir], nil
}

func (f *fakeSiteSyncDataCustom) CreateGallery(ctx context.Context, gallery *models.Gallery, imageIDs []int) error {
	f.images[len(f.galleries)] = imageIDs
	f.galleries = append(f.galleries, *gallery)
	return nil
}

// fakeSiteCustom reads codes from "<code>-high" names and resolves the rest
// from a fixed table.
type fakeSiteCustom struct {
	pages     map[string]sitesync.Metadata
	scrapeErr error
	picsErr   error
	resolved  sitesync.Resolution
	scraped   []string
	taken     map[string]bool
}

func fakeSceneCodeCustom(s sitesync.Scene) string {
	if n := len(s.Basename); n > 9 && s.Basename[n-9:] == "-high.mp4" {
		return s.Basename[:n-9]
	}
	return ""
}

func (f *fakeSiteCustom) Name() string                      { return "Fake" }
func (f *fakeSiteCustom) SceneCode(s sitesync.Scene) string { return fakeSceneCodeCustom(s) }
func (f *fakeSiteCustom) Scrape(ctx context.Context, code string, s sitesync.Scene) (sitesync.Metadata, error) {
	f.scraped = append(f.scraped, code)
	if f.scrapeErr != nil {
		return sitesync.Metadata{}, f.scrapeErr
	}
	md, ok := f.pages[code]
	if !ok {
		return md, sitesync.ErrNotFound
	}
	return md, nil
}
func (f *fakeSiteCustom) PicsFolder(code string) string { return "pics" + code }
func (f *fakeSiteCustom) Pics(ctx context.Context, code string) (string, []string, error) {
	return "", nil, f.picsErr
}
func (f *fakeSiteCustom) Client() *sitesync.Client { return sitesync.NewClient("", "", 0) }
func (f *fakeSiteCustom) ResolveCodes(ctx context.Context, scenes []sitesync.Scene, taken map[string]bool) (sitesync.Resolution, error) {
	f.taken = taken
	return f.resolved, nil
}

// fakeFolderSiteCustom has no downloads; its pictures folders are added by
// hand and end in "-<code>".
type fakeFolderSiteCustom struct {
	pages map[string]sitesync.Metadata
}

func (f *fakeFolderSiteCustom) Name() string                      { return "Folders" }
func (f *fakeFolderSiteCustom) SceneCode(s sitesync.Scene) string { return fakeSceneCodeCustom(s) }
func (f *fakeFolderSiteCustom) Scrape(ctx context.Context, code string, s sitesync.Scene) (sitesync.Metadata, error) {
	md, ok := f.pages[code]
	if !ok {
		return md, sitesync.ErrNotFound
	}
	return md, nil
}
func (f *fakeFolderSiteCustom) Client() *sitesync.Client { return sitesync.NewClient("", "", 0) }
func (f *fakeFolderSiteCustom) FolderCode(name string) string {
	return name[strings.LastIndex(name, "-")+1:]
}

type fakeSiteSyncProgressCustom struct{ total, processed int }

func (p *fakeSiteSyncProgressCustom) SetTotal(total int)         { p.total = total }
func (p *fakeSiteSyncProgressCustom) SetProcessed(processed int) { p.processed = processed }
func (p *fakeSiteSyncProgressCustom) Increment()                 { p.processed++ }

func newSiteSyncTaskCustom(t *testing.T, data *fakeSiteSyncDataCustom, site sitesync.Site) *studioSiteSyncTaskCustom {
	t.Helper()
	data.updates = map[int]models.ScenePartial{}
	data.covers = map[int]string{}
	data.images = map[int][]int{}
	if data.folders == nil {
		data.folders = map[string][]int{}
	}
	return &studioSiteSyncTaskCustom{data: data, site: site, studioID: 18, picsPath: t.TempDir()}
}

func TestStudioSiteSyncFillsScenesCustom(t *testing.T) {
	data := &fakeSiteSyncDataCustom{scenes: []models.SiteSyncSceneCustom{
		{ID: 1, Basename: "1836-high.mp4"},
		{ID: 2, Basename: "1837-high.mp4", Title: "Typed by hand", URLs: []string{"https://site/1837"}},
		{ID: 3, Basename: "1838-high.mp4", Postponed: true},
		{ID: 4, Basename: "old.mp4", Code: "10", Title: "Done", Date: "2020-01-01", HasGallery: true},
		{ID: 5, Basename: "compa.mp4"},
		{ID: 6, Basename: "mystery.mp4"},
		{ID: 7, Basename: "parked.mp4", Code: "50", Postponed: true},
	}}
	site := &fakeSiteCustom{
		pages: map[string]sitesync.Metadata{
			"1836": {Title: "Cut & Gaze", Date: "2026-07-10", URLs: []string{"https://site/1836"}},
			"1837": {Title: "Site title", Details: "From the site", URLs: []string{"https://site/1837", "https://site/members/1837"}},
		},
		picsErr: sitesync.ErrNotFound,
		resolved: sitesync.Resolution{
			Codes:     map[int]string{5: "980"},
			Ambiguous: map[int][]string{6: {"960", "961"}},
		},
	}
	task := newSiteSyncTaskCustom(t, data, site)

	// 1836 was downloaded before but never scanned, 1837 was scanned while
	// still empty, and 980 is scanned.
	for _, folder := range []string{"pics1836", "pics1837", "pics980"} {
		dir := filepath.Join(task.picsPath, folder)
		require.NoError(t, os.Mkdir(dir, 0o755))
		require.NoError(t, os.WriteFile(filepath.Join(dir, folder+"a.jpg"), []byte("jpeg"), 0o644))
	}
	data.folders[filepath.Join(task.picsPath, "pics1837")] = []int{}
	data.folders[filepath.Join(task.picsPath, "pics980")] = []int{1}

	progress := &fakeSiteSyncProgressCustom{}
	scanPaths, err := task.syncScenes(context.Background(), progress)
	require.NoError(t, err)

	assert.Equal(t, []string{"1836", "1837", "980"}, site.scraped, "complete and postponed scenes are not requested")
	assert.Equal(t, map[string]bool{"1836": true, "1837": true, "1838": true, "10": true, "50": true}, site.taken,
		"codes in use, postponed ones included, are never offered to other scenes")

	one := data.updates[1]
	assert.Equal(t, models.NewOptionalString("1836"), one.Code)
	assert.Equal(t, models.NewOptionalString("Cut & Gaze"), one.Title)
	assert.Equal(t, "2026-07-10", one.Date.Value.String())
	assert.Equal(t, []string{"https://site/1836"}, one.URLs.Values)

	two := data.updates[2]
	assert.False(t, two.Title.Set, "a title typed by hand is kept")
	assert.Equal(t, models.NewOptionalString("From the site"), two.Details)
	assert.Equal(t, []string{"https://site/members/1837"}, two.URLs.Values, "existing URLs are not added twice")

	five := data.updates[5]
	assert.Equal(t, models.NewOptionalString("980"), five.Code, "a resolved code is saved even when the site has no page")
	assert.NotContains(t, data.updates, 3)
	assert.NotContains(t, data.updates, 4)
	assert.NotContains(t, data.updates, 6)

	assert.Equal(t, []string{filepath.Join(task.picsPath, "pics1836"), filepath.Join(task.picsPath, "pics1837")}, scanPaths)
	assert.Equal(t, progress.total, progress.processed)
}

func TestStudioSiteSyncFailsOnRefusedCredentialsCustom(t *testing.T) {
	data := &fakeSiteSyncDataCustom{scenes: []models.SiteSyncSceneCustom{{ID: 1, Basename: "1836-high.mp4"}}}
	site := &fakeSiteCustom{scrapeErr: sitesync.ErrUnauthorized}
	task := newSiteSyncTaskCustom(t, data, site)

	_, err := task.syncScenes(context.Background(), &fakeSiteSyncProgressCustom{})
	assert.ErrorIs(t, err, sitesync.ErrUnauthorized)
	assert.Empty(t, data.updates)
}

func TestStudioSiteSyncCreatesGalleriesWithPicturesCustom(t *testing.T) {
	data := &fakeSiteSyncDataCustom{scenes: []models.SiteSyncSceneCustom{
		{ID: 1, Basename: "1836-high.mp4", Code: "1836", Title: "Cut & Gaze", Date: "2026-07-10", Details: "Hot", URLs: []string{"https://site/1836"}},
		{ID: 2, Basename: "varela y chido.mp4", Code: "976"},
		{ID: 3, Basename: "nopics.mp4", Code: "977"},
		{ID: 4, Basename: "done.mp4", Code: "978", HasGallery: true},
		{ID: 5, Basename: "parked.mp4", Code: "979", Postponed: true},
	}}
	task := newSiteSyncTaskCustom(t, data, &fakeSiteCustom{})
	for code, ids := range map[string][]int{"1836": {11, 12}, "976": {21}, "978": {31}, "979": {41}} {
		data.folders[filepath.Join(task.picsPath, "pics"+code)] = ids
	}
	data.folders[filepath.Join(task.picsPath, "pics977")] = nil

	require.NoError(t, task.createGalleries(context.Background(), &fakeSiteSyncProgressCustom{}))
	require.Len(t, data.galleries, 2, "scenes without pictures, with a gallery, or postponed get none")

	first := data.galleries[0]
	assert.Equal(t, "Cut & Gaze", first.Title)
	assert.Equal(t, "1836", first.Code)
	assert.Equal(t, "Hot", first.Details)
	assert.Equal(t, "2026-07-10", first.Date.String())
	assert.Equal(t, 18, *first.StudioID)
	assert.Equal(t, []string{"https://site/1836"}, first.URLs.List())
	assert.Equal(t, []int{1}, first.SceneIDs.List())
	assert.Equal(t, []int{11, 12}, data.images[0])

	second := data.galleries[1]
	assert.Equal(t, "varela y chido", second.Title, "untitled scenes fall back to the file name")
	assert.Nil(t, second.Date)
	assert.Equal(t, []int{21}, data.images[1])
}

// Sites without downloads use the folders added by hand, scanning those Stash
// has not read, and take the site's cover on a scene's first fill.
func TestStudioSiteSyncHandAddedFoldersCustom(t *testing.T) {
	covers := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("jpeg"))
	}))
	defer covers.Close()

	data := &fakeSiteSyncDataCustom{scenes: []models.SiteSyncSceneCustom{
		{ID: 1, Basename: "2224-high.mp4"},
		{ID: 2, Basename: "gato.mp4", Code: "2196", Title: "Gato", Date: "2025-03-01"},
		{ID: 3, Basename: "2250-high.mp4", Title: "Typed by hand"},
		{ID: 4, Basename: "2300-high.mp4"},
	}}
	site := &fakeFolderSiteCustom{pages: map[string]sitesync.Metadata{
		"2224": {Title: "Brian", Date: "2025-04-24", Cover: covers.URL + "/brian.jpg"},
		"2250": {Title: "Diego", Date: "2025-04-08", Cover: covers.URL + "/diego.jpg"},
		"2300": {Title: "Ivan", Cover: covers.URL + "/ivan.jpg"},
	}}
	task := newSiteSyncTaskCustom(t, data, site)
	dir := func(name string) string { return filepath.Join(task.picsPath, name) }
	for _, name := range []string{"brian-2224", "gato-2196", "gato-copy-2196", "jako"} {
		require.NoError(t, os.Mkdir(dir(name), 0o755))
	}
	data.folders[dir("gato-2196")] = []int{5, 6}
	data.folders[dir("gato-copy-2196")] = []int{6, 7}

	progress := &fakeSiteSyncProgressCustom{}
	scanPaths, err := task.syncScenes(context.Background(), progress)
	require.NoError(t, err)
	assert.Equal(t, []string{dir("brian-2224")}, scanPaths, "only folders Stash has not read are scanned")
	assert.Equal(t, map[int]string{1: "jpeg", 4: "jpeg"}, data.covers, "a cover is set only when the title is filled too")
	assert.Equal(t, progress.total, progress.processed)

	// The scan read Brian's folder and the sync saved his code.
	data.folders[dir("brian-2224")] = []int{1}
	data.scenes[0].Code = "2224"
	require.NoError(t, task.createGalleries(context.Background(), &fakeSiteSyncProgressCustom{}))
	require.Len(t, data.galleries, 2)
	assert.Equal(t, []int{1}, data.images[0])
	assert.Equal(t, []int{5, 6, 7}, data.images[1], "copies of a folder add their images once")
}

func TestStudioSiteSyncConfigCustom(t *testing.T) {
	ui := map[string]interface{}{
		siteSyncConfigKeyCustom: map[string]interface{}{
			"nakedpapis": map[string]interface{}{"username": " user ", "password": "pass", "picsPath": `D:\Pics`},
		},
	}
	assert.Equal(t, sitesync.Config{Username: "user", Password: "pass", PicsPath: `D:\Pics`}, studioSiteSyncConfigCustom(ui, "nakedpapis"))
	assert.Equal(t, sitesync.Config{}, studioSiteSyncConfigCustom(ui, "bilatinmen"))
	assert.Equal(t, sitesync.Config{}, studioSiteSyncConfigCustom(nil, "nakedpapis"))
}
