package api

// CUSTOM: Scene release route handler registration.

import "github.com/go-chi/chi/v5"

func (s *Server) getSceneReleaseRoutes() chi.Router {
	repo := s.manager.Repository
	return sceneReleaseRoutes{
		routes:        routes{txnManager: repo.TxnManager},
		releaseFinder: repo.SceneRelease,
	}.Routes()
}
