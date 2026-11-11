package sqlite

// CUSTOM: Flattened scene-marker tag ancestry for scene-card insights.

import (
	"context"
	"fmt"
)

type sceneMarkerTagAncestorRowCustom struct {
	TagID      int `db:"tag_id"`
	AncestorID int `db:"ancestor_id"`
}

// FindTagAncestorIDsBySceneIDCustom returns every ancestor for each direct
// primary or secondary tag used by a marker in the scene. The recursive CTE
// handles arbitrary hierarchy depth and cycles without issuing one query per
// tag.
func (qb *SceneMarkerStore) FindTagAncestorIDsBySceneIDCustom(ctx context.Context, sceneID int) (map[int][]int, error) {
	return findMarkerTagAncestorIDsCustom(ctx, "scene_id", sceneID)
}

// FindMarkerTagAncestorIDsCustom is the release form of
// FindTagAncestorIDsBySceneIDCustom, over the release's own markers.
func (qb *SceneReleaseStore) FindMarkerTagAncestorIDsCustom(ctx context.Context, releaseID int) (map[int][]int, error) {
	return findMarkerTagAncestorIDsCustom(ctx, "release_id", releaseID)
}

// ownerColumn is a fixed column name, never user input.
func findMarkerTagAncestorIDsCustom(ctx context.Context, ownerColumn string, ownerID int) (map[int][]int, error) {
	query := fmt.Sprintf(`WITH RECURSIVE
direct_tags(tag_id) AS (
	SELECT primary_tag_id FROM scene_markers WHERE %[1]s = ?
	UNION
	SELECT smt.tag_id
	FROM scene_markers_tags smt
	JOIN scene_markers sm ON sm.id = smt.scene_marker_id
	WHERE sm.%[1]s = ?
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
ORDER BY tag_id, ancestor_id`, ownerColumn)

	var rows []sceneMarkerTagAncestorRowCustom
	if err := dbWrapper.Select(ctx, &rows, query, ownerID, ownerID); err != nil {
		return nil, err
	}

	ret := make(map[int][]int)
	for _, row := range rows {
		ret[row.TagID] = append(ret[row.TagID], row.AncestorID)
	}

	return ret, nil
}
