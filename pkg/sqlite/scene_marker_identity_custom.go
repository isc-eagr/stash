package sqlite

import (
	"fmt"
	"sort"
	"strings"

	"github.com/stashapp/stash/pkg/models"
)

// Bind repeated unnamed IDs once per scene, then evaluate each complete marker
// configuration with those bindings. Reusing the normal group builder preserves
// its tag inheritance, attribute, distinct-slot, and top/bottom AND/OR semantics.
func sceneMarkerSharedIdentityClauseCustom(
	groups []models.SceneMarkerTagGroupInput,
	sceneID string,
	build func(models.SceneMarkerTagGroupInput, string, map[string]string) (string, []any),
) (string, []any) {
	uses := make(map[string]map[int]bool)
	for i, group := range groups {
		for _, slots := range [][]models.UnnamedPerformerCriterionInput{group.TopUnnamedPerformers, group.BottomUnnamedPerformers, group.BothRolesUnnamedPerformers} {
			for _, slot := range slots {
				if slot.ID == nil || *slot.ID == "" {
					continue
				}
				if uses[*slot.ID] == nil {
					uses[*slot.ID] = make(map[int]bool)
				}
				uses[*slot.ID][i] = true
			}
		}
	}
	var ids []string
	for id, groupUses := range uses {
		if len(groupUses) > 1 {
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		return "", nil
	}
	sort.Strings(ids)
	bindings := make(map[string]string)
	groupUses := make(map[int]bool)
	var from []string
	for i, id := range ids {
		alias := fmt.Sprintf("sm_shared_person_%d", i)
		bindings[id] = alias + ".performer_id"
		from = append(from, fmt.Sprintf(`(
SELECT DISTINCT shared_role.performer_id
FROM scene_markers shared_marker
JOIN scene_marker_performers shared_role ON shared_role.scene_marker_id = shared_marker.id
WHERE shared_marker.scene_id = %s
) AS %s`, sceneID, alias))
		for groupIndex := range uses[id] {
			groupUses[groupIndex] = true
		}
	}
	var groupIndexes []int
	for groupIndex := range groupUses {
		groupIndexes = append(groupIndexes, groupIndex)
	}
	sort.Ints(groupIndexes)
	for _, groupIndex := range groupIndexes {
		from = append(from, fmt.Sprintf("scene_markers sm_shared_marker_%d", groupIndex))
	}
	var conditions []string
	var args []any
	for _, groupIndex := range groupIndexes {
		group := groups[groupIndex]
		alias := fmt.Sprintf("sm_shared_marker_%d", groupIndex)
		condition, groupArgs := build(group, alias, bindings)
		conditions = append(conditions, fmt.Sprintf("%s.scene_id = %s AND (%s)", alias, sceneID, condition))
		args = append(args, groupArgs...)
	}
	for i, leftID := range ids {
		for _, rightID := range ids[i+1:] {
			conditions = append(conditions, fmt.Sprintf("%s != %s", bindings[leftID], bindings[rightID]))
		}
	}
	for i, left := range groupIndexes {
		for _, right := range groupIndexes[i+1:] {
			conditions = append(conditions, fmt.Sprintf("sm_shared_marker_%d.id != sm_shared_marker_%d.id", left, right))
		}
	}
	return fmt.Sprintf("EXISTS (SELECT 1 FROM %s WHERE %s)", strings.Join(from, ", "), strings.Join(conditions, " AND ")), args
}
