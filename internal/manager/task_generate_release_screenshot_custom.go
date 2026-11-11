package manager

// CUSTOM: release cover from a video frame, the release form of
// GenerateScreenshot. The frame comes from the release's primary file and is
// stored as the release's cover.

import (
	"context"
	"fmt"

	"github.com/stashapp/stash/pkg/job"
	"github.com/stashapp/stash/pkg/logger"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/scene/generate"
)

// GenerateReleaseScreenshotCustom queues the job. at nil takes the frame at
// 20% of the duration, as the scene default does.
func (s *Manager) GenerateReleaseScreenshotCustom(ctx context.Context, releaseID int, at *float64) int {
	if err := instance.Paths.Generated.EnsureTmpDir(); err != nil {
		logger.Warnf("failure generating release screenshot: %v", err)
	}

	j := job.MakeJobExec(func(ctx context.Context, progress *job.Progress) error {
		var videoFile *models.VideoFile
		if err := s.Repository.WithReadTxn(ctx, func(ctx context.Context) error {
			var err error
			videoFile, err = releasePrimaryFileCustom(ctx, s.Repository.SceneRelease, releaseID)
			return err
		}); err != nil {
			return fmt.Errorf("finding release for screenshot generation: %w", err)
		}

		frameAt := float64(videoFile.Duration) * 0.2
		if at != nil {
			frameAt = *at
		}
		g := generate.Generator{
			Encoder:      instance.FFMpeg,
			FFMpegConfig: instance.Config,
			LockManager:  instance.ReadLockManager,
			ScenePaths:   instance.Paths.Scene,
			Overwrite:    true,
		}
		cover, err := g.Screenshot(ctx, videoFile.Path, videoFile.Width, videoFile.Duration, generate.ScreenshotOptions{At: &frameAt})
		if err != nil {
			logErrorOutput(err)
			return fmt.Errorf("generating release screenshot: %w", err)
		}

		if err := s.Repository.WithTxn(ctx, func(ctx context.Context) error {
			if err := s.Repository.SceneRelease.UpdateCover(ctx, releaseID, cover); err != nil {
				return fmt.Errorf("setting release cover: %w", err)
			}
			// Bump updated_at like the scene task does.
			_, err := s.Repository.SceneRelease.UpdatePartial(ctx, releaseID, models.NewSceneReleasePartial())
			return err
		}); err != nil {
			return err
		}
		logger.Infof("Generate release screenshot finished")
		return nil
	})

	return s.JobManager.Add(ctx, fmt.Sprintf("Generating screenshot for release id %d", releaseID), j)
}

// releasePrimaryFileCustom returns the release's primary file, or an error
// when the release is missing or has no file to take a frame from.
func releasePrimaryFileCustom(ctx context.Context, qb models.SceneReleaseReader, releaseID int) (*models.VideoFile, error) {
	release, err := qb.Find(ctx, releaseID)
	if err != nil {
		return nil, err
	}
	if release == nil {
		return nil, fmt.Errorf("release with id %d not found", releaseID)
	}
	files, err := qb.GetFiles(ctx, releaseID)
	if err != nil {
		return nil, err
	}
	if len(files) == 0 {
		return nil, fmt.Errorf("release %d has no video file", releaseID)
	}
	return files[0], nil
}

// CheckReleaseScreenshotCustom fails fast in the request when the job could
// not produce a cover.
func CheckReleaseScreenshotCustom(ctx context.Context, repo models.Repository, releaseID int) error {
	return repo.WithReadTxn(ctx, func(ctx context.Context) error {
		_, err := releasePrimaryFileCustom(ctx, repo.SceneRelease, releaseID)
		return err
	})
}
