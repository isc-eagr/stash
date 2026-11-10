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

// weightedMarkerCountInScopeCustom counts role markers in the selected scenes,
// once per assigned top (minimum one), excluding 2nd-camera markers. Call it
// inside a read transaction.
func weightedMarkerCountInScopeCustom(ctx context.Context, roleTagKey string, sceneScope string, sceneScopeArgs []interface{}) (int, error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	tagID := configuredRoleTagIDCustom(uiConfig, roleTagKey)
	if tagID == 0 {
		return 0, nil
	}

	secondCameraTagID := configuredRoleTagIDCustom(uiConfig, "secondCameraTagId")
	args := append(append([]interface{}{}, sceneScopeArgs...), tagID, secondCameraTagID)
	_, rows, err := manager.GetInstance().Database.QuerySQL(ctx, statsWeightedMarkerCountScopedQueryCustom(sceneScope), args)
	if err != nil {
		return 0, err
	}
	return customStatsFirstInt(rows), nil
}
