package sqlite

import "fmt"

// CUSTOM: Facial Count follows the Scene Stats "Total Facials" rule. A marker
// counts when its primary or secondary tags include the facial tag or a subtag,
// unless it also carries the 2nd Camera tag family.

func facialCountMarkerConditionCustom(smAlias string, facialTagID int, secondCameraTagID int) string {
	condition := sceneMarkerDirectTagHierarchyConditionCustom(smAlias, facialTagID)
	if secondCameraTagID != 0 {
		condition += "\n\t\tAND NOT " + sceneMarkerDirectTagHierarchyConditionCustom(smAlias, secondCameraTagID)
	}
	return condition
}

// studioFacialCountExprForTagsCustom counts each facial marker once per assigned
// top vato, with a minimum of one.
func studioFacialCountExprForTagsCustom(facialTagID int, secondCameraTagID int) string {
	if facialTagID == 0 {
		return "0"
	}

	return fmt.Sprintf(`(
	SELECT COALESCE(SUM(MAX(1, (
		SELECT COUNT(*)
		FROM scene_marker_performers studio_fc_top
		WHERE studio_fc_top.scene_marker_id = studio_fc_marker.id AND studio_fc_top.role = 'top'
	))), 0)
	FROM scenes studio_fc_scene
	INNER JOIN scene_markers studio_fc_marker ON studio_fc_marker.scene_id = studio_fc_scene.id
	WHERE studio_fc_scene.studio_id = studios.id
		AND %s
)`, facialCountMarkerConditionCustom("studio_fc_marker", facialTagID, secondCameraTagID))
}

func studioFacialCountExprCustom() string {
	roleTagIDs := GetRoleTagIDs()
	return studioFacialCountExprForTagsCustom(roleTagIDs.FacialTagID, roleTagIDs.SecondCameraTagID)
}

// performerFacialCountExprForTagsCustom counts the facial markers a performer is
// on, as top or bottom. studioSQL (optional) restricts markers to the active studio.
func performerFacialCountExprForTagsCustom(facialTagID int, secondCameraTagID int, studioSQL string) string {
	if facialTagID == 0 {
		return "0"
	}

	return fmt.Sprintf(`COALESCE((
		SELECT COUNT(DISTINCT sm.id)
		FROM scene_marker_performers smp
		JOIN scene_markers sm ON smp.scene_marker_id = sm.id
		WHERE smp.performer_id = performers.id
		AND smp.role IN ('top', 'bottom')
		AND %s
		%s
	), 0)`, facialCountMarkerConditionCustom("sm", facialTagID, secondCameraTagID), studioSQL)
}

func (qb *PerformerStore) sortByPerformerFacialCountCustom(direction string, studioSQL string) string {
	roleTagIDs := GetRoleTagIDs()
	expression := performerFacialCountExprForTagsCustom(roleTagIDs.FacialTagID, roleTagIDs.SecondCameraTagID, studioSQL)
	if expression == "0" {
		expression = "(0 + 0)"
	}
	return fmt.Sprintf(" ORDER BY %s %s", expression, getSortDirection(direction))
}
