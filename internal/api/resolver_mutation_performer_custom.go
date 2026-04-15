package api

// CUSTOM: Custom performer mutation resolvers (image management).

import (
	"context"
	"fmt"
	"strconv"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/utils"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

func (r *mutationResolver) PerformerImageUpload(ctx context.Context, performerID string, image string) (*models.PerformerImage, error) {
	performerIDInt, err := strconv.Atoi(performerID)
	if err != nil {
		return nil, fmt.Errorf("converting performer id: %w", err)
	}

	// Process the base64 encoded image
	imageData, err := utils.ProcessImageInput(ctx, image)
	if err != nil {
		return nil, fmt.Errorf("processing image: %w", err)
	}

	var performerImage *models.PerformerImage

	if err := r.withTxn(ctx, func(ctx context.Context) error {
		// Store the blob and get the checksum
		checksum, err := r.repository.Blobs.Write(ctx, imageData)
		if err != nil {
			return fmt.Errorf("storing image blob: %w", err)
		}

		// Dedupe: if this performer already has an additional image pointing at this blob,
		// return the existing row instead of inserting a duplicate.
		existing, err := r.repository.PerformerImage.GetByPerformerID(ctx, performerIDInt)
		if err != nil {
			return fmt.Errorf("getting performer images for dedupe: %w", err)
		}
		for _, e := range existing {
			if e != nil && e.ImageBlob == checksum {
				return &gqlerror.Error{
					Message: "Duplicate performer image (already uploaded)",
					Extensions: map[string]any{
						"code": "DUPLICATE_PERFORMER_IMAGE",
					},
				}
			}
		}

		// Create the performer image entry
		performerImage, err = r.repository.PerformerImage.Create(ctx, performerIDInt, checksum)
		if err != nil {
			return fmt.Errorf("creating performer image: %w", err)
		}

		return nil
	}); err != nil {
		return nil, err
	}

	return performerImage, nil
}

func (r *mutationResolver) PerformerImageDelete(ctx context.Context, id string) (bool, error) {
	imageID, err := strconv.Atoi(id)
	if err != nil {
		return false, fmt.Errorf("converting image id: %w", err)
	}

	if err := r.withTxn(ctx, func(ctx context.Context) error {
		// Get the image first to check if it exists
		img, err := r.repository.PerformerImage.Get(ctx, imageID)
		if err != nil {
			return fmt.Errorf("getting performer image: %w", err)
		}

		// Delete the performer image entry
		if err := r.repository.PerformerImage.Destroy(ctx, imageID); err != nil {
			return fmt.Errorf("deleting performer image: %w", err)
		}

		// Delete the blob if it's not referenced anywhere else
		// Note: This is safe because the blob store handles reference counting
		if err := r.repository.Blobs.Delete(ctx, img.ImageBlob); err != nil {
			// Don't fail if blob deletion fails - it might be referenced elsewhere
			// Just log the error
			// TODO: add proper logging
		}

		return nil
	}); err != nil {
		return false, err
	}

	return true, nil
}

func (r *mutationResolver) PerformerImageSetDefault(ctx context.Context, id string) (*models.Performer, error) {
	imageID, err := strconv.Atoi(id)
	if err != nil {
		return nil, fmt.Errorf("converting image id: %w", err)
	}

	var performer *models.Performer

	if err := r.withTxn(ctx, func(ctx context.Context) error {
		// Get the performer image we want to make default
		img, err := r.repository.PerformerImage.Get(ctx, imageID)
		if err != nil {
			return fmt.Errorf("getting performer image: %w", err)
		}

		// Get the current default image blob checksum (to swap it to performer_images)
		oldImageBlob, err := r.repository.Performer.GetImageBlob(ctx, img.PerformerID)
		if err != nil {
			return fmt.Errorf("getting performer default image blob: %w", err)
		}

		// Store the new default blob checksum from the performer_image
		newImageBlob := img.ImageBlob

		// No-op safety: if this image is already the default blob, just return the performer.
		if oldImageBlob != nil && *oldImageBlob != "" && *oldImageBlob == newImageBlob {
			performer, err = r.repository.Performer.Find(ctx, img.PerformerID)
			if err != nil {
				return fmt.Errorf("refreshing performer: %w", err)
			}
			return nil
		}

		// Update the performer's default image to the new blob checksum
		if err := r.repository.Performer.UpdateImageBlob(ctx, img.PerformerID, newImageBlob); err != nil {
			return fmt.Errorf("updating performer default image: %w", err)
		}

		// If the performer had a default image, swap it to the performer_image record
		if oldImageBlob != nil && *oldImageBlob != "" {
			// Avoid creating duplicates: if the old default blob already exists in another
			// performer_images row, delete the promoted row instead of swapping it to old.
			existing, err := r.repository.PerformerImage.GetByPerformerID(ctx, img.PerformerID)
			if err != nil {
				return fmt.Errorf("getting performer images for duplicate check: %w", err)
			}

			oldDefaultAlreadyPresent := false
			for _, e := range existing {
				if e == nil {
					continue
				}
				if e.ID != imageID && e.ImageBlob == *oldImageBlob {
					oldDefaultAlreadyPresent = true
					break
				}
			}

			if oldDefaultAlreadyPresent {
				if err := r.repository.PerformerImage.Destroy(ctx, imageID); err != nil {
					return fmt.Errorf("deleting promoted performer image: %w", err)
				}
			} else {
				// Update the performer_image record to point to the old default blob
				if err := r.repository.PerformerImage.UpdateBlob(ctx, imageID, *oldImageBlob); err != nil {
					return fmt.Errorf("updating performer image blob: %w", err)
				}
			}
		} else {
			// No old default image, just delete the performer_image record
			if err := r.repository.PerformerImage.Destroy(ctx, imageID); err != nil {
				return fmt.Errorf("deleting promoted performer image: %w", err)
			}
		}

		// Refresh the performer to get the updated image
		performer, err = r.repository.Performer.Find(ctx, img.PerformerID)
		if err != nil {
			return fmt.Errorf("refreshing performer: %w", err)
		}

		return nil
	}); err != nil {
		return nil, err
	}

	return performer, nil
}
