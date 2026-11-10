package api

import (
	"context"

	"github.com/stashapp/stash/internal/api/urlbuilders"
	"github.com/stashapp/stash/pkg/models"
)

func (r *performerImageResolver) ImagePath(ctx context.Context, obj *models.PerformerImage) (string, error) {
	baseURL, _ := ctx.Value(BaseURLCtxKey).(string)
	imagePath := urlbuilders.NewPerformerImageURLBuilder(baseURL, obj).GetPerformerImageURL()
	return imagePath, nil
}
