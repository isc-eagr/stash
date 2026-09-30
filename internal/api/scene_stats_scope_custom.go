package api

import (
	"fmt"
	"strconv"
)

// sceneStatsSceneScopeCustom returns the selected_scenes CTE shared by every
// SceneStats aggregate. A nil studio keeps the dashboard global; a studio ID
// applies the same depth semantics as the studio detail page. The optional
// date range narrows the scene set by release date, date added, or O date.
func sceneStatsSceneScopeCustom(studioID *string, depth *int, dateRange *statsDateRangeCustom) (string, []interface{}, error) {
	if studioID == nil {
		scope, args := activityStatsSceneScopeCustom(nil, nil, dateRange)
		return scope, args, nil
	}

	parsedID, err := strconv.Atoi(*studioID)
	if err != nil || parsedID < 1 {
		return "", nil, fmt.Errorf("invalid studio ID: %s", *studioID)
	}

	scope, args := activityStatsSceneScopeCustom(&parsedID, depth, dateRange)
	return scope, args, nil
}

// sceneStatsInputScopeCustom parses the GraphQL date range and builds the
// scene scope in one step for resolvers.
func sceneStatsInputScopeCustom(studioID *string, depth *int, dateRangeInput *StatsDateRangeInput) (string, []interface{}, *statsDateRangeCustom, error) {
	dateRange, err := parseStatsDateRangeCustom(dateRangeInput)
	if err != nil {
		return "", nil, nil, err
	}
	scope, args, err := sceneStatsSceneScopeCustom(studioID, depth, dateRange)
	return scope, args, dateRange, err
}
