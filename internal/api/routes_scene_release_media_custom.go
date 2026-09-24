package api

import (
	"bytes"
	"context"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/stashapp/stash/internal/manager"
	"github.com/stashapp/stash/pkg/file/video"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/utils"
)

func (rs sceneReleaseRoutes) releaseGeneratedAssetCustom(w http.ResponseWriter, r *http.Request, kind string) {
	primaryFile, err := rs.getPrimaryFile(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if primaryFile == nil {
		http.NotFound(w, r)
		return
	}
	hash := releaseMarkerVideoHashCustom(primaryFile, manager.GetInstance().Config.GetVideoFileNamingAlgorithm())
	if hash == "" {
		http.NotFound(w, r)
		return
	}
	if requestedHash := chi.URLParam(r, "sceneHash"); requestedHash != "" && requestedHash != hash {
		http.NotFound(w, r)
		return
	}
	paths := manager.GetInstance().Paths.Scene
	var path string
	switch kind {
	case "preview":
		path = paths.GetVideoPreviewPath(hash)
	case "webp":
		path = paths.GetWebpPreviewPath(hash)
	case "vtt":
		path = paths.GetSpriteVttFilePath(hash)
		w.Header().Set("Content-Type", "text/vtt")
	case "sprite":
		path = paths.GetSpriteImageFilePath(hash)
	case "heatmap":
		path = paths.GetInteractiveHeatmapPath(hash)
	}
	utils.ServeStaticFile(w, r, path)
}

func (rs sceneReleaseRoutes) PreviewCustom(w http.ResponseWriter, r *http.Request) {
	rs.releaseGeneratedAssetCustom(w, r, "preview")
}
func (rs sceneReleaseRoutes) WebpCustom(w http.ResponseWriter, r *http.Request) {
	rs.releaseGeneratedAssetCustom(w, r, "webp")
}
func (rs sceneReleaseRoutes) VttThumbsCustom(w http.ResponseWriter, r *http.Request) {
	rs.releaseGeneratedAssetCustom(w, r, "vtt")
}
func (rs sceneReleaseRoutes) VttSpriteCustom(w http.ResponseWriter, r *http.Request) {
	rs.releaseGeneratedAssetCustom(w, r, "sprite")
}
func (rs sceneReleaseRoutes) InteractiveHeatmapCustom(w http.ResponseWriter, r *http.Request) {
	rs.releaseGeneratedAssetCustom(w, r, "heatmap")
}

func (rs sceneReleaseRoutes) FunscriptCustom(w http.ResponseWriter, r *http.Request) {
	primaryFile, err := rs.getPrimaryFile(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if primaryFile == nil {
		http.NotFound(w, r)
		return
	}
	utils.ServeStaticFile(w, r, video.GetFunscriptPath(primaryFile.Path))
}

func (rs sceneReleaseRoutes) InteractiveCSVCustom(w http.ResponseWriter, r *http.Request) {
	primaryFile, err := rs.getPrimaryFile(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if primaryFile == nil {
		http.NotFound(w, r)
		return
	}
	content, err := manager.ConvertFunscriptToCSV(video.GetFunscriptPath(primaryFile.Path))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	utils.ServeStaticContent(w, r, content)
}

func (rs sceneReleaseRoutes) CaptionCustom(w http.ResponseWriter, r *http.Request) {
	primaryFile, err := rs.getPrimaryFile(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if primaryFile == nil {
		http.NotFound(w, r)
		return
	}
	var captions []*models.VideoCaption
	err = rs.withReadTxn(r, func(ctx context.Context) error {
		var err error
		captions, err = rs.captionFinder.GetCaptions(ctx, primaryFile.Base().ID)
		return err
	})
	if errors.Is(err, context.Canceled) {
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	lang := r.URL.Query().Get("lang")
	ext := r.URL.Query().Get("type")
	for _, caption := range captions {
		if caption.LanguageCode != lang || caption.CaptionType != ext {
			continue
		}
		sub, err := video.ReadSubs(caption.Path(primaryFile.Path))
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		var buf bytes.Buffer
		if err := sub.WriteToWebVTT(&buf); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "text/vtt")
		utils.ServeStaticContent(w, r, buf.Bytes())
		return
	}
	http.NotFound(w, r)
}
