package api

// CUSTOM: Studio site sync.

import (
	"context"
	"strconv"

	"github.com/stashapp/stash/internal/manager"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/sitesync"
)

func (r *studioResolver) SiteSync(ctx context.Context, obj *models.Studio) (*string, error) {
	key := sitesync.SiteKey(obj.Name)
	if key == "" {
		return nil, nil
	}
	name := sitesync.New(key, nil).Name()
	return &name, nil
}

func (r *mutationResolver) StudioSiteSync(ctx context.Context, studioID string) (string, error) {
	id, err := strconv.Atoi(studioID)
	if err != nil {
		return "", err
	}
	jobID, err := manager.GetInstance().StudioSiteSyncCustom(ctx, id)
	if err != nil {
		return "", err
	}
	return strconv.Itoa(jobID), nil
}
