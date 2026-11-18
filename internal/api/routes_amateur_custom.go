package api

// CUSTOM: read-only bridge to the amateur Stash instance, so O Stats and Year
// in Review can include its O's. The browser only talks to this instance; the
// amateur API key is added here, and amateur image URLs come back under
// /amateur because the request carries this host and an X-Forwarded-Prefix.

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/stashapp/stash/internal/manager/config"
	"github.com/stashapp/stash/pkg/logger"
	"github.com/stashapp/stash/pkg/session"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

const (
	amateurRoutePrefixCustom      = "/amateur"
	amateurGraphQLBodyLimitCustom = 1 << 20
)

// Only image routes the O Stats pages show are forwarded.
var amateurImageRoutesCustom = []string{"scene", "scene-release", "performer", "studio", "tag"}

type amateurInstanceCustom struct {
	target *url.URL
	apiKey string
}

// amateurInstanceFromUICustom reads the amateur URL and API key saved in
// Settings > Custom (ui.amateurInstance).
func amateurInstanceFromUICustom(ui map[string]interface{}) (*amateurInstanceCustom, error) {
	settings, _ := ui["amateurInstance"].(map[string]interface{})
	rawURL, _ := settings["url"].(string)
	apiKey, _ := settings["apiKey"].(string)
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return nil, errors.New("amateur instance URL is not set")
	}
	target, err := url.Parse(strings.TrimRight(rawURL, "/"))
	if err != nil || (target.Scheme != "http" && target.Scheme != "https") || target.Host == "" {
		return nil, fmt.Errorf("amateur instance URL is invalid: %q", rawURL)
	}
	return &amateurInstanceCustom{target: target, apiKey: strings.TrimSpace(apiKey)}, nil
}

// amateurGraphQLQueryOnlyCustom accepts one GraphQL request whose operations
// are all queries, so the bridge can never change the amateur library.
func amateurGraphQLQueryOnlyCustom(body []byte) error {
	var request struct {
		Query string `json:"query"`
	}
	if err := json.Unmarshal(body, &request); err != nil {
		return errors.New("expected one GraphQL request")
	}
	doc, err := parser.ParseQuery(&ast.Source{Input: request.Query})
	if err != nil {
		return err
	}
	if len(doc.Operations) == 0 {
		return errors.New("no GraphQL operation")
	}
	for _, operation := range doc.Operations {
		if operation.Operation != ast.Query {
			return errors.New("only queries can be sent to the amateur instance")
		}
	}
	return nil
}

// amateurUpstreamPathCustom maps /amateur/... to the amateur path, or "" when
// the route is not forwarded.
func amateurUpstreamPathCustom(method, path string) string {
	rest := strings.TrimPrefix(path, amateurRoutePrefixCustom)
	if rest == "/graphql" {
		if method == http.MethodPost {
			return rest
		}
		return ""
	}
	if method != http.MethodGet && method != http.MethodHead {
		return ""
	}
	for _, route := range amateurImageRoutesCustom {
		if strings.HasPrefix(rest, "/"+route+"/") {
			return rest
		}
	}
	return ""
}

func getAmateurRoutesCustom() chi.Router {
	r := chi.NewRouter()
	r.HandleFunc("/*", amateurProxyHandlerCustom(config.GetInstance().GetUIConfiguration))
	return r
}

// The settings are read per request, so saving them takes effect at once.
func amateurProxyHandlerCustom(uiConfig func() map[string]interface{}) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		serveAmateurProxyCustom(w, r, uiConfig())
	}
}

func serveAmateurProxyCustom(w http.ResponseWriter, r *http.Request, uiConfig map[string]interface{}) {
	upstreamPath := amateurUpstreamPathCustom(r.Method, r.URL.Path)
	if upstreamPath == "" {
		http.NotFound(w, r)
		return
	}
	instance, err := amateurInstanceFromUICustom(uiConfig)
	if err != nil {
		http.Error(w, err.Error(), http.StatusServiceUnavailable)
		return
	}
	if upstreamPath == "/graphql" {
		body, err := io.ReadAll(io.LimitReader(r.Body, amateurGraphQLBodyLimitCustom+1))
		if err != nil || len(body) > amateurGraphQLBodyLimitCustom {
			http.Error(w, "GraphQL request is too large", http.StatusRequestEntityTooLarge)
			return
		}
		if err := amateurGraphQLQueryOnlyCustom(body); err != nil {
			http.Error(w, err.Error(), http.StatusForbidden)
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(body))
		r.ContentLength = int64(len(body))
	}

	prefix := getProxyPrefix(r) + amateurRoutePrefixCustom
	proto := "http"
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		proto = "https"
	}
	proxy := &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.SetURL(instance.target)
			pr.Out.URL.Path = strings.TrimRight(instance.target.Path, "/") + upstreamPath
			pr.Out.URL.RawPath = ""
			// The amateur builds image URLs from this host and prefix.
			pr.Out.Host = pr.In.Host
			pr.Out.Header.Set("X-Forwarded-Prefix", prefix)
			pr.Out.Header.Set("X-Forwarded-Proto", proto)
			// This instance's login must not reach the amateur instance.
			pr.Out.Header.Del("Cookie")
			pr.Out.Header.Del("Authorization")
			pr.Out.Header.Del(session.ApiKeyHeader)
			query := pr.Out.URL.Query()
			query.Del(session.ApiKeyParameter)
			pr.Out.URL.RawQuery = query.Encode()
			if instance.apiKey != "" {
				pr.Out.Header.Set(session.ApiKeyHeader, instance.apiKey)
			}
		},
		ModifyResponse: func(resp *http.Response) error {
			resp.Header.Del("Set-Cookie")
			// This instance's CORS headers already apply; doubled ones are rejected.
			for name := range resp.Header {
				if strings.HasPrefix(name, "Access-Control-") {
					resp.Header.Del(name)
				}
			}
			return nil
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			logger.Debugf("amateur instance unreachable: %v", err)
			http.Error(w, "Amateur instance is not reachable", http.StatusBadGateway)
		},
	}
	proxy.ServeHTTP(w, r)
}
