package manager

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/sitesync"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakePublicSiteCustom struct {
	*fakeFolderSiteCustom
	scraped int
	err     error
}

func (f *fakePublicSiteCustom) HasSceneURL(s sitesync.Scene) bool { return len(s.URLs) > 0 }
func (f *fakePublicSiteCustom) Scrape(ctx context.Context, code string, s sitesync.Scene) (sitesync.Metadata, error) {
	f.scraped++
	if f.err != nil {
		return sitesync.Metadata{}, f.err
	}
	return f.fakeFolderSiteCustom.Scrape(ctx, code, s)
}

func TestStudioSiteSyncPublicMetadataWithoutPicturesCustom(t *testing.T) {
	for _, folderKind := range []string{"unset", "missing", "file"} {
		t.Run(folderKind, func(t *testing.T) {
			data := &fakeSiteSyncDataCustom{scenes: []models.SiteSyncSceneCustom{{ID: 1, Basename: "2224-high.mp4"}}}
			site := &fakePublicSiteCustom{fakeFolderSiteCustom: &fakeFolderSiteCustom{pages: map[string]sitesync.Metadata{
				"2224": {Title: "Public title", Date: "2025-04-24", Details: "Public details", URLs: []string{"https://latinboyz.com/scene/"}},
			}}}
			task := newSiteSyncTaskCustom(t, data, site)
			switch folderKind {
			case "unset":
				task.picsPath = ""
			case "missing":
				task.picsPath = filepath.Join(task.picsPath, "missing")
			case "file":
				task.picsPath = filepath.Join(task.picsPath, "not-a-folder")
				require.NoError(t, os.WriteFile(task.picsPath, []byte("x"), 0o600))
			}
			scanPaths, err := task.syncScenes(context.Background(), &fakeSiteSyncProgressCustom{})
			require.NoError(t, err)
			assert.Empty(t, scanPaths)
			assert.Equal(t, models.NewOptionalString("Public title"), data.updates[1].Title)
			assert.Len(t, task.report.snapshot().Warnings, 1)
			assert.False(t, task.steps.Galleries)
			require.NoError(t, task.createGalleries(context.Background(), &fakeSiteSyncProgressCustom{}))
			assert.Empty(t, data.galleries)
		})
	}
}

func TestStudioSiteSyncPublicURLOnlyCustom(t *testing.T) {
	for _, discoveredCode := range []string{"", "2224"} {
		t.Run("page code="+discoveredCode, func(t *testing.T) {
			data := &fakeSiteSyncDataCustom{scenes: []models.SiteSyncSceneCustom{
				{ID: 1, Basename: "renamed.mp4", URLs: []string{"https://latinboyz.com/scene/"}},
				{ID: 2, Basename: "unknown.mp4"},
				{ID: 3, Basename: "postponed.mp4", URLs: []string{"https://latinboyz.com/scene/"}, Postponed: true},
			}}
			site := &fakePublicSiteCustom{fakeFolderSiteCustom: &fakeFolderSiteCustom{pages: map[string]sitesync.Metadata{
				"": {Code: discoveredCode, Title: "Public title", Date: "2025-04-24", Details: "Public details"},
			}}}
			task := newSiteSyncTaskCustom(t, data, site)
			task.picsPath = ""
			_, err := task.syncScenes(context.Background(), &fakeSiteSyncProgressCustom{})
			require.NoError(t, err)
			assert.Equal(t, models.NewOptionalString("Public title"), data.updates[1].Title)
			assert.Equal(t, discoveredCode != "", data.updates[1].Code.Set)
			assert.Equal(t, discoveredCode, data.updates[1].Code.Value)
			assert.NotContains(t, data.updates, 2)
			assert.NotContains(t, data.updates, 3)
			assert.Contains(t, reportScenesCustom(task)[2].Issues[0], "Scenes > Edit > URLs")
			assert.Equal(t, 1, site.scraped)
		})
	}
}

func TestStudioSiteSyncPublicStepSelectionCustom(t *testing.T) {
	for _, codesOnly := range []bool{false, true} {
		t.Run(fmt.Sprint("codes only=", codesOnly), func(t *testing.T) {
			data := &fakeSiteSyncDataCustom{scenes: []models.SiteSyncSceneCustom{{ID: 1, Basename: "renamed.mp4", URLs: []string{"https://latinboyz.com/scene/"}}}}
			site := &fakePublicSiteCustom{fakeFolderSiteCustom: &fakeFolderSiteCustom{pages: map[string]sitesync.Metadata{
				"": {Code: "2224", Title: "Public title"},
			}}}
			task := newSiteSyncTaskCustom(t, data, site)
			task.steps.Galleries = false
			task.steps.Codes, task.steps.Metadata = codesOnly, !codesOnly
			_, err := task.syncScenes(context.Background(), &fakeSiteSyncProgressCustom{})
			require.NoError(t, err)
			if codesOnly {
				assert.Equal(t, models.NewOptionalString("2224"), data.updates[1].Code)
				assert.False(t, data.updates[1].Title.Set)
			} else {
				assert.Empty(t, data.updates, "match codes off still skips uncoded scenes")
				assert.Zero(t, site.scraped)
			}
		})
	}
}

func TestStudioSiteSyncPublicIncompleteAndRepeatCustom(t *testing.T) {
	data := &fakeSiteSyncDataCustom{scenes: []models.SiteSyncSceneCustom{{ID: 1, Code: "2224", Basename: "2224-high.mp4", Title: "My title", Date: "2020-01-01"}}}
	site := &fakePublicSiteCustom{fakeFolderSiteCustom: &fakeFolderSiteCustom{pages: map[string]sitesync.Metadata{
		"2224": {Title: "Site title", Date: "2025-04-24", Details: "Public details", URLs: []string{"https://latinboyz.com/scene/"}},
	}}}
	task := newSiteSyncTaskCustom(t, data, site)
	task.steps.Galleries = false
	_, err := task.syncScenes(context.Background(), &fakeSiteSyncProgressCustom{})
	require.NoError(t, err)
	assert.False(t, data.updates[1].Title.Set)
	assert.False(t, data.updates[1].Date.Set)
	assert.Equal(t, models.NewOptionalString("Public details"), data.updates[1].Details)
	assert.Equal(t, []string{"https://latinboyz.com/scene/"}, data.updates[1].URLs.Values)
	data.scenes[0].Details = "Public details"
	data.scenes[0].URLs = []string{"https://latinboyz.com/scene/"}
	data.updates = map[int]models.ScenePartial{}
	_, err = task.syncScenes(context.Background(), &fakeSiteSyncProgressCustom{})
	require.NoError(t, err)
	assert.Empty(t, data.updates)
	assert.Equal(t, 1, site.scraped, "a complete repeat run does not request the page again")
}

func TestStudioSiteSyncPublicConflictsSkipPicturesCustom(t *testing.T) {
	for _, conflict := range []error{sitesync.ErrCodeConflict, sitesync.ErrAmbiguous} {
		t.Run(conflict.Error(), func(t *testing.T) {
			data := &fakeSiteSyncDataCustom{scenes: []models.SiteSyncSceneCustom{{ID: 1, Code: "2224", Basename: "2224-high.mp4"}}}
			site := &fakePublicSiteCustom{fakeFolderSiteCustom: &fakeFolderSiteCustom{}, err: conflict}
			task := newSiteSyncTaskCustom(t, data, site)
			dir := filepath.Join(task.picsPath, "public-2224")
			require.NoError(t, os.Mkdir(dir, 0o755))
			data.folders[dir] = []int{1}
			paths, err := task.syncScenes(context.Background(), &fakeSiteSyncProgressCustom{})
			require.NoError(t, err)
			assert.Empty(t, paths)
			assert.Empty(t, data.updates)
			assert.Equal(t, []string{conflict.Error()}, reportScenesCustom(task)[1].Issues)
			require.NoError(t, task.createGalleries(context.Background(), &fakeSiteSyncProgressCustom{}))
			assert.Empty(t, data.galleries)
		})
	}
}

func TestStudioSiteSyncLatinboyzLocalGalleriesCustom(t *testing.T) {
	data := &fakeSiteSyncDataCustom{scenes: []models.SiteSyncSceneCustom{
		{ID: 1, Basename: "HD2224.mp4", Code: "2224", Title: "My title", Date: "2025-04-24"},
		{ID: 2, Basename: "renamed.mp4"},
	}}
	task := newSiteSyncTaskCustom(t, data, sitesync.New(sitesync.LatinboyzKey, sitesync.NewClient("", "", 0)))
	task.steps.Metadata = false
	for i, name := range []string{"latinboyz-model-brian-am2224", "latinboyz-model-brian-am2224 (1)"} {
		dir := filepath.Join(task.picsPath, name)
		require.NoError(t, os.Mkdir(dir, 0o755))
		require.NoError(t, os.WriteFile(filepath.Join(dir, "photo.jpg"), []byte("jpeg"), 0o600))
		data.folders[dir] = []int{1 + i, 2 + i}
	}
	paths, err := task.syncScenes(context.Background(), &fakeSiteSyncProgressCustom{})
	require.NoError(t, err)
	assert.Empty(t, paths, "already scanned photos are reused")
	require.NoError(t, task.createGalleries(context.Background(), &fakeSiteSyncProgressCustom{}))
	require.Len(t, data.galleries, 1)
	assert.Equal(t, []int{1, 2, 3}, data.images[0])
	assert.Equal(t, "2224", data.galleries[0].Code)
	assert.Equal(t, "My title", data.galleries[0].Title)
	data.scenes[0].HasGallery = true
	require.NoError(t, task.createGalleries(context.Background(), &fakeSiteSyncProgressCustom{}))
	assert.Len(t, data.galleries, 1, "repeat runs do not create another gallery")
}
