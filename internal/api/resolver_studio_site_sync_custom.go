package api

// CUSTOM: Studio site sync.

import (
	"context"
	"strconv"

	"github.com/stashapp/stash/internal/manager"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/sitesync"
)

func (r *studioResolver) SiteSync(ctx context.Context, obj *models.Studio) (*models.StudioSiteSync, error) {
	key := sitesync.SiteKey(obj.Name)
	if key == "" {
		return nil, nil
	}
	site := sitesync.New(key, nil)
	_, pictures := site.(sitesync.PicsSite)
	return &models.StudioSiteSync{Name: site.Name(), Pictures: pictures}, nil
}

func (r *mutationResolver) StudioSiteSync(ctx context.Context, input StudioSiteSyncInput) (string, error) {
	id, err := strconv.Atoi(input.StudioID)
	if err != nil {
		return "", err
	}
	jobID, err := manager.GetInstance().StudioSiteSyncCustom(ctx, id, manager.StudioSiteSyncStepsCustom{
		Codes:     input.Codes,
		Metadata:  input.Metadata,
		Pictures:  input.Pictures,
		Galleries: input.Galleries,
	})
	if err != nil {
		return "", err
	}
	return strconv.Itoa(jobID), nil
}

func (r *queryResolver) StudioSiteSyncReport(ctx context.Context, studioID string) (*models.StudioSiteSyncReport, error) {
	id, err := strconv.Atoi(studioID)
	if err != nil {
		return nil, err
	}
	return manager.GetInstance().StudioSiteSyncReportCustom(id), nil
}
