package api

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/stashapp/stash/internal/manager"
	"github.com/stashapp/stash/pkg/fsutil"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/utils"
)

func releaseMarkerVideoHashCustom(video *models.VideoFile, algorithm models.HashAlgorithm) string {
	if video == nil || video.BaseFile == nil {
		return ""
	}
	fingerprintType := models.FingerprintTypeOshash
	if algorithm == models.HashAlgorithmMd5 {
		fingerprintType = models.FingerprintTypeMD5
	}
	if fingerprint := video.Fingerprints.For(fingerprintType); fingerprint != nil {
		return fingerprint.Value()
	}
	return ""
}

func (rs sceneReleaseRoutes) releaseMarkerAssetCustom(w http.ResponseWriter, r *http.Request, kind string) {
	release := r.Context().Value(sceneReleaseKey).(*models.SceneRelease)
	markerID, err := strconv.Atoi(chi.URLParam(r, "sceneMarkerId"))
	if err != nil {
		http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
		return
	}
	var marker *models.SceneMarker
	err = rs.withReadTxn(r, func(ctx context.Context) error {
		var err error
		marker, err = rs.sceneMarkerFinder.Find(ctx, markerID)
		return err
	})
	if errors.Is(err, context.Canceled) {
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if marker == nil || marker.ReleaseID == nil || *marker.ReleaseID != release.ID {
		http.Error(w, http.StatusText(http.StatusNotFound), http.StatusNotFound)
		return
	}
	video, err := rs.getPrimaryFile(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	hash := releaseMarkerVideoHashCustom(video, manager.GetInstance().Config.GetVideoFileNamingAlgorithm())
	if hash == "" {
		http.Error(w, http.StatusText(http.StatusNotFound), http.StatusNotFound)
		return
	}
	paths := manager.GetInstance().Paths.SceneMarkers
	var path string
	switch kind {
	case "stream":
		path = paths.GetVideoPreviewPath(hash, int(marker.Seconds))
	case "preview":
		path = paths.GetWebpPreviewPath(hash, int(marker.Seconds))
	case "screenshot":
		path = paths.GetScreenshotPath(hash, int(marker.Seconds))
	}
	if exists, _ := fsutil.FileExists(path); !exists && kind != "stream" {
		w.Header().Set("Content-Type", "image/png")
		utils.ServeStaticContent(w, r, utils.PendingGenerateResource)
		return
	}
	utils.ServeStaticFile(w, r, path)
}

func (rs sceneReleaseRoutes) SceneMarkerStreamCustom(w http.ResponseWriter, r *http.Request) {
	rs.releaseMarkerAssetCustom(w, r, "stream")
}

func (rs sceneReleaseRoutes) SceneMarkerPreviewCustom(w http.ResponseWriter, r *http.Request) {
	rs.releaseMarkerAssetCustom(w, r, "preview")
}

func (rs sceneReleaseRoutes) SceneMarkerScreenshotCustom(w http.ResponseWriter, r *http.Request) {
	rs.releaseMarkerAssetCustom(w, r, "screenshot")
}
