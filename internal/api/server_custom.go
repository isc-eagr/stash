package api

// CUSTOM: Custom route handler registrations.

import (
	"github.com/go-chi/chi/v5"
	"github.com/stashapp/stash/internal/gevi"
	"github.com/stashapp/stash/internal/manager/config"
)

func (s *Server) getSceneReleaseRoutes() chi.Router {
	repo := s.manager.Repository
	return sceneReleaseRoutes{
		routes:        routes{txnManager: repo.TxnManager},
		releaseFinder: repo.SceneRelease,
	}.Routes()
}

func (s *Server) getGEVILatestRoutes() chi.Router {
	cacheDir := config.GetInstance().GetCachePath()
	if cacheDir == "" {
		cacheDir = config.GetInstance().GetConfigPath()
	}

	return geviLatestRoutes{
		client: gevi.NewClient(gevi.CachePath(cacheDir)),
	}.Routes()
}
