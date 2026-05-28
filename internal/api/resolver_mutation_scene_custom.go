package api

// CUSTOM: SceneRecordOAtTimestamp mutation — records an O with the current
// video player position as a video_timestamp on the database record.

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/stashapp/stash/pkg/sliceutil"
)

func (r *mutationResolver) SceneRecordOAtTimestamp(ctx context.Context, id string, videoTimestamp float64) (*HistoryMutationResult, error) {
	sceneID, err := strconv.Atoi(id)
	if err != nil {
		return nil, fmt.Errorf("converting id: %w", err)
	}

	var updatedTimes []time.Time

	if err := r.withTxn(ctx, func(ctx context.Context) error {
		updatedTimes, err = r.repository.Scene.AddOAtVideoTimestamp(ctx, sceneID, videoTimestamp)
		return err
	}); err != nil {
		return nil, err
	}

	return &HistoryMutationResult{
		Count:   len(updatedTimes),
		History: sliceutil.ValuesToPtrs(updatedTimes),
	}, nil
}
