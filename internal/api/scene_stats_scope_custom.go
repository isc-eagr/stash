package api

import (
	"fmt"
	"strconv"
)

// sceneStatsSceneScopeCustom returns the selected_scenes CTE shared by every
// SceneStats aggregate. A nil studio keeps the dashboard global; a studio ID
// applies the same depth semantics as the studio detail page.
func sceneStatsSceneScopeCustom(studioID *string, depth *int) (string, []interface{}, error) {
	if studioID == nil {
		scope, args := activityStatsSceneScopeCustom(nil, nil)
		return scope, args, nil
	}

	parsedID, err := strconv.Atoi(*studioID)
	if err != nil || parsedID < 1 {
		return "", nil, fmt.Errorf("invalid studio ID: %s", *studioID)
	}

	scope, args := activityStatsSceneScopeCustom(&parsedID, depth)
	return scope, args, nil
}
