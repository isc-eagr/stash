package api

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/stashapp/stash/pkg/models"
)

func (r *mutationResolver) SceneReleaseSaveActivity(ctx context.Context, id string, resumeTime *float64, playDuration *float64) (bool, error) {
	releaseID, err := strconv.Atoi(id)
	if err != nil {
		return false, fmt.Errorf("converting release id: %w", err)
	}
	err = r.withTxn(ctx, func(ctx context.Context) error {
		return r.repository.SceneRelease.SaveActivityCustom(ctx, releaseID, resumeTime, playDuration)
	})
	return err == nil, err
}

func (r *mutationResolver) SceneReleaseAddPlay(ctx context.Context, id string) (int, error) {
	releaseID, err := strconv.Atoi(id)
	if err != nil {
		return 0, fmt.Errorf("converting release id: %w", err)
	}
	var count int
	err = r.withTxn(ctx, func(ctx context.Context) error {
		count, err = r.repository.SceneRelease.AddPlayCustom(ctx, releaseID)
		return err
	})
	return count, err
}

func (r *mutationResolver) SceneReleaseRecordOAtTimestamp(ctx context.Context, id string, videoTimestamp float64) (int, error) {
	releaseID, err := strconv.Atoi(id)
	if err != nil {
		return 0, fmt.Errorf("converting release id: %w", err)
	}
	var count int
	err = r.withTxn(ctx, func(ctx context.Context) error {
		count, err = r.repository.SceneRelease.AddOAtTimestampCustom(ctx, releaseID, videoTimestamp)
		if err != nil {
			return err
		}
		return r.recalculateReleaseAdvisorsCustom(ctx, releaseID)
	})
	return count, err
}

func (r *mutationResolver) SceneReleaseEditHistory(ctx context.Context, id string, kind string, action string, at *time.Time) (bool, error) {
	releaseID, err := strconv.Atoi(id)
	if err != nil {
		return false, fmt.Errorf("converting release id: %w", err)
	}
	err = r.withTxn(ctx, func(ctx context.Context) error {
		if err := r.repository.SceneRelease.EditHistoryCustom(ctx, releaseID, kind, action, at); err != nil {
			return err
		}
		if kind == "o" {
			return r.recalculateReleaseAdvisorsCustom(ctx, releaseID)
		}
		return nil
	})
	return err == nil, err
}

func (r *mutationResolver) SceneReleaseResetActivity(ctx context.Context, id string, resetResume *bool, resetDuration *bool) (bool, error) {
	releaseID, err := strconv.Atoi(id)
	if err != nil {
		return false, fmt.Errorf("converting release id: %w", err)
	}
	err = r.withTxn(ctx, func(ctx context.Context) error {
		return r.repository.SceneRelease.ResetActivityCustom(ctx, releaseID, resetResume != nil && *resetResume, resetDuration != nil && *resetDuration)
	})
	return err == nil, err
}

func (r *mutationResolver) recalculateReleaseAdvisorsCustom(ctx context.Context, releaseID int) error {
	scores, err := r.repository.RatingScore.FindByEntity(ctx, models.RatingEntityRelease, releaseID)
	if err != nil {
		return err
	}
	if len(scores) > 0 {
		if _, err := r.repository.RatingScore.RecalculateRating(ctx, models.RatingEntityRelease, releaseID); err != nil {
			return err
		}
	}
	performerIDs, err := r.repository.SceneRelease.GetPerformerIDsCustom(ctx, releaseID)
	if err != nil {
		return err
	}
	for _, performerID := range performerIDs {
		scores, err := r.repository.RatingScore.FindByEntity(ctx, models.RatingEntityPerformer, performerID)
		if err != nil {
			return err
		}
		if len(scores) > 0 {
			if _, err := r.repository.RatingScore.RecalculateRating(ctx, models.RatingEntityPerformer, performerID); err != nil {
				return err
			}
		}
	}
	return nil
}
