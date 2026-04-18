package sqlite

import (
	"fmt"
	"strconv"

	"github.com/stashapp/stash/internal/manager/config"
)

// RoleTagIDs holds the configured role tag IDs from UI config
type RoleTagIDs struct {
	SexTagID    int
	OralTagID   int
	SoloTagID   int
	FacialTagID int
	OrgasmTagID int // CUSTOM: added for performer orgasm sort
	FeetTagID   int // CUSTOM: added for performer feet sort
}

// GetRoleTagIDs retrieves role tag IDs from UI configuration
func GetRoleTagIDs() RoleTagIDs {
	result := RoleTagIDs{}
	uiConfig := config.GetInstance().GetUIConfiguration()
	roleTagIds, _ := uiConfig["roleTagIds"].(map[string]interface{})
	if roleTagIds == nil {
		return result
	}

	if id, ok := roleTagIds["sexTagId"].(string); ok && id != "" {
		result.SexTagID, _ = strconv.Atoi(id)
	}
	if id, ok := roleTagIds["oralTagId"].(string); ok && id != "" {
		result.OralTagID, _ = strconv.Atoi(id)
	}
	if id, ok := roleTagIds["soloTagId"].(string); ok && id != "" {
		result.SoloTagID, _ = strconv.Atoi(id)
	}
	if id, ok := roleTagIds["facialTagId"].(string); ok && id != "" {
		result.FacialTagID, _ = strconv.Atoi(id)
	}
	if id, ok := roleTagIds["orgasmTagId"].(string); ok && id != "" {
		result.OrgasmTagID, _ = strconv.Atoi(id)
	}
	if id, ok := roleTagIds["feetTagId"].(string); ok && id != "" {
		result.FeetTagID, _ = strconv.Atoi(id)
	}
	return result
}

// sortByMarkerRoleSceneCount creates a sort query for counting distinct scenes
// that have scene markers with the specified tag (including ALL subtags recursively)
// Checks both primary_tag_id AND secondary tags in scene_markers_tags
func (qb *StudioStore) sortByMarkerRoleSceneCount(tagID int, direction string) string {
	if tagID == 0 {
		// If no tag is configured, sort as if count is 0
		return fmt.Sprintf(" ORDER BY 0 %s", getSortDirection(direction))
	}

	// Count distinct scenes for each studio that have markers with the tag or its descendants
	// Uses UNION ALL to check both primary tag and secondary tags (scene_markers_tags)
	// Using COALESCE to handle studios with no matching markers (count = 0)
	return fmt.Sprintf(` ORDER BY COALESCE((
		SELECT COUNT(DISTINCT s.id)
		FROM scenes s
		INNER JOIN scene_markers sm ON sm.scene_id = s.id
		WHERE s.studio_id = studios.id
		AND EXISTS (
			SELECT 1 FROM (
				SELECT sm.primary_tag_id AS tag_id
				UNION ALL
				SELECT smt.tag_id FROM scene_markers_tags smt WHERE smt.scene_marker_id = sm.id
			) marker_tags
			WHERE marker_tags.tag_id = %[1]d
			   OR marker_tags.tag_id IN (SELECT child_id FROM tags_relations WHERE parent_id = %[1]d)
			   OR marker_tags.tag_id IN (SELECT tr2.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id WHERE tr1.parent_id = %[1]d)
			   OR marker_tags.tag_id IN (SELECT tr3.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id WHERE tr1.parent_id = %[1]d)
			   OR marker_tags.tag_id IN (SELECT tr4.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id JOIN tags_relations tr4 ON tr4.parent_id = tr3.child_id WHERE tr1.parent_id = %[1]d)
		)
	), 0) %[2]s`, tagID, getSortDirection(direction))
}

// sortBySexSceneCount counts scenes with sex markers
func (qb *StudioStore) sortBySexSceneCount(direction string) string {
	roleTagIDs := GetRoleTagIDs()
	return qb.sortByMarkerRoleSceneCount(roleTagIDs.SexTagID, direction)
}

// sortByOralSceneCount counts scenes with oral markers but not sex markers
func (qb *StudioStore) sortByOralSceneCount(direction string) string {
	roleTagIDs := GetRoleTagIDs()
	if roleTagIDs.OralTagID == 0 {
		return fmt.Sprintf(" ORDER BY 0 %s", getSortDirection(direction))
	}

	// Build sex tag exclusion - exclude scenes that have ANY sex marker
	// Checks both primary and secondary tags
	sexExclude := ""
	if roleTagIDs.SexTagID != 0 {
		sexExclude = fmt.Sprintf(`
			AND s.id NOT IN (
				SELECT DISTINCT sm_sex.scene_id
				FROM scene_markers sm_sex
				WHERE EXISTS (
					SELECT 1 FROM (
						SELECT sm_sex.primary_tag_id AS tag_id
						UNION ALL
						SELECT smt_sex.tag_id FROM scene_markers_tags smt_sex WHERE smt_sex.scene_marker_id = sm_sex.id
					) sex_marker_tags
					WHERE sex_marker_tags.tag_id = %[1]d
					   OR sex_marker_tags.tag_id IN (SELECT child_id FROM tags_relations WHERE parent_id = %[1]d)
					   OR sex_marker_tags.tag_id IN (SELECT tr2.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id WHERE tr1.parent_id = %[1]d)
					   OR sex_marker_tags.tag_id IN (SELECT tr3.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id WHERE tr1.parent_id = %[1]d)
					   OR sex_marker_tags.tag_id IN (SELECT tr4.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id JOIN tags_relations tr4 ON tr4.parent_id = tr3.child_id WHERE tr1.parent_id = %[1]d)
				)
			)`, roleTagIDs.SexTagID)
	}

	// Count scenes with oral markers (including all subtags) excluding those with sex markers
	// Checks both primary and secondary tags
	return fmt.Sprintf(` ORDER BY COALESCE((
		SELECT COUNT(DISTINCT s.id)
		FROM scenes s
		INNER JOIN scene_markers sm ON sm.scene_id = s.id
		WHERE s.studio_id = studios.id
		AND EXISTS (
			SELECT 1 FROM (
				SELECT sm.primary_tag_id AS tag_id
				UNION ALL
				SELECT smt.tag_id FROM scene_markers_tags smt WHERE smt.scene_marker_id = sm.id
			) marker_tags
			Where marker_tags.tag_id = %[1]d
			   OR marker_tags.tag_id IN (SELECT child_id FROM tags_relations WHERE parent_id = %[1]d)
			   OR marker_tags.tag_id IN (SELECT tr2.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id WHERE tr1.parent_id = %[1]d)
			   OR marker_tags.tag_id IN (SELECT tr3.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id WHERE tr1.parent_id = %[1]d)
			   OR marker_tags.tag_id IN (SELECT tr4.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id JOIN tags_relations tr4 ON tr4.parent_id = tr3.child_id WHERE tr1.parent_id = %[1]d)
		)
		%[2]s
	), 0) %[3]s`, roleTagIDs.OralTagID, sexExclude, getSortDirection(direction))
}

// sortBySoloSceneCount counts scenes with solo markers but not sex/oral markers
func (qb *StudioStore) sortBySoloSceneCount(direction string) string {
	roleTagIDs := GetRoleTagIDs()
	if roleTagIDs.SoloTagID == 0 {
		return fmt.Sprintf(" ORDER BY 0 %s", getSortDirection(direction))
	}

	// Build exclusion for sex markers - checks both primary and secondary tags
	excludeConditions := ""
	if roleTagIDs.SexTagID != 0 {
		excludeConditions += fmt.Sprintf(`
			AND s.id NOT IN (
				SELECT DISTINCT sm_sex.scene_id
				FROM scene_markers sm_sex
				WHERE EXISTS (
					SELECT 1 FROM (
						SELECT sm_sex.primary_tag_id AS tag_id
						UNION ALL
						Select smt_sex.tag_id FROM scene_markers_tags smt_sex WHERE smt_sex.scene_marker_id = sm_sex.id
					) sex_marker_tags
					WHERE sex_marker_tags.tag_id = %[1]d
					   OR sex_marker_tags.tag_id IN (SELECT child_id FROM tags_relations WHERE parent_id = %[1]d)
					   OR sex_marker_tags.tag_id IN (SELECT tr2.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id WHERE tr1.parent_id = %[1]d)
					   OR sex_marker_tags.tag_id IN (SELECT tr3.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id WHERE tr1.parent_id = %[1]d)
					   OR sex_marker_tags.tag_id IN (SELECT tr4.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id JOIN tags_relations tr4 ON tr4.parent_id = tr3.child_id WHERE tr1.parent_id = %[1]d)
				)
			)`, roleTagIDs.SexTagID)
	}
	// Build exclusion for oral markers - checks both primary and secondary tags
	if roleTagIDs.OralTagID != 0 {
		excludeConditions += fmt.Sprintf(`
			AND s.id NOT IN (
				SELECT DISTINCT sm_oral.scene_id
				FROM scene_markers sm_oral
				WHERE EXISTS (
					SELECT 1 FROM (
						SELECT sm_oral.primary_tag_id AS tag_id
						UNION ALL
						SELECT smt_oral.tag_id FROM scene_markers_tags smt_oral WHERE smt_oral.scene_marker_id = sm_oral.id
					) oral_marker_tags
					WHERE oral_marker_tags.tag_id = %[1]d
					   OR oral_marker_tags.tag_id IN (SELECT child_id FROM tags_relations WHERE parent_id = %[1]d)
					   OR oral_marker_tags.tag_id IN (SELECT tr2.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id WHERE tr1.parent_id = %[1]d)
					   OR oral_marker_tags.tag_id IN (SELECT tr3.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id WHERE tr1.parent_id = %[1]d)
					   OR oral_marker_tags.tag_id IN (SELECT tr4.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id JOIN tags_relations tr4 ON tr4.parent_id = tr3.child_id WHERE tr1.parent_id = %[1]d)
				)
			)`, roleTagIDs.OralTagID)
	}

	// Count scenes with solo markers (including all subtags) excluding those with sex/oral markers
	// Checks both primary and secondary tags
	return fmt.Sprintf(` ORDER BY COALESCE((
		SELECT COUNT(DISTINCT s.id)
		FROM scenes s
		INNER JOIN scene_markers sm ON sm.scene_id = s.id
		WHERE s.studio_id = studios.id
		AND EXISTS (
			SELECT 1 FROM (
				SELECT sm.primary_tag_id AS tag_id
				UNION ALL
				SELECT smt.tag_id FROM scene_markers_tags smt WHERE smt.scene_marker_id = sm.id
			) marker_tags
			WHERE marker_tags.tag_id = %[1]d
			   OR marker_tags.tag_id IN (SELECT child_id FROM tags_relations WHERE parent_id = %[1]d)
			   OR marker_tags.tag_id IN (SELECT tr2.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id WHERE tr1.parent_id = %[1]d)
			   OR marker_tags.tag_id IN (SELECT tr3.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id WHERE tr1.parent_id = %[1]d)
			   OR marker_tags.tag_id IN (SELECT tr4.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id JOIN tags_relations tr4 ON tr4.parent_id = tr3.child_id WHERE tr1.parent_id = %[1]d)
		)
		%[2]s
	), 0) %[3]s`, roleTagIDs.SoloTagID, excludeConditions, getSortDirection(direction))
}

// sortByFacialSceneCount counts scenes with facial markers (independent of other markers)
func (qb *StudioStore) sortByFacialSceneCount(direction string) string {
	roleTagIDs := GetRoleTagIDs()
	return qb.sortByMarkerRoleSceneCount(roleTagIDs.FacialTagID, direction)
}

// sortByUniquePerformerCount counts performers who have exactly 1 scene in the database
// and that scene belongs to this studio
func (qb *StudioStore) sortByUniquePerformerCount(direction string) string {
	// Count performers who:
	// 1. Have scenes with this studio
	// 2. Have exactly 1 scene total in the database
	return fmt.Sprintf(` ORDER BY (
		SELECT COUNT(DISTINCT p.id)
		FROM performers p
		INNER JOIN performers_scenes ps ON ps.performer_id = p.id
		INNER JOIN scenes s ON s.id = ps.scene_id
		WHERE s.studio_id = studios.id
		AND (
			SELECT COUNT(*) FROM performers_scenes ps2 WHERE ps2.performer_id = p.id
		) = 1
	) %s`, getSortDirection(direction))
}

// sortByOCount sorts by the total o-count for a studio, which is the sum of:
// - scene o_dates counts (entries in scenes_o_dates for scenes belonging to the studio)
// - image o_counter values (o_counter column in images belonging to the studio)
func (qb *StudioStore) sortByOCount(direction string) string {
	return fmt.Sprintf(` ORDER BY COALESCE((
		SELECT COUNT(*)
		FROM %s sod
		INNER JOIN %s s ON sod.%s = s.id
		WHERE s.%s = studios.id
	), 0) + COALESCE((
		SELECT SUM(o_counter)
		FROM %s
		WHERE %s = studios.id
	), 0) %s`,
		scenesODatesTable, sceneTable, sceneIDColumn, studioIDColumn,
		imageTable, studioIDColumn,
		getSortDirection(direction),
	)
}
