package api

// CUSTOM: O event generated media routes.

import (
	"context"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/stashapp/stash/internal/manager"
	"github.com/stashapp/stash/internal/manager/config"
	"github.com/stashapp/stash/pkg/fsutil"
	"github.com/stashapp/stash/pkg/logger"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/utils"
)

func (rs sceneRoutes) OScreenshot(w http.ResponseWriter, r *http.Request) {
	scene := r.Context().Value(sceneKey).(*models.Scene)
	oID, err := strconv.Atoi(chi.URLParam(r, "oId"))
	if err != nil {
		http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
		return
	}

	var exists bool
	readTxnErr := rs.withReadTxn(r, func(ctx context.Context) error {
		query := "SELECT 1 FROM scenes_o_dates WHERE rowid = ? AND scene_id = ? AND video_timestamp IS NOT NULL LIMIT 1"
		_, rows, err := manager.GetInstance().Database.QuerySQL(ctx, query, []interface{}{oID, scene.ID})
		if err != nil {
			return err
		}
		exists = len(rows) > 0
		return nil
	})
	if readTxnErr != nil {
		logger.Warnf("read transaction error on fetch O screenshot: %v", readTxnErr)
		http.Error(w, readTxnErr.Error(), http.StatusInternalServerError)
		return
	}

	if !exists {
		http.Error(w, http.StatusText(http.StatusNotFound), http.StatusNotFound)
		return
	}

	sceneHash := scene.GetHash(config.GetInstance().GetVideoFileNamingAlgorithm())
	filepath := manager.GetInstance().Paths.Generated.GetOScreenshotPath(sceneHash, oID)
	imageExists, _ := fsutil.FileExists(filepath)
	if !imageExists {
		w.Header().Set("Content-Type", "image/png")
		utils.ServeStaticContent(w, r, utils.PendingGenerateResource)
		return
	}

	utils.ServeStaticFile(w, r, filepath)
}
