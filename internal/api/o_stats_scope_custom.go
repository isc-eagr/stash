package api

import (
	"fmt"
	"strconv"
)

// sceneOStatsScopeCustom builds a reusable studio-tree and O-date filter for
// queries that read recorded O events through the scenes_o_dates alias `od`.
// O Stats always applies the date range to the local O date.
func sceneOStatsScopeCustom(studioID *string, depth *int, dateRangeInput *StatsDateRangeInput) (string, []interface{}, error) {
	dateRange, err := parseStatsDateRangeCustom(dateRangeInput)
	if err != nil {
		return "", nil, err
	}
	rangeSQL, rangeArgs := dateRange.oStatsWhereSQL("od")
	if studioID == nil {
		return rangeSQL, rangeArgs, nil
	}

	parsedID, err := strconv.Atoi(*studioID)
	if err != nil || parsedID < 1 {
		return "", nil, fmt.Errorf("invalid studio ID: %s", *studioID)
	}

	depthValue := 0
	if depth != nil {
		depthValue = *depth
	}

	return `
  AND od.scene_id IN (
    WITH RECURSIVE selected_studios(id, depth) AS (
      SELECT ?, 0
      UNION ALL
      SELECT child.id, selected_studios.depth + 1
      FROM studios child
      JOIN selected_studios ON child.parent_id = selected_studios.id
      WHERE ? = -1 OR selected_studios.depth < ?
    )
    SELECT scenes.id
    FROM scenes
    WHERE scenes.studio_id IN (SELECT id FROM selected_studios)
  )` + rangeSQL, append([]interface{}{parsedID, depthValue, depthValue}, rangeArgs...), nil
}
