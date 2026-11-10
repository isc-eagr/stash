package stashbox

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/require"
)

type stashDBChangesRequestCustom struct {
	Query     string         `json:"query"`
	Variables map[string]any `json:"variables"`
}

func newStashDBChangesServerCustom(t *testing.T, response string, request *stashDBChangesRequestCustom) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "secret", r.Header.Get("ApiKey"))
		require.NoError(t, json.NewDecoder(r.Body).Decode(request))
		_, _ = w.Write([]byte(response))
	}))
	t.Cleanup(server.Close)
	return server
}

func TestFindStashDBScenesCustom(t *testing.T) {
	var request stashDBChangesRequestCustom
	server := newStashDBChangesServerCustom(t, `{"data":{
  "s0": {"id": "a", "deleted": false, "title": "Title", "code": null, "details": "Details",
    "director": "Dir", "date": "2024-05-06",
    "urls": [{"url": "https://studio.com/a", "type": "STUDIO"}],
    "studio": {"id": "st", "name": "Studio"},
    "tags": [{"id": "t1", "name": "Kissing"}, {"id": "t2", "name": "4K Available"}],
    "performers": [{"performer": {"id": "p1", "name": "Papi"}}]},
  "s1": null,
  "s2": {"id": "deleted", "deleted": true, "urls": [], "tags": [], "performers": []},
  "s3": {"id": "new-id", "deleted": false, "urls": [], "tags": [], "performers": []}
}}`, &request)

	client := NewClient(models.StashBox{Endpoint: server.URL, APIKey: "secret"}, ExcludeTagPatterns([]string{"^4k"}))
	got, err := client.FindStashDBScenesCustom(context.Background(), []string{"a", "missing", "deleted", "merged"})
	require.NoError(t, err)

	title, details, director, date := "Title", "Details", "Dir", "2024-05-06"
	require.Equal(t, map[string]*StashDBSceneCustom{
		"a": {
			ID: "a", Title: &title, Details: &details, Director: &director, Date: &date,
			URLs:       []string{"https://studio.com/a"},
			Studio:     &StashDBEntityCustom{ID: "st", Name: "Studio"},
			Performers: []StashDBEntityCustom{{ID: "p1", Name: "Papi"}},
			Tags: []StashDBEntityCustom{
				{ID: "t1", Name: "Kissing"},
				{ID: "t2", Name: "4K Available", Ignored: true},
			},
		},
		"deleted": {ID: "deleted", Deleted: true},
		"merged":  {ID: "new-id"},
	}, got, "missing scenes are omitted; excluded tag patterns mark tags ignored")

	require.Equal(t, map[string]any{"s0": "a", "s1": "missing", "s2": "deleted", "s3": "merged"}, request.Variables)
	require.Equal(t, 4, strings.Count(request.Query, "findScene("), "one request for the batch")
	require.NotContains(t, request.Query, "images")
	require.NotContains(t, request.Query, "fingerprints")
}

func TestFindStashDBPerformersCustom(t *testing.T) {
	var request stashDBChangesRequestCustom
	server := newStashDBChangesServerCustom(t, `{"data":{
  "s0": {"id": "a", "name": "Papi", "disambiguation": "CDMX", "aliases": ["Papi", "Papito"],
    "gender": "MALE", "merged_ids": [], "deleted": false, "urls": [{"url": "https://x.com/papi", "type": "TWITTER"}],
    "birth_date": "1990-01-02", "ethnicity": "LATIN", "country": "MX", "eye_color": "BROWN",
    "hair_color": "BLACK", "height": 180, "breast_type": "NA", "career_start_year": 2015,
    "tattoos": [{"location": "Arm", "description": "Rose"}], "piercings": []},
  "s1": null,
  "s2": {"id": "old", "name": "Old", "aliases": [], "merged_ids": [], "deleted": true, "merged_into_id": "b", "urls": []}
}}`, &request)

	client := NewClient(models.StashBox{Endpoint: server.URL, APIKey: "secret"})
	got, err := client.FindStashDBPerformersCustom(context.Background(), []string{"a", "missing", "old"})
	require.NoError(t, err)
	require.Len(t, got, 2)

	p := got["a"]
	require.Equal(t, "Papi", *p.Name)
	require.Equal(t, "CDMX", *p.Disambiguation)
	require.Equal(t, "Papito", *p.Aliases, "the name is not repeated as an alias")
	require.Equal(t, "MALE", *p.Gender)
	require.Equal(t, "Latin", *p.Ethnicity)
	require.Equal(t, "180", *p.Height)
	require.Equal(t, "2015", *p.CareerStart)
	require.Equal(t, "Arm, Rose", *p.Tattoos)
	require.Equal(t, []string{"https://x.com/papi"}, p.URLs)
	require.Empty(t, p.Images)

	require.True(t, got["old"].RemoteDeleted)
	require.Equal(t, "b", *got["old"].RemoteMergedIntoId)

	require.Equal(t, 3, strings.Count(request.Query, "findPerformer("))
	require.NotContains(t, request.Query, "images")
}

func TestFindStashDBChangesCustomRequestError(t *testing.T) {
	var request stashDBChangesRequestCustom
	server := newStashDBChangesServerCustom(t, `{"errors":[{"message":"rate limited"}],"data":null}`, &request)
	client := NewClient(models.StashBox{Endpoint: server.URL, APIKey: "secret"})

	scenes, err := client.FindStashDBScenesCustom(context.Background(), []string{"a"})
	require.Error(t, err)
	require.Nil(t, scenes, "a failed request must not look like missing scenes")

	performers, err := client.FindStashDBPerformersCustom(context.Background(), []string{"a"})
	require.Error(t, err)
	require.Nil(t, performers)

	empty, err := client.FindStashDBScenesCustom(context.Background(), nil)
	require.NoError(t, err)
	require.Empty(t, empty)
}
