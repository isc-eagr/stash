package api

// CUSTOM: statsWeightedMarkerCountQueryCustom is shared by orgasm/facial
// totals. Each marker counts once per assigned top, with a minimum of one.
const statsWeightedMarkerCountQueryCustom = `
WITH RECURSIVE target_tags(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION ALL
  SELECT tr.child_id FROM tags_relations tr JOIN target_tags tt ON tr.parent_id = tt.id
),
second_camera_tags(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION ALL
  SELECT tr.child_id FROM tags_relations tr JOIN second_camera_tags sct ON tr.parent_id = sct.id
),
matching_markers AS (
  SELECT DISTINCT sm.id
  FROM scene_markers sm
  LEFT JOIN scene_markers_tags smt ON smt.scene_marker_id = sm.id
  WHERE (sm.primary_tag_id IN (SELECT id FROM target_tags)
     OR smt.tag_id IN (SELECT id FROM target_tags))
    AND sm.primary_tag_id NOT IN (SELECT id FROM second_camera_tags)
    AND NOT EXISTS (
      SELECT 1 FROM scene_markers_tags smt2
      WHERE smt2.scene_marker_id = sm.id
        AND smt2.tag_id IN (SELECT id FROM second_camera_tags)
    )
)
SELECT COALESCE(SUM(CASE WHEN top_count > 0 THEN top_count ELSE 1 END), 0)
FROM (
  SELECT mm.id, (
    SELECT COUNT(*)
    FROM scene_marker_performers smp
    WHERE smp.scene_marker_id = mm.id AND smp.role = 'top'
  ) AS top_count
  FROM matching_markers mm
) marker_counts`

// CUSTOM: performerRoleTagCountQueryCustom matches the performer marker filter:
// primary and secondary tags both include the complete configured tag family.
const performerRoleTagCountQueryCustom = `
WITH RECURSIVE target_tags(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION ALL
  SELECT tr.child_id FROM tags_relations tr JOIN target_tags tt ON tr.parent_id = tt.id
)
SELECT COUNT(DISTINCT smp.performer_id)
FROM scene_marker_performers smp
JOIN scene_markers sm ON sm.id = smp.scene_marker_id
WHERE smp.role = ?
  AND (sm.primary_tag_id IN (SELECT id FROM target_tags)
    OR EXISTS (
      SELECT 1 FROM scene_markers_tags smt
      WHERE smt.scene_marker_id = sm.id AND smt.tag_id IN (SELECT id FROM target_tags)
    ))`
