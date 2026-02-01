package api

import (
	"context"
	"fmt"
	"os"
	"strconv"

	"github.com/stashapp/stash/pkg/logger"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/txn"
	"github.com/stashapp/stash/pkg/utils"
)

func (r *mutationResolver) SceneReleaseCreate(ctx context.Context, input SceneReleaseCreateInput) (*models.SceneRelease, error) {
	translator := changesetTranslator{
		inputMap: getUpdateInputMap(ctx),
	}

	sceneID, err := strconv.Atoi(input.SceneID)
	if err != nil {
		return nil, fmt.Errorf("invalid scene_id: %w", err)
	}

	fileIDs, err := translator.fileIDSliceFromStringSlice(input.FileIds)
	if err != nil {
		return nil, fmt.Errorf("converting file ids: %w", err)
	}

	// Build the new release
	newRelease := models.NewSceneRelease()
	newRelease.SceneID = sceneID
	newRelease.Title = translator.string(input.Title)
	newRelease.Code = translator.string(input.Code)
	newRelease.Details = translator.string(input.Details)
	newRelease.Director = translator.string(input.Director)
	newRelease.URL = translator.string(input.URL)

	newRelease.Date, err = translator.datePtr(input.Date)
	if err != nil {
		return nil, fmt.Errorf("converting date: %w", err)
	}

	newRelease.StudioID, err = translator.intPtrFromString(input.StudioID)
	if err != nil {
		return nil, fmt.Errorf("converting studio id: %w", err)
	}

	if input.PlayOrder != nil {
		newRelease.PlayOrder = *input.PlayOrder
	}

	newRelease.GalleryIDs, err = translator.relatedIds(input.GalleryIds)
	if err != nil {
		return nil, fmt.Errorf("converting gallery ids: %w", err)
	}

	var coverImageData []byte
	if input.CoverImage != nil {
		coverImageData, err = utils.ProcessImageInput(ctx, *input.CoverImage)
		if err != nil {
			return nil, fmt.Errorf("processing cover image: %w", err)
		}
	}

	var ret *models.SceneRelease
	if err := r.withTxn(ctx, func(ctx context.Context) error {
		// If creating from file split (file IDs provided but no other data),
		// copy scene data to the new release
		isSplitFromScene := len(fileIDs) > 0 &&
			newRelease.Title == "" &&
			newRelease.Code == "" &&
			newRelease.Date == nil &&
			newRelease.StudioID == nil

		if isSplitFromScene {
			// Load the parent scene to copy its data
			scene, err := r.repository.Scene.Find(ctx, sceneID)
			if err != nil {
				return fmt.Errorf("loading parent scene: %w", err)
			}
			if scene != nil {
				newRelease.Title = scene.Title
				newRelease.Code = scene.Code
				newRelease.Details = scene.Details
				newRelease.Director = scene.Director
				newRelease.Date = scene.Date
				newRelease.StudioID = scene.StudioID

				// Load and copy URL
				if err := scene.LoadURLs(ctx, r.repository.Scene); err != nil {
					return fmt.Errorf("loading scene URLs: %w", err)
				}
				urls := scene.URLs.List()
				if len(urls) > 0 {
					newRelease.URL = urls[0]
				}
			}
		}

		// Create the release
		if err := r.repository.SceneRelease.Create(ctx, &newRelease, fileIDs); err != nil {
			return err
		}

		// Remove files from scenes_files table (they now belong to the release)
		for _, fileID := range fileIDs {
			if err := r.repository.Scene.RemoveFileID(ctx, sceneID, fileID); err != nil {
				return fmt.Errorf("removing file from scene: %w", err)
			}
		}

		// Update cover if provided
		if len(coverImageData) > 0 {
			if err := r.repository.SceneRelease.UpdateCover(ctx, newRelease.ID, coverImageData); err != nil {
				return err
			}
		}

		// Load the release with all relationships in the same transaction
		release, err := r.repository.SceneRelease.Find(ctx, newRelease.ID)
		if err != nil {
			return err
		}

		// Eagerly load files and galleries to avoid "not in transaction" errors
		if err := release.LoadGalleryIDs(ctx, r.repository.SceneRelease); err != nil {
			return err
		}

		ret = release
		return nil
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

func (r *mutationResolver) SceneReleaseUpdate(ctx context.Context, input SceneReleaseUpdateInput) (*models.SceneRelease, error) {
	translator := changesetTranslator{
		inputMap: getUpdateInputMap(ctx),
	}

	releaseID, err := strconv.Atoi(input.ID)
	if err != nil {
		return nil, fmt.Errorf("invalid id: %w", err)
	}

	var coverImageData []byte
	if input.CoverImage != nil {
		coverImageData, err = utils.ProcessImageInput(ctx, *input.CoverImage)
		if err != nil {
			return nil, fmt.Errorf("processing cover image: %w", err)
		}
	}

	var ret *models.SceneRelease
	if err := r.withTxn(ctx, func(ctx context.Context) error {
		// Get existing release
		existing, err := r.repository.SceneRelease.Find(ctx, releaseID)
		if err != nil {
			return err
		}
		if existing == nil {
			return fmt.Errorf("scene release with id %d not found", releaseID)
		}

		// Build partial update
		partial := models.NewSceneReleasePartial()

		if input.Title != nil {
			partial.Title = models.NewOptionalString(*input.Title)
		}
		if input.Code != nil {
			partial.Code = models.NewOptionalString(*input.Code)
		}
		if input.Details != nil {
			partial.Details = models.NewOptionalString(*input.Details)
		}
		if input.Director != nil {
			partial.Director = models.NewOptionalString(*input.Director)
		}
		if input.URL != nil {
			partial.URL = models.NewOptionalString(*input.URL)
		}
		if input.Date != nil {
			d, err := translator.datePtr(input.Date)
			if err != nil {
				return fmt.Errorf("converting date: %w", err)
			}
			if d != nil {
				partial.Date = models.NewOptionalDate(*d)
			}
		}
		if input.StudioID != nil {
			studioID, err := translator.intPtrFromString(input.StudioID)
			if err != nil {
				return fmt.Errorf("converting studio id: %w", err)
			}
			if studioID != nil {
				partial.StudioID = models.NewOptionalInt(*studioID)
			} else {
				partial.StudioID = models.NewOptionalIntPtr(nil)
			}
		}
		if input.PlayOrder != nil {
			partial.PlayOrder = models.NewOptionalInt(*input.PlayOrder)
		}

		if input.GalleryIds != nil {
			galleryIDs, err := translator.relatedIds(input.GalleryIds)
			if err != nil {
				return fmt.Errorf("converting gallery ids: %w", err)
			}
			partial.GalleryIDs = &models.UpdateIDs{
				IDs:  galleryIDs.List(),
				Mode: models.RelationshipUpdateModeSet,
			}
		}

		if input.PrimaryFileID != nil {
			fileID, err := translator.fileIDPtrFromString(input.PrimaryFileID)
			if err != nil {
				return fmt.Errorf("converting primary file id: %w", err)
			}
			partial.PrimaryFileID = fileID
		}

		// Update the release
		ret, err = r.repository.SceneRelease.UpdatePartial(ctx, releaseID, partial)
		if err != nil {
			return err
		}

		// Update cover if provided
		if len(coverImageData) > 0 {
			if err := r.repository.SceneRelease.UpdateCover(ctx, releaseID, coverImageData); err != nil {
				return err
			}
		}

		// Eagerly load files and galleries to avoid "not in transaction" errors
		if err := ret.LoadGalleryIDs(ctx, r.repository.SceneRelease); err != nil {
			return err
		}

		return nil
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

func (r *mutationResolver) SceneReleaseDestroy(ctx context.Context, input SceneReleaseDestroyInput) (bool, error) {
	releaseID, err := strconv.Atoi(input.ID)
	if err != nil {
		return false, fmt.Errorf("invalid id: %w", err)
	}

	if err := r.withTxn(ctx, func(ctx context.Context) error {
		// Get the release to find its parent scene
		release, err := r.repository.SceneRelease.Find(ctx, releaseID)
		if err != nil {
			return err
		}
		if release == nil {
			return fmt.Errorf("scene release with id %d not found", releaseID)
		}

		// Reassign files from release to main scene
		if err := r.repository.SceneRelease.AssignFilesToScene(ctx, releaseID, release.SceneID); err != nil {
			return err
		}

		// Destroy the release
		return r.repository.SceneRelease.Destroy(ctx, releaseID)
	}); err != nil {
		return false, err
	}

	return true, nil
}

func (r *mutationResolver) ConvertSceneToRelease(ctx context.Context, input ConvertSceneToReleaseInput) (*models.SceneRelease, error) {
	sourceSceneID, err := strconv.Atoi(input.SourceSceneID)
	if err != nil {
		return nil, fmt.Errorf("invalid source_scene_id: %w", err)
	}

	targetSceneID, err := strconv.Atoi(input.TargetSceneID)
	if err != nil {
		return nil, fmt.Errorf("invalid target_scene_id: %w", err)
	}

	if sourceSceneID == targetSceneID {
		return nil, fmt.Errorf("source and target scene cannot be the same")
	}

	transferOHistory := input.TransferOHistory != nil && *input.TransferOHistory
	transferMarkers := input.TransferMarkers != nil && *input.TransferMarkers

	var ret *models.SceneRelease
	if err := r.withTxn(ctx, func(ctx context.Context) error {
		// Load the source scene
		sourceScene, err := r.repository.Scene.Find(ctx, sourceSceneID)
		if err != nil {
			return err
		}
		if sourceScene == nil {
			return fmt.Errorf("source scene with id %d not found", sourceSceneID)
		}

		// Verify target scene exists
		targetScene, err := r.repository.Scene.Find(ctx, targetSceneID)
		if err != nil {
			return err
		}
		if targetScene == nil {
			return fmt.Errorf("target scene with id %d not found", targetSceneID)
		}

		// Load source scene's URLs
		if err := sourceScene.LoadURLs(ctx, r.repository.Scene); err != nil {
			return err
		}

		// Get source scene's file IDs
		fileIDSlices, err := r.repository.Scene.GetManyFileIDs(ctx, []int{sourceSceneID})
		if err != nil {
			return err
		}
		var fileIDs []models.FileID
		if len(fileIDSlices) > 0 {
			fileIDs = fileIDSlices[0]
		}

		// Get source scene's gallery IDs
		if err := sourceScene.LoadGalleryIDs(ctx, r.repository.Scene); err != nil {
			return err
		}

		// Get source scene cover
		cover, err := r.repository.Scene.GetCover(ctx, sourceSceneID)
		if err != nil {
			return err
		}

		// Create the release from source scene data
		newRelease := models.NewSceneRelease()
		newRelease.SceneID = targetSceneID
		newRelease.Title = sourceScene.Title
		newRelease.Code = sourceScene.Code
		newRelease.Details = sourceScene.Details
		newRelease.Director = sourceScene.Director
		newRelease.Date = sourceScene.Date
		newRelease.StudioID = sourceScene.StudioID

		// Get first URL if available
		if sourceScene.URLs.Loaded() && len(sourceScene.URLs.List()) > 0 {
			newRelease.URL = sourceScene.URLs.List()[0]
		}

		newRelease.GalleryIDs = sourceScene.GalleryIDs

		if err := r.repository.SceneRelease.Create(ctx, &newRelease, fileIDs); err != nil {
			return err
		}

		// Copy cover if exists
		if len(cover) > 0 {
			if err := r.repository.SceneRelease.UpdateCover(ctx, newRelease.ID, cover); err != nil {
				return err
			}
		}

		// Transfer o-history from source scene to target scene if requested
		if transferOHistory {
			if err := r.repository.Scene.TransferOHistory(ctx, sourceSceneID, targetSceneID); err != nil {
				return err
			}
		}

		// Handle markers: transfer to target scene or delete
		markers, err := r.repository.SceneMarker.FindBySceneID(ctx, sourceSceneID)
		if err != nil {
			return err
		}
		if transferMarkers {
			// Transfer markers to target scene
			for _, marker := range markers {
				marker.SceneID = targetSceneID
				if err := r.repository.SceneMarker.Update(ctx, marker); err != nil {
					return err
				}
			}
		} else {
			// Delete markers associated with the source scene
			for _, marker := range markers {
				if err := r.repository.SceneMarker.Destroy(ctx, marker.ID); err != nil {
					return err
				}
			}
		}

		// Transfer releases from source scene to target scene
		releases, err := r.repository.SceneRelease.FindBySceneID(ctx, sourceSceneID)
		if err != nil {
			return err
		}
		for _, release := range releases {
			release.SceneID = targetSceneID
			if err := r.repository.SceneRelease.Update(ctx, release); err != nil {
				return err
			}
		}

		// Delete the source scene (files are now with the release)
		if err := r.repository.Scene.Destroy(ctx, sourceSceneID); err != nil {
			return err
		}

		// Eagerly load files and galleries to avoid "not in transaction" errors
		if err := newRelease.LoadGalleryIDs(ctx, r.repository.SceneRelease); err != nil {
			return err
		}

		ret = &newRelease
		return nil
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

func (r *mutationResolver) SceneReleaseAddFile(ctx context.Context, input SceneReleaseAddFileInput) (*models.SceneRelease, error) {
	releaseID, err := strconv.Atoi(input.ReleaseID)
	if err != nil {
		return nil, fmt.Errorf("invalid release_id: %w", err)
	}

	// Validate input: either file_id or file_path must be provided, but not both
	if input.FileID == nil && input.FilePath == nil {
		return nil, fmt.Errorf("either file_id or file_path must be provided")
	}
	if input.FileID != nil && input.FilePath != nil {
		return nil, fmt.Errorf("cannot provide both file_id and file_path")
	}

	var fileID int
	if input.FileID != nil {
		fileID, err = strconv.Atoi(*input.FileID)
		if err != nil {
			return nil, fmt.Errorf("invalid file_id: %w", err)
		}
	}

	var ret *models.SceneRelease
	if err := r.withTxn(ctx, func(ctx context.Context) error {
		// Verify release exists and get its scene ID
		release, err := r.repository.SceneRelease.Find(ctx, releaseID)
		if err != nil {
			return err
		}
		if release == nil {
			return fmt.Errorf("scene release with id %d not found", releaseID)
		}

		// If file_path is provided, look up or error
		if input.FilePath != nil {
			// Look up file by path
			existingFile, err := r.repository.File.FindByPath(ctx, *input.FilePath, true)
			if err != nil {
				return fmt.Errorf("looking up file by path: %w", err)
			}
			if existingFile == nil {
				return fmt.Errorf("file not found at path %q. Please run a library scan first to add this file to the database", *input.FilePath)
			}
			fileID = int(existingFile.Base().ID)
		}

		// Check if file exists
		files, err := r.repository.File.Find(ctx, models.FileID(fileID))
		if err != nil {
			return err
		}
		if len(files) == 0 {
			return fmt.Errorf("file with id %d not found", fileID)
		}

		// Check if file is a video file
		if _, ok := files[0].(*models.VideoFile); !ok {
			return fmt.Errorf("file with id %d is not a video file", fileID)
		}

		// Add file to release
		if err := r.repository.SceneRelease.AddFileID(ctx, releaseID, models.FileID(fileID)); err != nil {
			return err
		}

		// Reload the release with updated data
		ret, err = r.repository.SceneRelease.Find(ctx, releaseID)
		if err != nil {
			return err
		}

		// Eagerly load galleries
		if err := ret.LoadGalleryIDs(ctx, r.repository.SceneRelease); err != nil {
			return err
		}

		return nil
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

func (r *mutationResolver) ConvertReleaseToScene(ctx context.Context, input ConvertReleaseToSceneInput) (*models.Scene, error) {
	releaseID, err := strconv.Atoi(input.ReleaseID)
	if err != nil {
		return nil, fmt.Errorf("invalid release_id: %w", err)
	}

	transferOHistory := input.TransferOHistory != nil && *input.TransferOHistory
	transferMarkers := input.TransferMarkers != nil && *input.TransferMarkers

	var ret *models.Scene
	if err := r.withTxn(ctx, func(ctx context.Context) error {
		// Get the release
		release, err := r.repository.SceneRelease.Find(ctx, releaseID)
		if err != nil {
			return err
		}
		if release == nil {
			return fmt.Errorf("release with id %d not found", releaseID)
		}

		parentSceneID := release.SceneID

		// Get release's file IDs
		fileIDs, err := r.repository.SceneRelease.GetFileIDs(ctx, releaseID)
		if err != nil {
			return err
		}

		// Get release's gallery IDs
		if err := release.LoadGalleryIDs(ctx, r.repository.SceneRelease); err != nil {
			return err
		}

		// Get release cover
		cover, err := r.repository.SceneRelease.GetCover(ctx, releaseID)
		if err != nil {
			return err
		}

		// Create a new scene from release data
		newScene := models.NewScene()
		newScene.Title = release.Title
		newScene.Code = release.Code
		newScene.Details = release.Details
		newScene.Director = release.Director
		newScene.Date = release.Date
		newScene.StudioID = release.StudioID

		// Set URL if present
		if release.URL != "" {
			newScene.URLs = models.NewRelatedStrings([]string{release.URL})
		}

		// Set gallery IDs
		if release.GalleryIDs.Loaded() && len(release.GalleryIDs.List()) > 0 {
			newScene.GalleryIDs = release.GalleryIDs
		}

		// Create the scene with file IDs
		if err := r.repository.Scene.Create(ctx, &newScene, fileIDs); err != nil {
			return err
		}

		// Set the cover if exists
		if len(cover) > 0 {
			if err := r.repository.Scene.UpdateCover(ctx, newScene.ID, cover); err != nil {
				return err
			}
		}

		// Transfer o-history from parent scene if requested
		if transferOHistory {
			if err := r.repository.Scene.TransferOHistory(ctx, parentSceneID, newScene.ID); err != nil {
				return err
			}
		}

		// Transfer markers from parent scene if requested
		if transferMarkers {
			markers, err := r.repository.SceneMarker.FindBySceneID(ctx, parentSceneID)
			if err != nil {
				return err
			}
			for _, marker := range markers {
				marker.SceneID = newScene.ID
				if err := r.repository.SceneMarker.Update(ctx, marker); err != nil {
					return err
				}
			}
		}

		// Delete the release (files are automatically unlinked)
		if err := r.repository.SceneRelease.Destroy(ctx, releaseID); err != nil {
			return err
		}

		ret = &newScene
		return nil
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

func (r *mutationResolver) SceneReleaseRemoveFile(ctx context.Context, input SceneReleaseRemoveFileInput) (*models.SceneRelease, error) {
	releaseID, err := strconv.Atoi(input.ReleaseID)
	if err != nil {
		return nil, fmt.Errorf("invalid release_id: %w", err)
	}

	fileID, err := strconv.Atoi(input.FileID)
	if err != nil {
		return nil, fmt.Errorf("invalid file_id: %w", err)
	}

	deleteFromFilesystem := input.DeleteFromFilesystem != nil && *input.DeleteFromFilesystem

	var ret *models.SceneRelease
	if err := r.withTxn(ctx, func(ctx context.Context) error {
		// Verify release exists
		release, err := r.repository.SceneRelease.Find(ctx, releaseID)
		if err != nil {
			return err
		}
		if release == nil {
			return fmt.Errorf("scene release with id %d not found", releaseID)
		}

		// Check if file exists in the release
		fileIDs, err := r.repository.SceneRelease.GetFileIDs(ctx, releaseID)
		if err != nil {
			return err
		}

		found := false
		for _, fid := range fileIDs {
			if fid == models.FileID(fileID) {
				found = true
				break
			}
		}
		if !found {
			return fmt.Errorf("file with id %d not found in release %d", fileID, releaseID)
		}

		// Remove file from release
		if err := r.repository.SceneRelease.RemoveFileID(ctx, releaseID, models.FileID(fileID)); err != nil {
			return err
		}

		// If requested, delete the file from the filesystem
		if deleteFromFilesystem {
			files, err := r.repository.File.Find(ctx, models.FileID(fileID))
			if err != nil {
				return err
			}
			if len(files) == 0 {
				return fmt.Errorf("file with id %d not found", fileID)
			}

			path := files[0].Base().Path

			// Destroy the file record from the database
			if err := r.repository.File.Destroy(ctx, models.FileID(fileID)); err != nil {
				return fmt.Errorf("destroying file record: %w", err)
			}

			// Delete the file from the filesystem (done after transaction commits)
			// Use a post-commit hook to delete the file
			txn.AddPostCommitHook(ctx, func(ctx context.Context) {
				if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
					// Log the error but don't fail the operation
					logger.Errorf("Failed to delete file %s from filesystem: %v", path, err)
				}
			})
		}

		// Reload the release with updated data
		ret, err = r.repository.SceneRelease.Find(ctx, releaseID)
		if err != nil {
			return err
		}

		// Eagerly load galleries
		if err := ret.LoadGalleryIDs(ctx, r.repository.SceneRelease); err != nil {
			return err
		}

		return nil
	}); err != nil {
		return nil, err
	}

	return ret, nil
}
