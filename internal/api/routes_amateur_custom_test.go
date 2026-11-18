package api

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAmateurInstanceFromUICustom(t *testing.T) {
	_, err := amateurInstanceFromUICustom(map[string]interface{}{})
	require.Error(t, err)
	_, err = amateurInstanceFromUICustom(map[string]interface{}{"amateurInstance": map[string]interface{}{"url": "localhost:9997"}})
	require.Error(t, err, "a URL needs a scheme")

	instance, err := amateurInstanceFromUICustom(map[string]interface{}{"amateurInstance": map[string]interface{}{
		"url": " http://localhost:9997/ ", "apiKey": " key ",
	}})
	require.NoError(t, err)
	require.Equal(t, "http://localhost:9997", instance.target.String())
	require.Equal(t, "key", instance.apiKey)
}

func TestAmateurGraphQLQueryOnlyCustom(t *testing.T) {
	require.NoError(t, amateurGraphQLQueryOnlyCustom([]byte(`{"query":"query A { sceneOEventMoments { at } }"}`)))
	require.NoError(t, amateurGraphQLQueryOnlyCustom([]byte(`{"query":"{ configuration { ui } }"}`)))
	for _, body := range []string{
		`{"query":"mutation { sceneDestroy(input: {id: 1}) }"}`,
		`{"query":"query A { a } mutation B { b }"}`,
		`{"query":"subscription { jobsSubscribe { type } }"}`,
		`[{"query":"{ a }"}]`,
		`{"query":"{"}`,
		`{"query":""}`,
	} {
		require.Error(t, amateurGraphQLQueryOnlyCustom([]byte(body)), body)
	}
}

func TestAmateurUpstreamPathCustom(t *testing.T) {
	require.Equal(t, "/graphql", amateurUpstreamPathCustom(http.MethodPost, "/amateur/graphql"))
	require.Equal(t, "/scene/5/o/9/screenshot", amateurUpstreamPathCustom(http.MethodGet, "/amateur/scene/5/o/9/screenshot"))
	require.Equal(t, "/performer/3/image", amateurUpstreamPathCustom(http.MethodGet, "/amateur/performer/3/image"))
	require.Empty(t, amateurUpstreamPathCustom(http.MethodGet, "/amateur/graphql"))
	require.Empty(t, amateurUpstreamPathCustom(http.MethodPost, "/amateur/scene/5/screenshot"))
	require.Empty(t, amateurUpstreamPathCustom(http.MethodGet, "/amateur/downloads/x"))
	require.Empty(t, amateurUpstreamPathCustom(http.MethodGet, "/amateur/settings"))
}

func TestAmateurProxyForwardsWithAmateurKeyCustom(t *testing.T) {
	var got *http.Request
	var gotBody string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r
		body, _ := io.ReadAll(r.Body)
		gotBody = string(body)
		http.SetCookie(w, &http.Cookie{Name: "session", Value: "amateur"})
		w.Header().Set("Access-Control-Allow-Origin", "*")
		_, _ = w.Write([]byte(`{"data":{}}`))
	}))
	defer upstream.Close()
	ui := map[string]interface{}{"amateurInstance": map[string]interface{}{"url": upstream.URL, "apiKey": "amateur-key"}}
	handler := amateurProxyHandlerCustom(func() map[string]interface{} { return ui })

	body := `{"query":"{ sceneOEventMoments { at } }"}`
	req := httptest.NewRequest(http.MethodPost, "http://main.local:9999/amateur/graphql", strings.NewReader(body))
	req.Header.Set("Cookie", "session=main")
	req.Header.Set("ApiKey", "main-key")
	rec := httptest.NewRecorder()
	handler(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Empty(t, rec.Header().Values("Set-Cookie"))
	require.Empty(t, rec.Header().Values("Access-Control-Allow-Origin"))
	require.Equal(t, "/graphql", got.URL.Path)
	require.Equal(t, body, gotBody)
	require.Equal(t, "main.local:9999", got.Host, "amateur image URLs point back at this instance")
	require.Equal(t, "/amateur", got.Header.Get("X-Forwarded-Prefix"))
	require.Equal(t, "amateur-key", got.Header.Get("ApiKey"))
	require.Empty(t, got.Header.Get("Cookie"))

	got = nil
	req = httptest.NewRequest(http.MethodGet, "http://main.local:9999/amateur/scene/5/screenshot?t=1&apikey=main-key", nil)
	rec = httptest.NewRecorder()
	handler(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "/scene/5/screenshot", got.URL.Path)
	require.Equal(t, "t=1", got.URL.RawQuery)

	got = nil
	req = httptest.NewRequest(http.MethodPost, "http://main.local:9999/amateur/graphql", strings.NewReader(`{"query":"mutation { a }"}`))
	rec = httptest.NewRecorder()
	handler(rec, req)
	require.Equal(t, http.StatusForbidden, rec.Code)
	require.Nil(t, got, "mutations never reach the amateur instance")
}

func TestAmateurProxyReportsOfflineCustom(t *testing.T) {
	upstream := httptest.NewServer(http.NotFoundHandler())
	url := upstream.URL
	upstream.Close()
	ui := map[string]interface{}{"amateurInstance": map[string]interface{}{"url": url}}
	rec := httptest.NewRecorder()
	amateurProxyHandlerCustom(func() map[string]interface{} { return ui })(rec,
		httptest.NewRequest(http.MethodPost, "/amateur/graphql", strings.NewReader(`{"query":"{ a }"}`)))
	require.Equal(t, http.StatusBadGateway, rec.Code)

	rec = httptest.NewRecorder()
	amateurProxyHandlerCustom(func() map[string]interface{} { return map[string]interface{}{} })(rec,
		httptest.NewRequest(http.MethodPost, "/amateur/graphql", strings.NewReader(`{"query":"{ a }"}`)))
	require.Equal(t, http.StatusServiceUnavailable, rec.Code)
}
