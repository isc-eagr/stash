package sqlite

// sceneMarkerTagFamilyForFilterCustom returns matching markers using tag indexes in
// both directions. The root ID is bound once. UNION deduplicates multiple ancestry
// paths and terminates even when an imported hierarchy contains a cycle.
func sceneMarkerTagFamilyForFilterCustom(f *filterBuilder) (string, []interface{}) {
	prefix := `WITH RECURSIVE family(id) AS (
 SELECT id FROM tags WHERE id = ?
 UNION SELECT tr.child_id FROM tags_relations tr JOIN family f ON tr.parent_id = f.id
 )`
	if len(f.whereClauses) == 0 {
		return prefix + `
SELECT id, scene_id FROM scene_markers WHERE primary_tag_id IN (SELECT id FROM family)
UNION
SELECT sm.id, sm.scene_id FROM scene_markers_tags mt
JOIN scene_markers sm ON sm.id = mt.scene_marker_id
WHERE mt.tag_id IN (SELECT id FROM family)`, nil
	}
	// Keep work proportional to the local AND scope when another criterion has
	// already narrowed it. Never restrict a sibling OR/NOT branch's candidates.
	scope := *f
	scope.subFilter = nil
	scope.havingClauses = nil
	q := sceneRepository.newQuery()
	distinctIDs(&q, sceneTable)
	if err := q.addFilter(&scope); err != nil {
		f.setError(err)
		return "SELECT id, scene_id FROM scene_markers WHERE 0", nil
	}
	return prefix + `, candidates AS MATERIALIZED (` + q.toSQL(false) + `)
SELECT sm.id, sm.scene_id FROM candidates c
CROSS JOIN scene_markers sm ON sm.scene_id = c.id
WHERE sm.primary_tag_id IN (SELECT id FROM family)
UNION
SELECT sm.id, sm.scene_id FROM candidates c
CROSS JOIN scene_markers sm ON sm.scene_id = c.id
JOIN scene_markers_tags mt ON mt.scene_marker_id = sm.id
WHERE mt.tag_id IN (SELECT id FROM family)`, q.allArgs()
}
