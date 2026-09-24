package api

import (
	"context"
	"fmt"
	"slices"
	"strconv"

	"github.com/stashapp/stash/internal/manager"
	"github.com/stashapp/stash/pkg/file"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/utils"
)

func (r *mutationResolver) SceneReleaseCreate(ctx context.Context, input SceneReleaseCreateInput) (*models.SceneRelease, error) {
	translator := changesetTranslator{
		inputMap: getUpdateInputMap(ctx),
	}
	extended, hasExtended, err := sceneReleaseExtendedInputCustom(translator,
		input.Rating100, input.Organized, input.Urls, input.PerformerIds,
		input.TagIds, input.Groups, input.StashIds, input.CustomFields)
	if err != nil {
		return nil, err
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
	if input.CoverImage != nil && *input.CoverImage != "" {
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

		// Attach files after creating the owner so moves are atomic and checked.
		if err := r.repository.SceneRelease.Create(ctx, &newRelease, nil); err != nil {
			return err
		}
		for _, fileID := range fileIDs {
			if err := r.repository.SceneRelease.MoveFileToReleaseCustom(ctx, newRelease.ID, fileID); err != nil {
				return fmt.Errorf("moving file to release: %w", err)
			}
		}
		if hasExtended {
			if err := r.repository.SceneRelease.UpdateExtendedCustom(ctx, newRelease.ID, extended); err != nil {
				return err
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
	extended, hasExtended, err := sceneReleaseExtendedInputCustom(translator,
		input.Rating100, input.Organized, input.Urls, input.PerformerIds,
		input.TagIds, input.Groups, input.StashIds, input.CustomFields)
	if err != nil {
		return nil, err
	}

	releaseID, err := strconv.Atoi(input.ID)
	if err != nil {
		return nil, fmt.Errorf("invalid id: %w", err)
	}

	var coverImageData []byte
	if input.CoverImage != nil && *input.CoverImage != "" {
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
			partial.Date = models.NewOptionalDatePtr(d)
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
		if hasExtended {
			if err := r.repository.SceneRelease.UpdateExtendedCustom(ctx, releaseID, extended); err != nil {
				return err
			}
			if extended.RatingSet { // CUSTOM: a manual rating relinquishes advisor ownership
				if err := r.repository.RatingScore.DeleteByEntity(ctx, models.RatingEntityRelease, releaseID); err != nil {
					return err
				}
			} // CUSTOM
			ret, err = r.repository.SceneRelease.Find(ctx, releaseID)
			if err != nil {
				return err
			}
		}

		// Update cover if provided
		if input.CoverImage != nil && *input.CoverImage == "" {
			if err := r.repository.SceneRelease.UpdateCover(ctx, releaseID, nil); err != nil {
				return err
			}
		} else if len(coverImageData) > 0 {
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

	if input.TransferOHistory != nil && *input.TransferOHistory {
		return nil, fmt.Errorf("transfer_o_history is obsolete: conversion preserves source ownership without moving activity to the parent")
	}
	if input.TransferMarkers != nil && *input.TransferMarkers {
		return nil, fmt.Errorf("transfer_markers is obsolete: conversion preserves source ownership without moving markers to the parent")
	}

	var ret *models.SceneRelease
	if err := r.withTxn(ctx, func(ctx context.Context) error {
		if input.RequestID != nil {
			resultID, found, err := r.repository.SceneRelease.FindConversionRequestCustom(ctx, *input.RequestID, "scene_to_release", sourceSceneID, targetSceneID)
			if err != nil {
				return err
			}
			if found {
				ret, err = r.repository.SceneRelease.Find(ctx, resultID)
				if err != nil {
					return err
				}
				if ret == nil {
					return fmt.Errorf("result of conversion request %q no longer exists", *input.RequestID)
				}
				return nil
			}
		}
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
		if err := r.repository.SceneRelease.CheckConversionFileConflictsCustom(ctx, sourceSceneID, targetSceneID); err != nil {
			return err
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
		newRelease.CreatedAt = sourceScene.CreatedAt
		newRelease.UpdatedAt = sourceScene.UpdatedAt

		// Get first URL if available
		if sourceScene.URLs.Loaded() && len(sourceScene.URLs.List()) > 0 {
			newRelease.URL = sourceScene.URLs.List()[0]
		}

		newRelease.GalleryIDs = sourceScene.GalleryIDs

		if err := r.repository.SceneRelease.Create(ctx, &newRelease, fileIDs); err != nil {
			return err
		}
		if err := r.repository.SceneRelease.TransferSceneMetadataToReleaseCustom(ctx, sourceSceneID, newRelease.ID); err != nil {
			return err
		}

		// Copy cover if exists
		if len(cover) > 0 {
			if err := r.repository.SceneRelease.UpdateCover(ctx, newRelease.ID, cover); err != nil {
				return err
			}
			if err := r.repository.Scene.DetachCoverForConversionCustom(ctx, sourceSceneID); err != nil {
				return err
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
		if input.RequestID != nil {
			return r.repository.SceneRelease.SaveConversionRequestCustom(ctx, *input.RequestID, "scene_to_release", sourceSceneID, targetSceneID, newRelease.ID)
		}
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
		if err := r.repository.SceneRelease.MoveFileToReleaseCustom(ctx, releaseID, models.FileID(fileID)); err != nil {
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

	if input.TransferOHistory != nil && *input.TransferOHistory {
		return nil, fmt.Errorf("transfer_o_history is obsolete: conversion restores only this release's activity")
	}
	if input.TransferMarkers != nil && *input.TransferMarkers {
		return nil, fmt.Errorf("transfer_markers is obsolete: parent markers stay with the parent")
	}

	var ret *models.Scene
	if err := r.withTxn(ctx, func(ctx context.Context) error {
		if input.RequestID != nil {
			resultID, found, err := r.repository.SceneRelease.FindConversionRequestCustom(ctx, *input.RequestID, "release_to_scene", releaseID, 0)
			if err != nil {
				return err
			}
			if found {
				ret, err = r.repository.Scene.Find(ctx, resultID)
				if err != nil {
					return err
				}
				if ret == nil {
					return fmt.Errorf("result of conversion request %q no longer exists", *input.RequestID)
				}
				return nil
			}
		}
		// Get the release
		release, err := r.repository.SceneRelease.Find(ctx, releaseID)
		if err != nil {
			return err
		}
		if release == nil {
			return fmt.Errorf("release with id %d not found", releaseID)
		}

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
		newScene.CreatedAt = release.CreatedAt
		newScene.UpdatedAt = release.UpdatedAt

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
		if err := r.repository.SceneRelease.TransferReleaseMetadataToSceneCustom(ctx, releaseID, newScene.ID); err != nil {
			return err
		}

		// Set the cover if exists
		if len(cover) > 0 {
			if err := r.repository.Scene.UpdateCover(ctx, newScene.ID, cover); err != nil {
				return err
			}
			if err := r.repository.SceneRelease.DetachCoverForConversionCustom(ctx, releaseID); err != nil {
				return err
			}
		}

		// Delete the release (files are automatically unlinked)
		if err := r.repository.SceneRelease.Destroy(ctx, releaseID); err != nil {
			return err
		}

		ret = &newScene
		if input.RequestID != nil {
			return r.repository.SceneRelease.SaveConversionRequestCustom(ctx, *input.RequestID, "release_to_scene", releaseID, 0, newScene.ID)
		}
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
	var fileDeleter *file.Deleter
	if deleteFromFilesystem {
		fileDeleter = file.NewDeleterWithTrash(manager.GetInstance().Config.GetDeleteTrashPath())
	}

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
		if deleteFromFilesystem {
			otherOwners, err := r.repository.SceneRelease.CountOtherFileOwnersCustom(ctx, releaseID, models.FileID(fileID))
			if err != nil {
				return err
			}
			if otherOwners != 0 {
				return fmt.Errorf("file %d is still used by %d other scene or release owners", fileID, otherOwners)
			}
		}

		// Remove file from release
		if err := r.repository.SceneRelease.RemoveFileID(ctx, releaseID, models.FileID(fileID)); err != nil {
			return err
		}
		if !deleteFromFilesystem {
			ownedBySibling, err := r.repository.SceneRelease.FileExistsInSceneReleases(ctx, release.SceneID, models.FileID(fileID))
			if err != nil {
				return err
			}
			if !ownedBySibling {
				parentFiles, err := r.repository.Scene.GetManyFileIDs(ctx, []int{release.SceneID})
				if err != nil {
					return err
				}
				if len(parentFiles) == 0 || !slices.Contains(parentFiles[0], models.FileID(fileID)) {
					if err := r.repository.Scene.AddFileID(ctx, release.SceneID, models.FileID(fileID)); err != nil {
						return err
					}
				}
				if err := r.repository.Scene.EnsurePrimaryFileCustom(ctx, release.SceneID); err != nil {
					return err
				}
			}
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

			if err := file.Destroy(ctx, r.repository.File, files[0], fileDeleter, true); err != nil {
				return fmt.Errorf("deleting release file: %w", err)
			}
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
		if fileDeleter != nil {
			fileDeleter.Rollback()
		}
		return nil, err
	}
	if fileDeleter != nil {
		fileDeleter.Commit()
	}

	return ret, nil
}
