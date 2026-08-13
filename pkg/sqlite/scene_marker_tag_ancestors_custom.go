package sqlite

// CUSTOM: Flattened scene-marker tag ancestry for scene-card insights.

import "context"

type sceneMarkerTagAncestorRowCustom struct {
	TagID      int `db:"tag_id"`
	AncestorID int `db:"ancestor_id"`
}

// FindTagAncestorIDsBySceneIDCustom returns every ancestor for each direct
// primary or secondary tag used by a marker in the scene. The recursive CTE
// handles arbitrary hierarchy depth and cycles without issuing one query per
// tag.
func (qb *SceneMarkerStore) FindTagAncestorIDsBySceneIDCustom(ctx context.Context, sceneID int) (map[int][]int, error) {
	const query = `WITH RECURSIVE
direct_tags(tag_id) AS (
	SELECT primary_tag_id FROM scene_markers WHERE scene_id = ?
	UNION
	SELECT smt.tag_id
	FROM scene_markers_tags smt
	JOIN scene_markers sm ON sm.id = smt.scene_marker_id
	WHERE sm.scene_id = ?
),
tag_ancestors(tag_id, ancestor_id) AS (
	SELECT tag_id, tag_id FROM direct_tags
	UNION
	SELECT ta.tag_id, tr.parent_id
	FROM tag_ancestors ta
	JOIN tags_relations tr ON tr.child_id = ta.ancestor_id
)
SELECT tag_id, ancestor_id
FROM tag_ancestors
WHERE ancestor_id != tag_id
ORDER BY tag_id, ancestor_id`

	var rows []sceneMarkerTagAncestorRowCustom
	if err := dbWrapper.Select(ctx, &rows, query, sceneID, sceneID); err != nil {
		return nil, err
	}

	ret := make(map[int][]int)
	for _, row := range rows {
		ret[row.TagID] = append(ret[row.TagID], row.AncestorID)
	}

	return ret, nil
}
