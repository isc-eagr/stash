package api

// CUSTOM: SceneRecordOAtTimestamp mutation — records an O with the current
// video player position as a video_timestamp on the database record.

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"time"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/sliceutil"
)

func (r *mutationResolver) SceneRecordOAtTimestamp(ctx context.Context, id string, videoTimestamp float64) (*HistoryMutationResult, error) {
	ctx = historyMutationContextCustom(ctx)
	sceneID, err := strconv.Atoi(id)
	if err != nil {
		return nil, fmt.Errorf("converting id: %w", err)
	}

	updatedTimes, err := r.recordSceneOAtTimestampCustom(ctx, sceneID, videoTimestamp)
	if err != nil {
		return nil, err
	}

	return &HistoryMutationResult{
		Count:   models.HistoryMutationResultCountCustom(ctx, len(updatedTimes)),
		History: sliceutil.ValuesToPtrs(updatedTimes),
	}, nil
}

func (r *mutationResolver) recordSceneOAtTimestampCustom(ctx context.Context, sceneID int, videoTimestamp float64) (updatedTimes []time.Time, err error) {
	if math.IsNaN(videoTimestamp) || math.IsInf(videoTimestamp, 0) || videoTimestamp < 0 {
		return nil, fmt.Errorf("video timestamp must be finite and non-negative")
	}

	if err := r.withTxn(ctx, func(ctx context.Context) error {
		previousCount, err := r.repository.Scene.GetOCount(ctx, sceneID)
		if err != nil {
			return err
		}
		updatedTimes, err = r.repository.Scene.AddOAtVideoTimestamp(ctx, sceneID, videoTimestamp)
		if err != nil {
			return err
		}
		updatedCount := models.HistoryMutationResultCountCustom(ctx, len(updatedTimes))
		return r.repository.RatingScore.AdjustRatingsForSceneOCountChangeCustom(ctx, sceneID, previousCount, updatedCount)
	}); err != nil {
		return nil, err
	}
	return updatedTimes, nil
}
