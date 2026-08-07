package api

import (
	"context"
	"strconv"

	"github.com/stashapp/stash/internal/manager"
	"github.com/stashapp/stash/internal/manager/config"
)

func sceneStatsActivityTimeQueryCustom(sceneScope string) string {
	return sceneScope + `
SELECT
  sm.scene_id,
  sm.seconds,
  sm.end_seconds,
  COALESCE(MAX(vf.duration), 0)
FROM scene_markers sm
LEFT JOIN scenes_files sf ON sf.scene_id = sm.scene_id
LEFT JOIN video_files vf ON vf.file_id = sf.file_id
WHERE sm.scene_id IN (SELECT id FROM selected_scenes)
  AND sm.primary_tag_id = ?
  AND sm.end_seconds IS NOT NULL
  AND sm.end_seconds > sm.seconds
GROUP BY sm.id, sm.scene_id, sm.seconds, sm.end_seconds`
}

func sceneStatsActivityTimeFromRowsCustom(rows [][]interface{}) float64 {
	intervals := []activityIntervalCustom{}
	for _, row := range rows {
		if len(row) < 4 {
			continue
		}

		sceneID := activityStatsIntCustom(row[0])
		start := activityStatsFloatCustom(row[1])
		end := activityStatsFloatCustom(row[2])
		sceneDuration := activityStatsFloatCustom(row[3])
		if sceneDuration <= 0 {
			continue
		}
		if start < 0 {
			start = 0
		}
		if end > sceneDuration {
			end = sceneDuration
		}
		if end <= start {
			continue
		}

		intervals = append(intervals, activityIntervalCustom{
			sceneID: sceneID,
			start:   start,
			end:     end,
		})
	}

	return activityStatsDurationCustom(intervals)
}

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

		args := append(append([]interface{}{}, sceneScopeArgs...), tagID)
		_, rows, err := manager.GetInstance().Database.QuerySQL(
			ctx,
			sceneStatsActivityTimeQueryCustom(sceneScope),
			args,
		)
		if err != nil {
			return err
		}
		totalSeconds = sceneStatsActivityTimeFromRowsCustom(rows)
		return nil
	}); err != nil {
		return 0, err
	}

	return totalSeconds, nil
}

// TotalSexTime returns the overlap-merged duration of completed sex activity
// markers. Activity markers match the configured sex tag as their primary tag.
func (r *queryResolver) TotalSexTime(ctx context.Context, studioID *string, depth *int) (float64, error) {
	return r.totalActivityTimeCustom(ctx, "sexTagId", studioID, depth)
}

// TotalOralTime returns the overlap-merged duration of completed oral activity
// markers. Activity markers match the configured oral tag as their primary tag.
func (r *queryResolver) TotalOralTime(ctx context.Context, studioID *string, depth *int) (float64, error) {
	return r.totalActivityTimeCustom(ctx, "oralTagId", studioID, depth)
}
