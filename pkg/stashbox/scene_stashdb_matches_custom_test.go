package stashbox

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/stashbox/graphql"
	"github.com/stretchr/testify/require"
)

func TestStashDBMatchesCustom(t *testing.T) {
	fingerprints := []*graphql.FingerprintFragment{
		{Algorithm: graphql.FingerprintAlgorithmPhash, Submissions: 3},
		{Algorithm: graphql.FingerprintAlgorithmOshash, Submissions: 2},
		{Algorithm: graphql.FingerprintAlgorithmPhash, Submissions: 2},
		{Algorithm: graphql.FingerprintAlgorithmMd5, Submissions: 5},
		nil,
	}

	got := stashDBMatchesCustom("https://stashdb.org/graphql", fingerprints)
	require.NotNil(t, got)
	require.Equal(t, 5, *got)

	got = stashDBMatchesCustom("https://stashdb.org/graphql", nil)
	require.NotNil(t, got, "a StashDB scene without PHASHes has zero matches")
	require.Equal(t, 0, *got)

	require.Nil(t, stashDBMatchesCustom("https://fansdb.cc/graphql", fingerprints))
}

func TestIsStashDBEndpointCustom(t *testing.T) {
	for endpoint, want := range map[string]bool{
		"https://stashdb.org/graphql":      true,
		" HTTPS://StashDB.org/graphql ":    true,
		"https://beta.stashdb.org/graphql": true,
		"https://fansdb.cc/graphql":        false,
		"https://notstashdb.org/graphql":   false,
		"https://stashdb.org.evil/graphql": false,
		"":                                 false,
	} {
		require.Equal(t, want, IsStashDBEndpointCustom(endpoint), endpoint)
	}
}

func TestFindStashDBMatchesCustom(t *testing.T) {
	var request struct {
		Query     string         `json:"query"`
		Variables map[string]any `json:"variables"`
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "secret", r.Header.Get("ApiKey"))
		require.NoError(t, json.NewDecoder(r.Body).Decode(&request))
		_, _ = w.Write([]byte(`{"data":{
  "s0": {"deleted": false, "fingerprints": [
    {"algorithm": "PHASH", "submissions": 3},
    {"algorithm": "OSHASH", "submissions": 9},
    {"algorithm": "PHASH", "submissions": 2}]},
  "s1": null,
  "s2": {"deleted": true, "fingerprints": [{"algorithm": "PHASH", "submissions": 4}]},
  "s3": {"deleted": false, "fingerprints": []}
}}`))
	}))
	t.Cleanup(server.Close)

	client := NewClient(models.StashBox{Endpoint: server.URL, APIKey: "secret"})
	got, err := client.FindStashDBMatchesCustom(context.Background(), []string{"a", "missing", "deleted", "empty"})
	require.NoError(t, err)
	require.Equal(t, map[string]int{"a": 5, "empty": 0}, got)

	// One request, IDs passed as variables, only submissions selected.
	require.Equal(t, map[string]any{"s0": "a", "s1": "missing", "s2": "deleted", "s3": "empty"}, request.Variables)
	require.Equal(t, 4, strings.Count(request.Query, "findScene("))
	require.NotContains(t, request.Query, "images")

	got, err = client.FindStashDBMatchesCustom(context.Background(), nil)
	require.NoError(t, err)
	require.Empty(t, got)
}
