package sitesync

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/html"
)

// fakeSite answers requests from fixtures keyed by URL; anything else is a 404.
type fakeSite struct {
	pages    map[string]string // URL -> fixture file name or literal body
	statuses map[string]int
	sizes    map[string]int64
	requests []string
	authed   []bool
}

func (f *fakeSite) RoundTrip(req *http.Request) (*http.Response, error) {
	u := req.URL.String()
	f.requests = append(f.requests, req.Method+" "+u)
	_, _, hasAuth := req.BasicAuth()
	f.authed = append(f.authed, hasAuth)

	status := http.StatusOK
	if s, ok := f.statuses[u]; ok {
		status = s
	}
	body, found := f.pages[u]
	if !found && status == http.StatusOK {
		status = http.StatusNotFound
	}
	if strings.HasSuffix(body, ".html") || strings.HasSuffix(body, ".json") {
		data, err := os.ReadFile(filepath.Join("testdata", body))
		if err != nil {
			return nil, err
		}
		body = string(data)
	}
	resp := &http.Response{
		StatusCode:    status,
		Status:        http.StatusText(status),
		Body:          io.NopCloser(strings.NewReader(body)),
		ContentLength: -1,
		Request:       req,
	}
	if size, ok := f.sizes[u]; ok {
		resp.ContentLength = size
	}
	return resp, nil
}

func newFakeClient(f *fakeSite, username, password string) *Client {
	c := NewClient(username, password, 0)
	c.http.Transport = f
	return c
}

func readFixture(t *testing.T, name string) string {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("testdata", name))
	require.NoError(t, err)
	return string(data)
}

func parseFixture(t *testing.T, name string) *html.Node {
	t.Helper()
	f, err := os.Open(filepath.Join("testdata", name))
	require.NoError(t, err)
	defer f.Close()
	doc, err := html.Parse(f)
	require.NoError(t, err)
	return doc
}

func entryNames(entries []IndexEntry) []string {
	ret := make([]string, len(entries))
	for i, e := range entries {
		ret[i] = e.Name
	}
	return ret
}

func TestParseIndexTableLayout(t *testing.T) {
	entries, ok := ParseIndex(parseFixture(t, "index_table.html"))
	require.True(t, ok)
	assert.Equal(t, []string{"976.jpg", "976-high.html", "varela y chido.mp4", "extras"}, entryNames(entries))
	assert.Equal(t, "2025-11-04 09:31", entries[2].Modified.Format(indexDateLayout))
	assert.Equal(t, "2025-11-03", EarliestDate(entries))
}

func TestParseIndexPreLayout(t *testing.T) {
	entries, ok := ParseIndex(parseFixture(t, "index_pre.html"))
	require.True(t, ok)
	assert.Equal(t, []string{"model1836a.jpg", "model1836b.jpg", "model1836.html", "thumbs.JPG"}, entryNames(entries))
	assert.Equal(t, "2026-07-10", EarliestDate(entries))
	assert.Equal(t, []string{"model1836a.jpg", "model1836b.jpg"}, picNames(entries, "model"))
}

// A listing saved from the browser links entries absolutely.
func TestParseIndexSavedListing(t *testing.T) {
	entries, ok := ParseIndex(parseFixture(t, "np_listing_saved.html"))
	require.True(t, ok)
	assert.Equal(t, []string{
		"976-high.mp4", "976-high.wmv", "976-medium.mp4", "976-medium.wmv",
		"varela.mp4", "varela.jpg", "976-medium.html", "976-high.html",
	}, entryNames(entries))
	assert.Equal(t, "2026-04-28", EarliestDate(entries))
	assert.Equal(t, "976-high.html", scenePageEntry(entries))
	assert.Equal(t, "976-medium.html", scenePageEntry(entries[:7]))
}

func TestParseIndexRejectsErrorPage(t *testing.T) {
	_, ok := ParseIndex(parseFixture(t, "not_index.html"))
	assert.False(t, ok)
	assert.Equal(t, "", EarliestDate(nil))
}

func TestSiteKeyMatchesStudioNames(t *testing.T) {
	assert.Equal(t, BilatinmenKey, SiteKey("Bilatinmen"))
	assert.Equal(t, NakedPapisKey, SiteKey("Naked Papis"))
	assert.Equal(t, LatinboyzKey, SiteKey("LatinBoyz"))
	assert.Equal(t, "", SiteKey("Hung Papi"))
}

func TestBilatinmenSceneCode(t *testing.T) {
	site := New(BilatinmenKey, NewClient("", "", 0))
	assert.Equal(t, "1836", site.SceneCode(Scene{Basename: "1836-high.mp4"}))
	assert.Equal(t, "", site.SceneCode(Scene{Basename: "Wmv309.mp4"}))
	assert.Equal(t, "512", site.SceneCode(Scene{Basename: "benjamin.mp4", URLs: []string{
		"https://bilatinmen.com/latin_men_preview/model512/latin_men_preview_512.php",
	}}))
}

const blmPreview1836 = "https://bilatinmen.com/latin_men_preview/model1836/latin_men_preview_1836.php"

func TestBilatinmenScrapeWithoutMembersAccess(t *testing.T) {
	fake := &fakeSite{pages: map[string]string{blmPreview1836: "blm_preview.html"}}
	site := New(BilatinmenKey, newFakeClient(fake, "", ""))

	md, err := site.Scrape(context.Background(), "1836", Scene{})
	require.NoError(t, err)
	assert.Equal(t, Metadata{Title: "Cut & Gaze", URLs: []string{blmPreview1836}}, md)
	// Without credentials the members listing is never requested.
	assert.Equal(t, []string{"GET " + blmPreview1836}, fake.requests)
	assert.True(t, site.Client().MembersUnavailable())
}

func TestBilatinmenScrapeReadsMembersDate(t *testing.T) {
	fake := &fakeSite{pages: map[string]string{
		blmPreview1836: "blm_preview.html",
		"https://bilatinmen.com/members/latin_men_pictures/pictures_09/model1836/": "index_pre.html",
	}}
	site := New(BilatinmenKey, newFakeClient(fake, "user", "pass"))

	md, err := site.Scrape(context.Background(), "1836", Scene{})
	require.NoError(t, err)
	assert.Equal(t, "2026-07-10", md.Date)
	assert.Equal(t, []bool{false, true}, fake.authed)

	_, err = site.Scrape(context.Background(), "77", Scene{})
	assert.ErrorIs(t, err, ErrNotFound)
	assert.Equal(t, "https://bilatinmen.com/members/latin_men_pictures/pictures_08/model1000/", site.(*bilatinmen).picsURL("1000"))
}

// Extras keep their code as the folder name and file prefix.
func TestBilatinmenExtraPicsFolder(t *testing.T) {
	const folder = "https://bilatinmen.com/members/latin_men_pictures/pictures_09/extra142/"
	listing := strings.NewReplacer("model1836a", "extra142a", "model1836b", "model1836b").Replace(readFixture(t, "index_pre.html"))
	fake := &fakeSite{pages: map[string]string{folder: listing}}
	site := New(BilatinmenKey, newFakeClient(fake, "user", "pass")).(PicsSite)

	assert.Equal(t, "model1836", site.PicsFolder("1836"))
	assert.Equal(t, "extra142", site.PicsFolder("extra142"))
	folderURL, names, err := site.Pics(context.Background(), "extra142")
	require.NoError(t, err)
	assert.Equal(t, folder, folderURL)
	assert.Equal(t, []string{"extra142a.jpg"}, names)
}

func TestClientStopsMembersRequestsAfterRefusal(t *testing.T) {
	const a, b = "https://example.com/members/a/", "https://example.com/members/b/"
	fake := &fakeSite{
		pages:    map[string]string{a: "index_pre.html", b: "index_pre.html"},
		statuses: map[string]int{a: http.StatusUnauthorized},
	}
	client := newFakeClient(fake, "user", "wrong")

	_, err := client.Page(context.Background(), a, true)
	assert.ErrorIs(t, err, ErrUnauthorized)
	_, err = client.Page(context.Background(), b, true)
	assert.ErrorIs(t, err, ErrUnauthorized)
	assert.Equal(t, []string{"GET " + a}, fake.requests)
}

func TestNakedPapisSceneCode(t *testing.T) {
	site := New(NakedPapisKey, NewClient("", "", 0))
	assert.Equal(t, "128", site.SceneCode(Scene{Basename: "panchillo-papi128.mp4"}))
	assert.Equal(t, "5", site.SceneCode(Scene{Basename: "Wmvpapi5 512K-45.mp4"}))
	assert.Equal(t, "9", site.SceneCode(Scene{Basename: "x.mp4", URLs: []string{"https://nakedpapis.com/nude-latin-men/latino_men_9.html"}}))
	assert.Equal(t, "241", site.SceneCode(Scene{Basename: "x.mp4", URLs: []string{"https://nakedpapis.com/members/sexvideos/videofiles1/papi241/papi241part1-high.html"}}))
	assert.Equal(t, "", site.SceneCode(Scene{Basename: "compa.mp4"}))
}

func TestNakedPapisScrapeFallsBackToSolo(t *testing.T) {
	const soloDir = "https://nakedpapis.com/members/solovideos/videofiles1/papi976/"
	const public = "https://nakedpapis.com/nude-latin-men/papi976/latino_men_976.html"
	fake := &fakeSite{pages: map[string]string{
		soloDir + "?C=M;O=A":      "index_table.html",
		soloDir + "976-high.html": "np_scene.html",
		public:                    "blm_preview.html",
	}}
	site := New(NakedPapisKey, newFakeClient(fake, "user", "pass"))

	md, err := site.Scrape(context.Background(), "976", Scene{})
	require.NoError(t, err)
	assert.Equal(t, Metadata{
		Title:   "Varela & Chido",
		Date:    "2025-11-03",
		Details: "Varela and Chido hook up after the gym.",
		URLs:    []string{public, soloDir + "976-high.html"},
	}, md)
	assert.Equal(t, "solo", site.(*nakedPapis).kinds["976"])

	_, err = site.Scrape(context.Background(), "1", Scene{})
	assert.ErrorIs(t, err, ErrNotFound)
}

func TestNakedPapisIndexNames(t *testing.T) {
	assert.Equal(t, map[string]string{
		"5":   "Simon",
		"192": "Osito & Chavez",
		"976": "Varela",
	}, npIndexNames(parseFixture(t, "np_index_names.html")))
}

// Old scenes have no members scene page and their public page sits directly
// in nude-latin-men; the index still names them.
func TestNakedPapisScrapeOldScene(t *testing.T) {
	const soloDir = "https://nakedpapis.com/members/solovideos/videofiles1/papi5/"
	const public = "https://nakedpapis.com/nude-latin-men/latino_men_5.html"
	fake := &fakeSite{pages: map[string]string{
		soloDir + "?C=M;O=A": "np_listing_old.html",
		public:               "blm_preview.html",
		"https://nakedpapis.com/members/solovideos/videos.html": "np_index_names.html",
	}}
	site := New(NakedPapisKey, newFakeClient(fake, "user", "pass"))

	md, err := site.Scrape(context.Background(), "5", Scene{})
	require.NoError(t, err)
	assert.Equal(t, Metadata{Title: "Simon", Date: "2007-02-09", URLs: []string{public}}, md)
}

func TestNakedPapisResolveCodes(t *testing.T) {
	const sexBase = "https://nakedpapis.com/members/sexvideos/videofiles1/"
	const soloBase = "https://nakedpapis.com/members/solovideos/videofiles1/"
	fake := &fakeSite{
		pages: map[string]string{
			"https://nakedpapis.com/members/sexvideos/videos.html":  "np_index_sex.html",
			"https://nakedpapis.com/members/solovideos/videos.html": "np_index_solo.html",
		},
		sizes: map[string]int64{
			sexBase + "papi950/twin.mp4": 100,
			sexBase + "papi951/twin.mp4": 200,
		},
	}
	for u := range fake.sizes {
		fake.pages[u] = "video"
	}
	site := New(NakedPapisKey, newFakeClient(fake, "user", "pass"))

	scenes := []Scene{
		{ID: 1, Basename: "varela.mp4"},
		{ID: 2, Basename: "compa.mp4"},
		{ID: 3, Basename: "prieto (2).mp4"},
		{ID: 4, Basename: "twin.mp4", Size: 100},
		{ID: 5, Basename: "mystery.mp4", Size: 50},
		{ID: 6, Basename: "nobody.mp4"},
		{ID: 7, Basename: "Prieto-Chiquitin.mp4"},
		// Joined copies of multi-part scenes.
		{ID: 8, Basename: "osito-chavez.mp4"},
		{ID: 9, Basename: "negro&omar.mp4"},
		// rapper2 is one part in two qualities, not a multi-part scene.
		{ID: 10, Basename: "rapper.mp4"},
		{ID: 11, Basename: "abdul-ezequiel2.mp4"},
	}
	res, err := site.(CodeResolver).ResolveCodes(context.Background(), scenes, map[string]bool{"910": true, "248": true})
	require.NoError(t, err)

	assert.Equal(t, map[int]string{1: "976", 2: "980", 3: "943", 4: "950", 7: "945", 8: "192", 9: "137"}, res.Codes)
	assert.Equal(t, map[int][]string{5: {"960", "961"}}, res.Ambiguous)
	assert.Equal(t, map[int][]string{11: {"248"}}, res.Taken)
	assert.Equal(t, []int{6, 10}, res.Unmatched)
	np := site.(*nakedPapis)
	assert.Equal(t, "sex", np.kinds["976"])
	assert.Equal(t, "solo", np.kinds["980"])
	assert.Contains(t, fake.requests, "HEAD "+soloBase+"papi960/mystery.mp4")
}

func TestLatinboyzSceneCode(t *testing.T) {
	site := New(LatinboyzKey, NewClient("", "", 0))
	for name, code := range map[string]string{
		"HD2224.mp4":         "2224",
		"am245v2.mp4":        "245",
		"wmv1069-3000HD.mp4": "1069",
		"NEWam1798.mp4":      "1798",
		"1700HD.mp4":         "1700",
		"HD1855v23b22.mp4":   "1855",
		"Brian 2019.mp4":     "",
		"HD12.mp4":           "",
	} {
		assert.Equal(t, code, site.SceneCode(Scene{Basename: name}), name)
	}
}

const (
	lbzPostBrian  = "https://latinboyz.com/cute-latino-twink-brian/"
	lbzCoverBrian = "https://latinboyz.com/wp-content/uploads/2025/04/latinboyz-model-brian-am2224-1024x512-1.jpg"
)

func TestLatinboyzScrapeUsesTheSceneURL(t *testing.T) {
	fake := &fakeSite{pages: map[string]string{lbzPostBrian: "lbz_post.html"}}
	site := New(LatinboyzKey, newFakeClient(fake, "", ""))

	md, err := site.Scrape(context.Background(), "2224", Scene{URLs: []string{
		"https://www.iafd.com/title.rme/id=1",
		"https://members.latinboyz.com/cute-latino-twink-brian/",
		lbzPostBrian,
	}})
	require.NoError(t, err)
	assert.Equal(t, Metadata{
		Title:   "Cute Latino Twink – Brian",
		Date:    "2025-04-24",
		Details: "Friday 4/25/2025 Video added. Brian is a sexy Colombian who likes futbol, chess and reading.\nHe’s back next month. Stay tuned.",
		URLs:    []string{lbzPostBrian},
		Cover:   lbzCoverBrian,
	}, md, "members links, credits, captions and the edit date are left out")
	assert.Equal(t, []string{"GET " + lbzPostBrian}, fake.requests, "only the public post is requested")
	assert.Equal(t, []bool{false}, fake.authed)
	_, downloads := site.(PicsSite)
	assert.False(t, downloads)
}

// Recent posts name their images after am<code>; the search also returns
// posts with longer codes.
func TestLatinboyzScrapeFindsRecentPostsByCode(t *testing.T) {
	search := func(code string) string { return fmt.Sprintf(lbzSearchURL, code) }
	fake := &fakeSite{pages: map[string]string{
		search("2224"): "lbz_search.json",
		search("1887"): "[]",
		lbzPostBrian:   "lbz_post.html",
	}}
	site := New(LatinboyzKey, newFakeClient(fake, "", ""))

	md, err := site.Scrape(context.Background(), "2224", Scene{Basename: "HD2224.mp4"})
	require.NoError(t, err)
	assert.Equal(t, []string{lbzPostBrian}, md.URLs)
	assert.Equal(t, "2025-04-24", md.Date)

	_, err = site.Scrape(context.Background(), "1887", Scene{Basename: "HD1887.mp4"})
	assert.ErrorIs(t, err, ErrNotFound)

	fake.requests = nil
	_, err = site.Scrape(context.Background(), "big-mexican-cock-on-careless", Scene{})
	assert.ErrorIs(t, err, ErrNotFound)
	assert.Empty(t, fake.requests, "codes that are not numbers are not searched")
}

func TestLatinboyzPicsFolders(t *testing.T) {
	picsPath := t.TempDir()
	for _, name := range []string{
		"latinboyz-model-brian-am2224",
		"latinboyz-model-gato-am2196",
		"latinboyz-model-gato-am2196 (1)",
		"am1449",
		"latinboyz-model-1455-tempo",
		"latinboyz-model-cielo-am2230-2",
		"latinboyz-models-jako-jp",
		"latinboyz-models-diablito-lil-thumper-am470s1",
	} {
		require.NoError(t, os.Mkdir(filepath.Join(picsPath, name), 0o755))
	}
	require.NoError(t, os.WriteFile(filepath.Join(picsPath, "latinboyz-model-ivan-am2300.zip"), nil, 0o644))

	folders, err := FoldersByCode(New(LatinboyzKey, nil).(FolderCoder), picsPath)
	require.NoError(t, err)
	dir := func(name string) string { return filepath.Join(picsPath, name) }
	assert.Equal(t, map[string][]string{
		"2224": {dir("latinboyz-model-brian-am2224")},
		"2196": {dir("latinboyz-model-gato-am2196"), dir("latinboyz-model-gato-am2196 (1)")},
		"1449": {dir("am1449")},
		"1455": {dir("latinboyz-model-1455-tempo")},
		"2230": {dir("latinboyz-model-cielo-am2230-2")},
	}, folders, "folders without a code and files are skipped")
}

// An older downloader left empty folders behind when a listing failed.
func TestDownloadPicsRetriesEmptyFolders(t *testing.T) {
	const folder = "https://bilatinmen.com/members/latin_men_pictures/pictures_09/model1836/"
	fake := &fakeSite{pages: map[string]string{
		folder:                    "index_pre.html",
		folder + "model1836a.jpg": "jpeg-a",
		folder + "model1836b.jpg": "jpeg-b",
	}}
	site := New(BilatinmenKey, newFakeClient(fake, "user", "pass")).(PicsSite)
	picsPath := t.TempDir()
	dir := PicsDir(site, picsPath, "1836")
	require.NoError(t, os.Mkdir(dir, 0o755))

	created, err := DownloadPics(context.Background(), site, picsPath, "1836")
	require.NoError(t, err)
	assert.True(t, created)
	assert.FileExists(t, filepath.Join(dir, "model1836b.jpg"))

	// Without pictures on the site the empty folder is left as it was.
	emptyDir := PicsDir(site, picsPath, "1837")
	require.NoError(t, os.Mkdir(emptyDir, 0o755))
	_, err = DownloadPics(context.Background(), site, picsPath, "1837")
	assert.ErrorIs(t, err, ErrNotFound)
	assert.DirExists(t, emptyDir)
}

func TestDownloadPicsResumesAndSkipsFinishedFolders(t *testing.T) {
	const folder = "https://bilatinmen.com/members/latin_men_pictures/pictures_09/model1836/"
	fake := &fakeSite{
		pages: map[string]string{
			folder:                    "index_pre.html",
			folder + "model1836a.jpg": "jpeg-a",
			folder + "model1836b.jpg": "jpeg-b",
		},
		statuses: map[string]int{folder + "model1836b.jpg": http.StatusInternalServerError},
	}
	site := New(BilatinmenKey, newFakeClient(fake, "user", "pass")).(PicsSite)
	picsPath := t.TempDir()
	dir := PicsDir(site, picsPath, "1836")

	created, err := DownloadPics(context.Background(), site, picsPath, "1836")
	require.Error(t, err)
	assert.False(t, created)
	assert.NoDirExists(t, dir)
	assert.FileExists(t, filepath.Join(dir+stagingSuffix, "model1836a.jpg"))
	assert.NoFileExists(t, filepath.Join(dir+stagingSuffix, "model1836b.jpg.part"))

	delete(fake.statuses, folder+"model1836b.jpg")
	fake.requests = nil
	created, err = DownloadPics(context.Background(), site, picsPath, "1836")
	require.NoError(t, err)
	assert.True(t, created)
	// The listing is cached and model1836a.jpg survived the failed run.
	assert.Equal(t, []string{"GET " + folder + "model1836b.jpg"}, fake.requests)
	data, err := os.ReadFile(filepath.Join(dir, "model1836b.jpg"))
	require.NoError(t, err)
	assert.Equal(t, "jpeg-b", string(data))
	assert.NoDirExists(t, dir+stagingSuffix)

	fake.requests = nil
	created, err = DownloadPics(context.Background(), site, picsPath, "1836")
	require.NoError(t, err)
	assert.False(t, created)
	assert.Empty(t, fake.requests)
}
