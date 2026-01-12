package api

import (
	"context"
	"mime"
	"net/http"
	"path/filepath"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/stashapp/stash/internal/manager"
	"github.com/stashapp/stash/pkg/ffmpeg"
	"github.com/stashapp/stash/pkg/logger"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/utils"
)

type SceneReleaseFinder interface {
	models.SceneReleaseFinder
	GetCover(ctx context.Context, releaseID int) ([]byte, error)
	HasCover(ctx context.Context, releaseID int) (bool, error)
	GetFiles(ctx context.Context, releaseID int) ([]*models.VideoFile, error)
}

type sceneReleaseRoutes struct {
	routes
	releaseFinder SceneReleaseFinder
}

func (rs sceneReleaseRoutes) Routes() chi.Router {
	r := chi.NewRouter()

	r.Route("/{releaseId}", func(r chi.Router) {
		r.Use(rs.SceneReleaseCtx)
		r.Get("/screenshot", rs.Screenshot)

		// streaming endpoints
		r.Get("/stream", rs.StreamDirect)
		r.Get("/stream.mp4", rs.StreamMp4)
		r.Get("/stream.webm", rs.StreamWebM)
		r.Get("/stream.mkv", rs.StreamMKV)
	})

	return r
}

func (rs sceneReleaseRoutes) SceneReleaseCtx(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		releaseIDParam := chi.URLParam(r, "releaseId")
		releaseID, err := strconv.Atoi(releaseIDParam)
		if err != nil {
			http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
			return
		}

		var release *models.SceneRelease
		if err := rs.withReadTxn(r, func(ctx context.Context) error {
			var err error
			release, err = rs.releaseFinder.Find(ctx, releaseID)
			return err
		}); err != nil {
			logger.Warnf("error fetching scene release: %v", err)
			http.Error(w, http.StatusText(http.StatusNotFound), http.StatusNotFound)
			return
		}

		if release == nil {
			http.Error(w, http.StatusText(http.StatusNotFound), http.StatusNotFound)
			return
		}

		ctx := context.WithValue(r.Context(), sceneReleaseKey, release)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (rs sceneReleaseRoutes) Screenshot(w http.ResponseWriter, r *http.Request) {
	release := r.Context().Value(sceneReleaseKey).(*models.SceneRelease)

	var cover []byte
	if err := rs.withReadTxn(r, func(ctx context.Context) error {
		var err error
		cover, err = rs.releaseFinder.GetCover(ctx, release.ID)
		return err
	}); err != nil {
		logger.Warnf("error fetching scene release cover: %v", err)
		http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
		return
	}

	if cover == nil {
		http.Error(w, http.StatusText(http.StatusNotFound), http.StatusNotFound)
		return
	}

	utils.ServeImage(w, r, cover)
}

func (rs sceneReleaseRoutes) getPrimaryFile(r *http.Request) (*models.VideoFile, error) {
	release := r.Context().Value(sceneReleaseKey).(*models.SceneRelease)
	var primaryFile *models.VideoFile

	if err := rs.withReadTxn(r, func(ctx context.Context) error {
		files, err := rs.releaseFinder.GetFiles(ctx, release.ID)
		if err != nil {
			return err
		}
		if len(files) > 0 {
			primaryFile = files[0]
		}
		return nil
	}); err != nil {
		return nil, err
	}

	return primaryFile, nil
}

func (rs sceneReleaseRoutes) StreamDirect(w http.ResponseWriter, r *http.Request) {
	primaryFile, err := rs.getPrimaryFile(r)
	if err != nil {
		logger.Warnf("[stream] error getting release file: %v", err)
		http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
		return
	}
	if primaryFile == nil {
		http.Error(w, http.StatusText(http.StatusNotFound), http.StatusNotFound)
		return
	}

	fp := primaryFile.Path
	streamRequestCtx := ffmpeg.NewStreamRequestContext(w, r)
	_ = manager.GetInstance().ReadLockManager.ReadLock(streamRequestCtx, fp)
	_, filename := filepath.Split(fp)
	contentDisposition := mime.FormatMediaType("inline", map[string]string{"filename": filename})
	w.Header().Set("Content-Disposition", contentDisposition)
	http.ServeFile(w, r, fp)
}

func (rs sceneReleaseRoutes) StreamMp4(w http.ResponseWriter, r *http.Request) {
	rs.streamTranscode(w, r, ffmpeg.StreamTypeMP4)
}

func (rs sceneReleaseRoutes) StreamWebM(w http.ResponseWriter, r *http.Request) {
	rs.streamTranscode(w, r, ffmpeg.StreamTypeWEBM)
}

func (rs sceneReleaseRoutes) StreamMKV(w http.ResponseWriter, r *http.Request) {
	primaryFile, err := rs.getPrimaryFile(r)
	if err != nil || primaryFile == nil {
		http.Error(w, http.StatusText(http.StatusNotFound), http.StatusNotFound)
		return
	}

	container, err := manager.GetVideoFileContainer(primaryFile)
	if err != nil {
		logger.Errorf("[transcode] error getting container: %v", err)
	}

	if container != ffmpeg.Matroska {
		w.WriteHeader(http.StatusBadRequest)
		if _, err := w.Write([]byte("not an mkv file")); err != nil {
			logger.Warnf("[stream] error writing to stream: %v", err)
		}
		return
	}

	rs.streamTranscode(w, r, ffmpeg.StreamTypeMKV)
}

func (rs sceneReleaseRoutes) streamTranscode(w http.ResponseWriter, r *http.Request, streamType ffmpeg.StreamFormat) {
	primaryFile, err := rs.getPrimaryFile(r)
	if err != nil || primaryFile == nil {
		http.Error(w, http.StatusText(http.StatusNotFound), http.StatusNotFound)
		return
	}

	streamManager := manager.GetInstance().StreamManager
	if streamManager == nil {
		http.Error(w, "Live transcoding disabled", http.StatusServiceUnavailable)
		return
	}

	if err := r.ParseForm(); err != nil {
		logger.Warnf("[transcode] error parsing query form: %v", err)
	}

	startTime := r.Form.Get("start")
	ss, _ := strconv.ParseFloat(startTime, 64)
	resolution := r.Form.Get("resolution")

	options := ffmpeg.TranscodeOptions{
		StreamType: streamType,
		VideoFile:  primaryFile,
		Resolution: resolution,
		StartTime:  ss,
	}

	release := r.Context().Value(sceneReleaseKey).(*models.SceneRelease)
	logger.Debugf("[transcode] streaming scene release %d as %s", release.ID, streamType.MimeType)
	streamManager.ServeTranscode(w, r, options)
}
