package api

// CUSTOM: Vato Stats top → bottom grids. One row per scene, activity, top,
// and bottom who share a Sex or Oral primary-tag marker. Every scene in the
// page's scope counts, organized or not, so cells match the marker filter
// their scenes open in.

import (
	"context"
	"strconv"
	"strings"

	"github.com/stashapp/stash/internal/manager"
	"github.com/stashapp/stash/internal/manager/config"
)

func vatoStatsRolePairsQueryCustom(sceneScope string, sexTagID int, oralTagID int) (string, []interface{}) {
	var rootRows []string
	var args []interface{}
	for _, root := range []struct {
		category string
		id       int
	}{{"sex", sexTagID}, {"oral", oralTagID}} {
		if root.id <= 0 {
			continue
		}
		rootRows = append(rootRows, "(?, '"+root.category+"')")
		args = append(args, root.id)
	}
	if len(rootRows) == 0 {
		return "", nil
	}

	return sceneScope + `,
role_tag_roots(id, category) AS (
  VALUES ` + strings.Join(rootRows, ",") + `
),
role_tags(id, category) AS (
  SELECT id, category FROM role_tag_roots
  UNION
  SELECT tr.child_id, rt.category
  FROM tags_relations tr
  JOIN role_tags rt ON rt.id = tr.parent_id
)
SELECT DISTINCT rt.category, sm.scene_id, top.performer_id, bottom.performer_id
FROM scene_markers sm
JOIN role_tags rt ON rt.id = sm.primary_tag_id
JOIN scene_marker_performers top ON top.scene_marker_id = sm.id AND top.role = 'top'
JOIN scene_marker_performers bottom ON bottom.scene_marker_id = sm.id AND bottom.role = 'bottom'
WHERE sm.scene_id IN (SELECT id FROM selected_scenes)
  AND top.performer_id <> bottom.performer_id
ORDER BY rt.category, sm.scene_id, top.performer_id, bottom.performer_id`, args
}

func (r *queryResolver) VatoStatsRolePairs(ctx context.Context, studioID *string, depth *int, dateRangeInput *StatsDateRangeInput) (ret []*VatoStatsRolePair, err error) {
	sceneScope, sceneScopeArgs, _, err := sceneStatsInputScopeCustom(studioID, depth, dateRangeInput)
	if err != nil {
		return nil, err
	}
	uiConfig := config.GetInstance().GetUIConfiguration()
	query, tagArgs := vatoStatsRolePairsQueryCustom(
		sceneScope,
		configuredRoleTagIDCustom(uiConfig, "sexTagId"),
		configuredRoleTagIDCustom(uiConfig, "oralTagId"),
	)
	ret = []*VatoStatsRolePair{}
	if query == "" {
		return ret, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		_, rows, err := manager.GetInstance().Database.QuerySQL(ctx, query, append(sceneScopeArgs, tagArgs...))
		if err != nil {
			return err
		}
		for _, row := range rows {
			if len(row) < 4 {
				continue
			}
			activity := VatoStatsRolePairActivitySex
			if customStringValue(row[0]) == "oral" {
				activity = VatoStatsRolePairActivityOral
			}
			ret = append(ret, &VatoStatsRolePair{
				Activity: activity,
				SceneID:  strconv.Itoa(customIntValue(row[1])),
				TopID:    strconv.Itoa(customIntValue(row[2])),
				BottomID: strconv.Itoa(customIntValue(row[3])),
			})
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return ret, nil
}
