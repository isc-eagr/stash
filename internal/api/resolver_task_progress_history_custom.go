package api

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/stashapp/stash/pkg/models"
)

func (r *queryResolver) TaskProgressOverall(ctx context.Context) (ret *models.TaskProgressOverall, err error) {
	err = r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.TaskProgressTracker.Overall(ctx)
		return err
	})
	return
}

func (r *queryResolver) TaskProgressEvents(ctx context.Context, trackerID string, date string, afterID *string) (ret *models.TaskProgressEventPage, err error) {
	id, err := strconv.Atoi(trackerID)
	if err != nil {
		return nil, err
	}
	if _, err = time.Parse("2006-01-02", date); err != nil {
		return nil, fmt.Errorf("%w: invalid history date", ErrInput)
	}
	after := 0
	if afterID != nil {
		after, err = strconv.Atoi(*afterID)
		if err != nil {
			return nil, err
		}
	}
	err = r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.TaskProgressTracker.Events(ctx, id, date, after)
		return err
	})
	return
}

func (r *queryResolver) TaskProgressPendingItems(ctx context.Context, trackerID string, itemType string, offset *int) (ret *models.TaskProgressEventPage, err error) {
	id, err := strconv.Atoi(trackerID)
	if err != nil {
		return nil, err
	}
	if _, err = taskProgressItemTypesCustom([]string{itemType}); err != nil {
		return nil, err
	}
	pageOffset := 0
	if offset != nil {
		pageOffset = *offset
	}
	if pageOffset < 0 {
		return nil, fmt.Errorf("%w: invalid offset", ErrInput)
	}
	err = r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.TaskProgressTracker.PendingItems(ctx, id, itemType, pageOffset)
		return err
	})
	return
}

func (r *queryResolver) TaskProgressPreview(ctx context.Context, tagID string, itemTypes []string) (ret int, err error) {
	id, err := strconv.Atoi(tagID)
	if err != nil {
		return 0, err
	}
	types, err := taskProgressItemTypesCustom(itemTypes)
	if err != nil {
		return 0, err
	}
	err = r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.TaskProgressTracker.CountDirectlyTaggedItems(ctx, id, types)
		return err
	})
	return
}
