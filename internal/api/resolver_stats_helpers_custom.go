package api

import (
	"context"
	"fmt"
	"strconv"

	"github.com/stashapp/stash/internal/manager"
	"github.com/stashapp/stash/internal/manager/config"
)

func customStatsIntValue(value interface{}) int {
	switch value := value.(type) {
	case int64:
		return int(value)
	case int:
		return value
	case []byte:
		result, _ := strconv.Atoi(string(value))
		return result
	case string:
		result, _ := strconv.Atoi(value)
		return result
	default:
		result, _ := strconv.Atoi(fmt.Sprint(value))
		return result
	}
}

func customStatsStringValue(value interface{}) string {
	switch value := value.(type) {
	case string:
		return value
	case []byte:
		return string(value)
	default:
		return fmt.Sprint(value)
	}
}

func customStatsFloatValue(value interface{}) float64 {
	switch value := value.(type) {
	case float64:
		return value
	case int64:
		return float64(value)
	case int:
		return float64(value)
	case []byte:
		result, _ := strconv.ParseFloat(string(value), 64)
		return result
	case string:
		result, _ := strconv.ParseFloat(value, 64)
		return result
	default:
		result, _ := strconv.ParseFloat(fmt.Sprint(value), 64)
		return result
	}
}

func customStatsFirstInt(rows [][]interface{}) int {
	if len(rows) == 0 || len(rows[0]) == 0 {
		return 0
	}

	return customStatsIntValue(rows[0][0])
}

func configuredRoleTagIDCustom(uiConfig map[string]interface{}, key string) int {
	roleTagIDs, _ := uiConfig["roleTagIds"].(map[string]interface{})
	value, _ := roleTagIDs[key].(string)
	result, _ := strconv.Atoi(value)
	return result
}

func (r *queryResolver) sceneWeightedMarkerCountCustom(ctx context.Context, roleTagKey string, studioID *string, depth *int, dateRange *StatsDateRangeInput) (count int, err error) {
	sceneScope, sceneScopeArgs, _, err := sceneStatsInputScopeCustom(studioID, depth, dateRange)
	if err != nil {
		return 0, err
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		uiConfig := config.GetInstance().GetUIConfiguration()
		tagID := configuredRoleTagIDCustom(uiConfig, roleTagKey)
		if tagID == 0 {
			return nil
		}

		secondCameraTagID := configuredRoleTagIDCustom(uiConfig, "secondCameraTagId")
		args := append(append([]interface{}{}, sceneScopeArgs...), tagID, secondCameraTagID)
		_, rows, err := manager.GetInstance().Database.QuerySQL(ctx, statsWeightedMarkerCountScopedQueryCustom(sceneScope), args)
		if err != nil {
			return err
		}
		count = customStatsFirstInt(rows)
		return nil
	}); err != nil {
		return 0, err
	}

	return count, nil
}

func (r *queryResolver) totalWeightedMarkerTimeCustom(ctx context.Context, roleTagKey string, studioID *string, depth *int, dateRange *StatsDateRangeInput) (totalSeconds float64, err error) {
	sceneScope, sceneScopeArgs, _, err := sceneStatsInputScopeCustom(studioID, depth, dateRange)
	if err != nil {
		return 0, err
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		uiConfig := config.GetInstance().GetUIConfiguration()
		tagID := configuredRoleTagIDCustom(uiConfig, roleTagKey)
		if tagID == 0 {
			return nil
		}

		secondCameraTagID := configuredRoleTagIDCustom(uiConfig, "secondCameraTagId")
		secondCameraCTE := ""
		secondCameraExclude := ""
		args := append(append([]interface{}{}, sceneScopeArgs...), tagID)
		if secondCameraTagID > 0 {
			secondCameraCTE = `,
second_camera_tags(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION ALL
  SELECT tr.child_id FROM tags_relations tr JOIN second_camera_tags sct ON tr.parent_id = sct.id
)`
			secondCameraExclude = `
  AND sm.id NOT IN (
    SELECT smt2.scene_marker_id FROM scene_markers_tags smt2
    WHERE smt2.tag_id IN (SELECT id FROM second_camera_tags)
  )`
			args = append(args, secondCameraTagID)
		}

		query := sceneScope + `,
target_tags(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION ALL
  SELECT tr.child_id FROM tags_relations tr JOIN target_tags tt ON tr.parent_id = tt.id
)` + secondCameraCTE + `,
matching_markers AS (
  SELECT DISTINCT sm.id, sm.seconds, sm.end_seconds
  FROM scene_markers sm
  LEFT JOIN scene_markers_tags smt ON smt.scene_marker_id = sm.id
  WHERE (sm.primary_tag_id IN (SELECT id FROM target_tags)
     OR smt.tag_id IN (SELECT id FROM target_tags))
    AND sm.scene_id IN (SELECT id FROM selected_scenes)` + secondCameraExclude + `
)
SELECT COALESCE(SUM(
  (CASE WHEN end_seconds IS NOT NULL THEN end_seconds - seconds ELSE 20.0 END)
  *
  (CASE WHEN top_count > 0 THEN top_count ELSE 1 END)
), 0) AS total_time
FROM (
  SELECT mm.id, mm.seconds, mm.end_seconds,
    (SELECT COUNT(*) FROM scene_marker_performers smp WHERE smp.scene_marker_id = mm.id AND smp.role = 'top') AS top_count
  FROM matching_markers mm
) sub`
		_, rows, err := manager.GetInstance().Database.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 && rows[0][0] != nil {
			totalSeconds = customStatsFloatValue(rows[0][0])
		}
		return nil
	}); err != nil {
		return 0, err
	}

	return totalSeconds, nil
}
