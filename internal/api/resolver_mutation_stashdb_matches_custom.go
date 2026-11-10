package api

// CUSTOM: StashDB Matches refresh task.

import (
	"context"
	"strconv"

	"github.com/stashapp/stash/internal/manager"
)

func (r *mutationResolver) RefreshStashDBMatches(ctx context.Context) (string, error) {
	jobID, err := manager.GetInstance().RefreshStashDBMatchesCustom(ctx)
	if err != nil {
		return "", err
	}
	return strconv.Itoa(jobID), nil
}
