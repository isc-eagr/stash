package sqlite

import (
	"fmt"
	"strings"
)

// CUSTOM: Scene sorts by orgasm and facial marker counts. A marker counts when
// its primary or secondary tags include the configured role tag or a subtag.
// Really Hot variants also require the Really Hot tag on the same marker.
type sceneMarkerCountSortCustom struct {
	roleTag   func(RoleTagIDs) int
	reallyHot bool
}

var sceneMarkerCountSortKeysCustom = map[string]sceneMarkerCountSortCustom{
	"orgasm_count":            {roleTag: sceneMarkerCountOrgasmTagCustom},
	"really_hot_orgasm_count": {roleTag: sceneMarkerCountOrgasmTagCustom, reallyHot: true},
	"facial_count":            {roleTag: sceneMarkerCountFacialTagCustom},
	"really_hot_facial_count": {roleTag: sceneMarkerCountFacialTagCustom, reallyHot: true},
}

func sceneMarkerCountOrgasmTagCustom(tags RoleTagIDs) int { return tags.OrgasmTagID }
func sceneMarkerCountFacialTagCustom(tags RoleTagIDs) int { return tags.FacialTagID }

// tagIDs returns every tag a counted marker must carry, or nil when the needed
// role tags are not configured.
func (s sceneMarkerCountSortCustom) tagIDs(tags RoleTagIDs) []int {
	roleTagID := s.roleTag(tags)
	if roleTagID == 0 {
		return nil
	}
	if !s.reallyHot {
		return []int{roleTagID}
	}
	if tags.ReallyHotTagID == 0 {
		return nil
	}
	return []int{roleTagID, tags.ReallyHotTagID}
}

// sceneMarkerCountSourceSQLCustom counts, per scene, the markers carrying every
// tag in tagIDs.
func sceneMarkerCountSourceSQLCustom(tagIDs []int) string {
	conditions := make([]string, len(tagIDs))
	for i, tagID := range tagIDs {
		conditions[i] = sceneMarkerDirectTagHierarchyConditionCustom("scene_count_marker", tagID)
	}
	return fmt.Sprintf(`SELECT scene_count_marker.scene_id, COUNT(*) AS value
FROM scene_markers scene_count_marker
WHERE %s
GROUP BY scene_count_marker.scene_id`, strings.Join(conditions, " AND "))
}

// sortByMarkerCountCustom counts all matching markers once in a sort-only CTE
// instead of running a correlated count for every scene.
func (qb *SceneStore) sortByMarkerCountCustom(query *queryBuilder, sort sceneMarkerCountSortCustom, direction string) string {
	tagIDs := sort.tagIDs(GetRoleTagIDs())
	if len(tagIDs) == 0 {
		// A bare integer is an ORDER BY column ordinal in SQLite.
		return " ORDER BY (0 + 0) " + getSortDirection(direction)
	}

	const name = "scene_sort_marker_count_custom"
	query.addWith(false, name+" AS MATERIALIZED ("+sceneMarkerCountSourceSQLCustom(tagIDs)+")")
	query.addJoins(join{table: name, onClause: name + ".scene_id = scenes.id", sort: true})
	return " ORDER BY COALESCE(" + name + ".value, 0) " + getSortDirection(direction)
}
