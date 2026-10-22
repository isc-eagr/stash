package sitesync

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/html"
)

func lbzTestIndex(posts ...[2]string) string {
	var rows []map[string]interface{}
	for _, p := range posts {
		rows = append(rows, map[string]interface{}{"link": p[0], "content": map[string]string{"rendered": p[1]}})
	}
	if rows == nil {
		return "[]"
	}
	b, _ := json.Marshal(rows)
	return string(b)
}

func lbzTestPage(content string) string {
	return `<h1 class="entry-title">Public title</h1><div class="entry-content">` + content + `<p>Public description</p></div><script type="application/ld+json">{"@graph":[{"datePublished":"2025-04-24T00:00:00Z"}]}</script>`
}

func TestLatinboyzPublicMediaCodes(t *testing.T) {
	doc, err := html.Parse(strings.NewReader(`<p>am9999 2026 1024x512</p>
<img src="https://latinboyz.com/wp-content/uploads/model-am2224-1024x512.jpg">
<source src="/wp-content/uploads/HD2224Promo.mp4">
<img srcset="/wp-content/uploads/model-am22240.jpg 100w, /wp-content/uploads/model-am22240-300x150.jpg 300w">
<video poster="https://latinboyz.com/wp-content/uploads/wmv1069-thumb.jpg"></video>
<a href="https://latinboyz.com/am7777/">Related page</a>
<img src="https://other.test/am8888.jpg">`))
	require.NoError(t, err)
	assert.Equal(t, []string{"1069", "2224", "22240"}, lbzMediaCodes(doc))
	for _, name := range []string{" HD2224 (2).MP4 ", "AM2224v2.wmv", "NEWam2224.mp4", "2224HD.mp4"} {
		assert.Equal(t, "2224", New(LatinboyzKey, nil).SceneCode(Scene{Basename: name}), name)
	}
}

func TestLatinboyzPublicIndexPaginationAndCache(t *testing.T) {
	first, second := fmt.Sprintf(lbzIndexURL, 1), fmt.Sprintf(lbzIndexURL, 2)
	other := "https://latinboyz.com/trailer-only/"
	fake := &fakeSite{
		pages: map[string]string{
			first:  lbzTestIndex([2]string{lbzPostBrian, `<img src="/model-am22240.jpg">`}),
			second: lbzTestIndex([2]string{other, `<video src="/HD2224Promo.mp4"></video>`}),
			other:  lbzTestPage(`<video src="/HD2224Promo.mp4"></video>`),
		},
		headers: map[string]http.Header{first: {"X-Wp-Totalpages": {"2"}}, second: {"X-Wp-Totalpages": {"2"}}},
	}
	site := New(LatinboyzKey, newFakeClient(fake, "configured", "unused"))
	for i := 0; i < 2; i++ {
		md, err := site.Scrape(context.Background(), "2224", Scene{Basename: "HD2224.mp4"})
		require.NoError(t, err)
		assert.Equal(t, "2224", md.Code)
		assert.Equal(t, []string{other}, md.URLs)
	}
	assert.Equal(t, []string{"GET " + first, "GET " + second, "GET " + other}, fake.requests)
	assert.Equal(t, []bool{false, false, false}, fake.authed, "even configured logins are never sent")
}

func TestLatinboyzPublicIndexAmbiguityAndFailure(t *testing.T) {
	first, second := fmt.Sprintf(lbzIndexURL, 1), fmt.Sprintf(lbzIndexURL, 2)
	for _, failing := range []bool{false, true} {
		t.Run(fmt.Sprint("failed second page=", failing), func(t *testing.T) {
			fake := &fakeSite{
				pages: map[string]string{
					first:  lbzTestIndex([2]string{lbzPostBrian, `<img src="/model-am2224.jpg">`}),
					second: lbzTestIndex([2]string{"https://latinboyz.com/another/", `<img src="/model-am2224.jpg">`}),
				},
				headers: map[string]http.Header{first: {"X-Wp-Totalpages": {"2"}}, second: {"X-Wp-Totalpages": {"2"}}},
			}
			if failing {
				fake.statuses = map[string]int{second: http.StatusInternalServerError}
			}
			site := New(LatinboyzKey, newFakeClient(fake, "", ""))
			for i := 0; i < 2; i++ {
				_, err := site.Scrape(context.Background(), "2224", Scene{})
				require.Error(t, err)
				if !failing {
					assert.ErrorIs(t, err, ErrAmbiguous)
				}
			}
			assert.Equal(t, []string{"GET " + first, "GET " + second}, fake.requests, "a partial index is never used or fetched again")
		})
	}
}

func TestLatinboyzPublicURLsAndConflicts(t *testing.T) {
	const current = "https://latinboyz.com/current/"
	const stale = "https://latinboyz.com/old/"
	const uncoded = "https://latinboyz.com/uncoded/"
	first := fmt.Sprintf(lbzIndexURL, 1)
	fake := &fakeSite{pages: map[string]string{
		first:   lbzTestIndex([2]string{current, `<img src="/model-am2224.jpg">`}),
		current: lbzTestPage(`<img src="/model-am2224.jpg">`),
		uncoded: lbzTestPage(`<img src="/portrait.jpg">`),
	}}
	site := New(LatinboyzKey, newFakeClient(fake, "", ""))
	md, err := site.Scrape(context.Background(), "2224", Scene{URLs: []string{stale}})
	require.NoError(t, err)
	assert.Equal(t, []string{current}, md.URLs)
	assert.Equal(t, []string{"GET " + stale, "GET " + first, "GET " + current}, fake.requests)

	for _, post := range []string{current, uncoded} {
		md, err := site.Scrape(context.Background(), "", Scene{Basename: "renamed.mp4", URLs: []string{post}})
		require.NoError(t, err)
		assert.Equal(t, "Public title", md.Title)
		assert.Equal(t, post == current, md.Code != "")
	}
	_, err = site.Scrape(context.Background(), "22240", Scene{URLs: []string{current}})
	assert.ErrorIs(t, err, ErrCodeConflict)
	_, err = site.Scrape(context.Background(), "22240", Scene{Basename: "HD2224.mp4"})
	assert.ErrorIs(t, err, ErrCodeConflict)

	fake.pages["https://latinboyz.com/redirect/"] = `<link rel="canonical" href="` + current + `">` + lbzTestPage(`<img src="/model-am2224.jpg">`)
	md, err = site.Scrape(context.Background(), "2224", Scene{URLs: []string{"https://latinboyz.com/redirect/"}})
	require.NoError(t, err)
	assert.Equal(t, []string{current}, md.URLs)
	for _, authed := range fake.authed {
		assert.False(t, authed)
	}
	assert.False(t, site.(PublicSceneSite).HasSceneURL(Scene{URLs: []string{"https://members.latinboyz.com/scene/", "https://latinboyz.com/wp-content/uploads/a.jpg", "https://latinboyz.com/join/"}}))
}
