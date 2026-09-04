package api

// CUSTOM: SceneRecordOAtTimestamp mutation — records an O with the current
// video player position as a video_timestamp on the database record.

import (
	"context"
	"fmt"
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

	var updatedTimes []time.Time

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

	return &HistoryMutationResult{
		Count:   models.HistoryMutationResultCountCustom(ctx, len(updatedTimes)),
		History: sliceutil.ValuesToPtrs(updatedTimes),
	}, nil
}
