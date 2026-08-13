package api

import (
	"context"
	"fmt"
	"strconv"
	"strings"

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

func (r *queryResolver) performerEthnicityCountsCustom(ctx context.Context, fiveStarOnly bool) (ret []*PerformerEthnicityCount, err error) {
	query := "SELECT ethnicity, COUNT(*) as cnt FROM performers WHERE ethnicity IS NOT NULL AND TRIM(ethnicity) <> '' GROUP BY ethnicity ORDER BY cnt DESC"
	if fiveStarOnly {
		query = "SELECT ethnicity, COUNT(*) as cnt FROM performers WHERE rating IS NOT NULL AND rating >= 90 AND ethnicity IS NOT NULL AND TRIM(ethnicity) <> '' GROUP BY ethnicity ORDER BY cnt DESC"
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		_, rows, err := db.QuerySQL(ctx, query, nil)
		if err != nil {
			return err
		}

		ret = make([]*PerformerEthnicityCount, 0, len(rows))
		for _, row := range rows {
			if len(row) < 2 {
				continue
			}
			ret = append(ret, &PerformerEthnicityCount{
				Ethnicity: customStatsStringValue(row[0]),
				Count:     customStatsIntValue(row[1]),
			})
		}
		return nil
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

func (r *queryResolver) sceneWeightedMarkerCountCustom(ctx context.Context, roleTagKey string, studioID *string, depth *int) (count int, err error) {
	sceneScope, sceneScopeArgs, err := sceneStatsSceneScopeCustom(studioID, depth)
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

func (r *queryResolver) performerRoleTagCountCustom(ctx context.Context, roleTagKey string, role string) (count int, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		tagID := configuredRoleTagIDCustom(config.GetInstance().GetUIConfiguration(), roleTagKey)
		if tagID == 0 {
			return nil
		}

		_, rows, err := manager.GetInstance().Database.QuerySQL(ctx, performerRoleTagCountQueryCustom, []interface{}{tagID, role})
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

func (r *queryResolver) performerFacialRoleCountCustom(ctx context.Context, role string) (count int, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		tagID := configuredRoleTagIDCustom(config.GetInstance().GetUIConfiguration(), "facialTagId")
		if tagID == 0 {
			return nil
		}

		const query = `
WITH RECURSIVE facial_tags(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION ALL
  SELECT tr.child_id FROM tags_relations tr JOIN facial_tags ft ON tr.parent_id = ft.id
),
facial_markers AS (
  SELECT DISTINCT sm.id
  FROM scene_markers sm
  LEFT JOIN scene_markers_tags smt ON smt.scene_marker_id = sm.id
  WHERE sm.primary_tag_id IN (SELECT id FROM facial_tags)
     OR smt.tag_id IN (SELECT id FROM facial_tags)
)
SELECT COUNT(DISTINCT smp.performer_id)
FROM scene_marker_performers smp
WHERE smp.scene_marker_id IN (SELECT id FROM facial_markers)
  AND smp.role = ?`
		_, rows, err := manager.GetInstance().Database.QuerySQL(ctx, query, []interface{}{tagID, role})
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

func (r *queryResolver) totalWeightedMarkerTimeCustom(ctx context.Context, roleTagKey string, studioID *string, depth *int) (totalSeconds float64, err error) {
	sceneScope, sceneScopeArgs, err := sceneStatsSceneScopeCustom(studioID, depth)
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

func (r *queryResolver) performersStrictRoleCountCustom(ctx context.Context, role string, oppositeRole string) (count int, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		uiConfig := config.GetInstance().GetUIConfiguration()
		tagIDs := []int{
			configuredRoleTagIDCustom(uiConfig, "sexTagId"),
			configuredRoleTagIDCustom(uiConfig, "oralTagId"),
			configuredRoleTagIDCustom(uiConfig, "facialTagId"),
		}
		tagIDStrings := make([]string, 0, len(tagIDs))
		for _, tagID := range tagIDs {
			if tagID > 0 {
				tagIDStrings = append(tagIDStrings, strconv.Itoa(tagID))
			}
		}
		if len(tagIDStrings) == 0 {
			return nil
		}

		tagList := strings.Join(tagIDStrings, ",")
		query := fmt.Sprintf(`
SELECT COUNT(DISTINCT smp.performer_id)
FROM scene_marker_performers smp
JOIN scene_markers sm ON sm.id = smp.scene_marker_id
LEFT JOIN scene_markers_tags smt ON smt.scene_marker_id = sm.id
WHERE smp.role = ?
  AND (sm.primary_tag_id IN (%s) OR smt.tag_id IN (%s))
  AND smp.performer_id NOT IN (
    SELECT DISTINCT smp2.performer_id
    FROM scene_marker_performers smp2
    JOIN scene_markers sm2 ON sm2.id = smp2.scene_marker_id
    LEFT JOIN scene_markers_tags smt2 ON smt2.scene_marker_id = sm2.id
    WHERE smp2.role = ?
      AND (sm2.primary_tag_id IN (%s) OR smt2.tag_id IN (%s))
  )`, tagList, tagList, tagList, tagList)
		_, rows, err := manager.GetInstance().Database.QuerySQL(ctx, query, []interface{}{role, oppositeRole})
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

func (r *queryResolver) performersLenientRoleCountCustom(ctx context.Context, roleAliasKey string, supportingAliasKey string, excludedAliasKey string) (count int, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		aliases := map[string]string{
			"top":        "top",
			"bottom":     "bottom",
			"oraltop":    "oraltop",
			"oralbottom": "oralbottom",
		}
		uiConfig := config.GetInstance().GetUIConfiguration()
		configuredAliases, _ := uiConfig["sceneTagAliases"].(map[string]interface{})
		for key, defaultValue := range aliases {
			if value, ok := configuredAliases[key].(string); ok && value != "" {
				aliases[key] = value
			} else {
				aliases[key] = defaultValue
			}
		}

		const query = `
SELECT COUNT(DISTINCT smp.performer_id)
FROM scene_marker_performers smp
JOIN scene_markers sm ON sm.id = smp.scene_marker_id
JOIN tags t ON t.id = sm.primary_tag_id
WHERE LOWER(TRIM(t.name)) = ?
  AND smp.performer_id IN (
    SELECT DISTINCT smp2.performer_id
    FROM scene_marker_performers smp2
    JOIN scene_markers sm2 ON sm2.id = smp2.scene_marker_id
    JOIN tags t2 ON t2.id = sm2.primary_tag_id
    WHERE LOWER(TRIM(t2.name)) = ?
  )
  AND smp.performer_id NOT IN (
    SELECT DISTINCT smp3.performer_id
    FROM scene_marker_performers smp3
    JOIN scene_markers sm3 ON sm3.id = smp3.scene_marker_id
    JOIN tags t3 ON t3.id = sm3.primary_tag_id
    WHERE LOWER(TRIM(t3.name)) = ?
  )`
		args := []interface{}{
			strings.ToLower(aliases[roleAliasKey]),
			strings.ToLower(aliases[supportingAliasKey]),
			strings.ToLower(aliases[excludedAliasKey]),
		}
		_, rows, err := manager.GetInstance().Database.QuerySQL(ctx, query, args)
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
