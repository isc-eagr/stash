package api

import (
	"context"
	"strconv"

	"github.com/stashapp/stash/internal/manager"
	"github.com/stashapp/stash/internal/manager/config"
)

const sceneStatsActivityTimeQueryCustom = `
SELECT COALESCE(SUM(end_seconds - seconds), 0)
FROM scene_markers
WHERE primary_tag_id = ?
  AND end_seconds IS NOT NULL
  AND end_seconds > seconds`

func (r *queryResolver) totalActivityTimeCustom(ctx context.Context, roleTagKey string, studioID *string, depth *int) (float64, error) {
	var totalSeconds float64
	sceneScope, sceneScopeArgs, err := sceneStatsSceneScopeCustom(studioID, depth)
	if err != nil {
		return 0, err
	}
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		uiConfig := config.GetInstance().GetUIConfiguration()
		roleTagIDs, _ := uiConfig["roleTagIds"].(map[string]interface{})
		if roleTagIDs == nil {
			return nil
		}

		tagIDValue, _ := roleTagIDs[roleTagKey].(string)
		tagID, _ := strconv.Atoi(tagIDValue)
		if tagID == 0 {
			return nil
		}

		query := sceneScope + `
SELECT COALESCE(SUM(end_seconds - seconds), 0)
FROM scene_markers
WHERE scene_id IN (SELECT id FROM selected_scenes)
  AND primary_tag_id = ?
  AND end_seconds IS NOT NULL
  AND end_seconds > seconds`
		args := append(append([]interface{}{}, sceneScopeArgs...), tagID)
		_, rows, err := manager.GetInstance().Database.QuerySQL(
			ctx,
			query,
			args,
		)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 {
			totalSeconds = sceneStatsFloatValue(rows[0][0])
		}
		return nil
	}); err != nil {
		return 0, err
	}

	return totalSeconds, nil
}

// TotalSexTime returns the summed duration of completed sex activity markers.
// Activity markers match the configured sex tag as their primary tag. Each
// marker contributes once, regardless of its assigned performers.
func (r *queryResolver) TotalSexTime(ctx context.Context, studioID *string, depth *int) (float64, error) {
	return r.totalActivityTimeCustom(ctx, "sexTagId", studioID, depth)
}

// TotalOralTime returns the summed duration of completed oral activity markers.
// Activity markers match the configured oral tag as their primary tag. Each
// marker contributes once, regardless of its assigned performers.
func (r *queryResolver) TotalOralTime(ctx context.Context, studioID *string, depth *int) (float64, error) {
	return r.totalActivityTimeCustom(ctx, "oralTagId", studioID, depth)
}
