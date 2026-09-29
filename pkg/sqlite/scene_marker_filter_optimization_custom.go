package sqlite

func addSceneMarkerCircularOralFilterCustom(f *filterBuilder, tagID string) {
	// Resolve the tag family once, independently of each candidate marker.
	// UNION terminates cycles and deduplicates multiple ancestry paths.
	f.addWith(`marker_oral_tags(id) AS (
WITH RECURSIVE family(id) AS (
 SELECT id FROM tags WHERE id = ?
 UNION
 SELECT tr.child_id FROM tags_relations tr JOIN family ot ON tr.parent_id = ot.id
)
SELECT id FROM family)`, tagID)
	f.addWhere(`(scene_markers.primary_tag_id IN (SELECT id FROM marker_oral_tags)
 OR EXISTS (SELECT 1 FROM scene_markers_tags mt
  WHERE mt.scene_marker_id = scene_markers.id AND mt.tag_id IN (SELECT id FROM marker_oral_tags))
)
AND EXISTS (SELECT 1 FROM scene_marker_performers smp WHERE smp.scene_marker_id = scene_markers.id)
AND NOT EXISTS (
 SELECT 1 FROM scene_marker_performers smp
 WHERE smp.scene_marker_id = scene_markers.id AND (
  NOT EXISTS (SELECT 1 FROM scene_marker_performers role_top
   WHERE role_top.scene_marker_id = smp.scene_marker_id
     AND role_top.performer_id = smp.performer_id AND role_top.role = 'top')
  OR NOT EXISTS (SELECT 1 FROM scene_marker_performers role_bottom
   WHERE role_bottom.scene_marker_id = smp.scene_marker_id
     AND role_bottom.performer_id = smp.performer_id AND role_bottom.role = 'bottom')
 ))`)
}
