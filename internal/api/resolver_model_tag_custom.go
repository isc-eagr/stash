package api

// CUSTOM: Custom Tag resolver for performer tag scene counts.

import (
	"context"
	"strconv"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/scene"
)

func (r *tagResolver) PerformerSceneCount(ctx context.Context, obj *models.Tag, performerID string) (ret int, err error) {
	pid, err := strconv.Atoi(performerID)
	if err != nil {
		return 0, err
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByTagIDAndPerformerID(ctx, r.repository.Scene, obj.ID, pid, nil)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}
