package api

import "strings"

// vatoStatsRoleCountsQueryCustom calculates all sex, oral, and facial role
// counts in one marker scan. Sex and oral preserve their primary-tag-only
// semantics; facial also includes secondary tags and counts marker events.
func vatoStatsRoleCountsQueryCustom(
	sceneScope string,
	performerIDs []int,
	sexTagID int,
	oralTagID int,
	facialTagID int,
) (string, []interface{}) {
	type roleTagRoot struct {
		category string
		id       int
	}
	roots := []roleTagRoot{
		{category: "sex", id: sexTagID},
		{category: "oral", id: oralTagID},
		{category: "facial", id: facialTagID},
	}

	rootRows := make([]string, 0, len(roots))
	args := make([]interface{}, 0, len(roots)+len(performerIDs))
	for _, root := range roots {
		if root.id <= 0 {
			continue
		}
		rootRows = append(rootRows, "(?, '"+root.category+"')")
		args = append(args, root.id)
	}
	if len(rootRows) == 0 || len(performerIDs) == 0 {
		return "", nil
	}

	performerFilter, performerArgs := vatoStatsIDFilter("smp.performer_id", performerIDs)
	args = append(args, performerArgs...)

	return sceneScope + `,
role_tag_roots(id, category) AS (
  VALUES ` + strings.Join(rootRows, ",") + `
),
role_tags(id, category) AS (
  SELECT id, category FROM role_tag_roots
  UNION ALL
  SELECT tr.child_id, rt.category
  FROM tags_relations tr
  JOIN role_tags rt ON rt.id = tr.parent_id
),
marker_categories(marker_id, scene_id, category) AS (
  SELECT sm.id, sm.scene_id, rt.category
  FROM scene_markers sm
  JOIN role_tags rt ON rt.id = sm.primary_tag_id
  WHERE sm.scene_id IN (SELECT id FROM selected_scenes)
  UNION
  SELECT sm.id, sm.scene_id, 'facial'
  FROM scene_markers sm
  JOIN scene_markers_tags smt ON smt.scene_marker_id = sm.id
  JOIN role_tags rt ON rt.id = smt.tag_id AND rt.category = 'facial'
  WHERE sm.scene_id IN (SELECT id FROM selected_scenes)
)
SELECT
  smp.performer_id,
  COUNT(DISTINCT CASE WHEN mc.category = 'sex' AND smp.role = 'top' THEN mc.scene_id END),
  COUNT(DISTINCT CASE WHEN mc.category = 'sex' AND smp.role = 'bottom' THEN mc.scene_id END),
  COUNT(DISTINCT CASE WHEN mc.category = 'oral' AND smp.role = 'top' THEN mc.scene_id END),
  COUNT(DISTINCT CASE WHEN mc.category = 'oral' AND smp.role = 'bottom' THEN mc.scene_id END),
  COUNT(DISTINCT CASE WHEN mc.category = 'facial' AND smp.role = 'top' THEN mc.marker_id END),
  COUNT(DISTINCT CASE WHEN mc.category = 'facial' AND smp.role = 'bottom' THEN mc.marker_id END)
FROM scene_marker_performers smp
JOIN marker_categories mc ON mc.marker_id = smp.scene_marker_id
WHERE 1 = 1` + performerFilter + `
GROUP BY smp.performer_id`, args
}
