package api

// CUSTOM: GEVI latest scenes/vatos JSON and cached image endpoints.

import (
	"encoding/json"
	"net/http"
	"path/filepath"

	"github.com/go-chi/chi/v5"
	"github.com/stashapp/stash/internal/gevi"
	"github.com/stashapp/stash/pkg/logger"
)

type geviLatestRoutes struct {
	client *gevi.Client
}

func (rs geviLatestRoutes) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", rs.Latest)
	r.Post("/refresh", rs.Refresh)
	r.Get("/image/{imagePath}", rs.Image)

	return r
}

func (rs geviLatestRoutes) Latest(w http.ResponseWriter, r *http.Request) {
	cache, err := rs.client.Latest(r.Context(), false)
	rs.writeResponse(w, err, cache)
}

func (rs geviLatestRoutes) Refresh(w http.ResponseWriter, r *http.Request) {
	cache, err := rs.client.Latest(r.Context(), true)
	rs.writeResponse(w, err, cache)
}

func (rs geviLatestRoutes) Image(w http.ResponseWriter, r *http.Request) {
	imagePath := chi.URLParam(r, "imagePath")
	if rs.client.ImageDir == "" || imagePath == "" || filepath.Base(imagePath) != imagePath {
		http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
		return
	}

	http.ServeFile(w, r, rs.client.LocalImagePath(imagePath))
}

func (rs geviLatestRoutes) writeResponse(w http.ResponseWriter, err error, cache *gevi.Cache) {
	w.Header().Set("Content-Type", "application/json")

	if err != nil {
		logger.Warnf("error fetching GEVI latest data: %v", err)
		w.WriteHeader(http.StatusBadGateway)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	if err := json.NewEncoder(w).Encode(cache); err != nil {
		logger.Warnf("error writing GEVI latest response: %v", err)
	}
}
