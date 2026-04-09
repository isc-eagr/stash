package api

// CUSTOM: Handler for serving performer additional images.

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/stashapp/stash/pkg/logger"
	"github.com/stashapp/stash/pkg/utils"
)

func (rs performerRoutes) AdditionalImage(w http.ResponseWriter, r *http.Request) {
	imageIDStr := chi.URLParam(r, "imageId")
	imageID, err := strconv.Atoi(imageIDStr)
	if err != nil {
		http.Error(w, http.StatusText(404), 404)
		return
	}

	var image []byte
	readTxnErr := rs.withReadTxn(r, func(ctx context.Context) error {
		// Get the performer image record
		performerImage, err := rs.performerImageFinder.Get(ctx, imageID)
		if err != nil {
			return err
		}

		// Get the blob data
		image, err = rs.blobStore.Read(ctx, performerImage.ImageBlob)
		return err
	})

	if errors.Is(readTxnErr, context.Canceled) {
		return
	}
	if readTxnErr != nil {
		logger.Warnf("read transaction error on fetch performer additional image: %v", readTxnErr)
		http.Error(w, http.StatusText(404), 404)
		return
	}

	utils.ServeImage(w, r, image)
}
