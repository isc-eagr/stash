package sqlite

import "fmt"

func studioRoleSceneCountExpressionCustom(tagID int, excludedTagIDs ...int) string {
	if tagID == 0 {
		return "0"
	}
	// Inherited tags originate on another marker in this same scene. For a
	// scene-level existence check, testing direct tags is sufficient.
	markerExists := func(id int) string {
		return fmt.Sprintf(`EXISTS (SELECT 1 FROM scene_markers role_marker
 WHERE role_marker.scene_id = role_scene.id AND %s)`, sceneMarkerDirectTagHierarchyConditionCustom("role_marker", id))
	}
	condition := markerExists(tagID)
	for _, id := range excludedTagIDs {
		if id != 0 {
			condition += " AND NOT " + markerExists(id)
		}
	}
	return `(SELECT COUNT(*) FROM scenes role_scene
 WHERE role_scene.studio_id = studios.id AND ` + condition + `)`
}
