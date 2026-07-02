package gevi

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestParseScenesUsesEpisodeCards(t *testing.T) {
	now := time.Date(2026, 6, 30, 12, 0, 0, 0, time.UTC)
	client := NewClient("")

	items, err := client.ParseScenes(`
<div class="flex flex-grow flex-col items-center pb-2 md:w-52">
  <div class="flex flex-col items-center pb-2 md:w-52">
    <div>Himeros</div>
    <a href='episode/205337'><img src='images/Episodes/episode205337.jpg' alt /></a>
  </div>
  <div><a href='episode/205337'>The Examination</a></div>
  <div class="line-clamp-3"><span class="whitespace-nowrap">Vato One</span>, <span class="whitespace-nowrap">Vato Two</span></div>
</div>`, now)

	require.NoError(t, err)
	require.Len(t, items, 1)
	require.Equal(t, ItemKindScene, items[0].Kind)
	require.Equal(t, "205337", items[0].ID)
	require.Equal(t, "The Examination", items[0].Title)
	require.Equal(t, "Himeros", items[0].Studio)
	require.Equal(t, "https://gayeroticvideoindex.com/episode/205337", items[0].URL)
	require.Equal(t, "https://gayeroticvideoindex.com/images/Episodes/episode205337.jpg", items[0].ThumbURL)
	require.Equal(t, []string{"Vato One", "Vato Two"}, items[0].Performers)
	require.Equal(t, now, items[0].FirstSeenAt)
}

func TestParsePerformersUsesMainPageImage(t *testing.T) {
	now := time.Date(2026, 6, 30, 12, 0, 0, 0, time.UTC)
	client := NewClient("")

	items, err := client.ParsePerformers(`
<div class="flex w-52 flex-grow flex-col">
  <a href="https://example.com/profile" target="_blank">@ Only Fans</a>
  <div class="mx-auto"><img src="revenue/performer44404.jpg"></div>
  <a href='performer/148812'><span class='whitespace-nowrap'>Vitor Augusto</span></a>
</div>`, now)

	require.NoError(t, err)
	require.Len(t, items, 1)
	require.Equal(t, ItemKindPerformer, items[0].Kind)
	require.Equal(t, "148812", items[0].ID)
	require.Equal(t, "Vitor Augusto", items[0].Title)
	require.Equal(t, "Only Fans", items[0].SourceLabel)
	require.Equal(t, "https://gayeroticvideoindex.com/revenue/performer44404.jpg", items[0].ImageURL)
}

func TestParseSceneDetailUsesLargeScreenshotAndDate(t *testing.T) {
	client := NewClient("")

	item := client.ParseSceneDetail("205337", `
<div><span class="text-yellow-300">Date:</span> 2026-06-29</div>
<div class="flex w-full">
  <img src='images/Episodes/episode205337b.jpg' alt class='hidden md:block' />
  <img src='images/Episodes/episode205337.jpg' alt class='md:hidden mx-auto' />
</div>`)

	require.Equal(t, "2026-06-29", item.Date)
	require.Equal(t, "https://gayeroticvideoindex.com/images/Episodes/episode205337b.jpg", item.ImageURL)
}

func TestMergePreservesFirstSeenAndPruneDropsOldItems(t *testing.T) {
	now := time.Date(2026, 6, 30, 0, 0, 0, 0, time.UTC)
	oldFirstSeen := now.AddDate(-1, 0, 0)
	client := NewClient("")

	existing := &Cache{
		Scenes: []Item{
			{Kind: ItemKindScene, ID: "1", Title: "Existing", FirstSeenAt: oldFirstSeen, LastSeenAt: oldFirstSeen},
			{Kind: ItemKindScene, ID: "2", Title: "Expired", Date: "2024-06-29", FirstSeenAt: oldFirstSeen, LastSeenAt: oldFirstSeen},
		},
		Performers: []Item{
			{Kind: ItemKindPerformer, ID: "10", Title: "Expired Vato", FirstSeenAt: now.AddDate(-3, 0, 0), LastSeenAt: now.AddDate(-3, 0, 0)},
		},
	}
	fetched := &Cache{
		UpdatedAt: now,
		Scenes: []Item{
			{Kind: ItemKindScene, ID: "1", Title: "Updated", FirstSeenAt: now, LastSeenAt: now},
		},
		Performers: []Item{
			{Kind: ItemKindPerformer, ID: "11", Title: "New Vato", FirstSeenAt: now, LastSeenAt: now},
		},
	}

	merged := mergeCaches(existing, fetched, now)
	client.prune(merged, now)

	require.Len(t, merged.Scenes, 1)
	require.Equal(t, "Updated", merged.Scenes[0].Title)
	require.Equal(t, oldFirstSeen, merged.Scenes[0].FirstSeenAt)
	require.Equal(t, now, merged.Scenes[0].LastSeenAt)
	require.Len(t, merged.Performers, 1)
	require.Equal(t, "11", merged.Performers[0].ID)
}

func TestEnsureLocalImagesDownloadsAndCleanupRemovesUnreferencedFiles(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/jpeg")
		_, _ = w.Write([]byte("fake image"))
	}))
	defer server.Close()

	tempDir := t.TempDir()
	client := NewClient(filepath.Join(tempDir, DefaultCacheFileName))
	client.HTTPClient = server.Client()
	client.ImageDir = filepath.Join(tempDir, DefaultImageDirName)

	cache := &Cache{
		Scenes: []Item{
			{
				Kind:     ItemKindScene,
				ID:       "205337",
				Title:    "The Examination",
				ImageURL: server.URL + "/episode205337b.jpg",
			},
		},
	}

	changed, err := client.ensureLocalImages(t.Context(), cache)
	require.NoError(t, err)
	require.True(t, changed)
	require.Equal(t, "scene_205337.jpg", cache.Scenes[0].ImagePath)
	require.FileExists(t, client.LocalImagePath(cache.Scenes[0].ImagePath))

	stalePath := filepath.Join(client.ImageDir, "scene_old.jpg")
	require.NoError(t, os.WriteFile(stalePath, []byte("old"), 0644))
	require.NoError(t, client.cleanupLocalImages(cache))
	require.FileExists(t, client.LocalImagePath(cache.Scenes[0].ImagePath))
	require.NoFileExists(t, stalePath)
}
