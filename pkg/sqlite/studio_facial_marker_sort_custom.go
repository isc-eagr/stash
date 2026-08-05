package sqlite

import "fmt"

const (
	studioFacialMarkerStandardCustom  = "standard"
	studioFacialMarkerReallyHotCustom = "really_hot"
)

var studioFacialMarkerSortKeysCustom = map[string]string{
	"standard_facial_count":   studioFacialMarkerStandardCustom,
	"really_hot_facial_count": studioFacialMarkerReallyHotCustom,
}

func studioFacialMarkerCountExprForTagsCustom(variant string, facialTagID int, reallyHotTagID int) string {
	if facialTagID == 0 {
		return "0"
	}

	facialCondition := sceneMarkerDirectTagHierarchyConditionCustom("studio_facial_marker", facialTagID)
	reallyHotCondition := ""
	if reallyHotTagID != 0 {
		reallyHotCondition = sceneMarkerDirectTagHierarchyConditionCustom("studio_facial_marker", reallyHotTagID)
	}

	variantCondition := ""
	if variant == studioFacialMarkerReallyHotCustom {
		if reallyHotCondition == "" {
			return "0"
		}
		variantCondition = "\n\t\tAND " + reallyHotCondition
	} else if reallyHotCondition != "" {
		variantCondition = "\n\t\tAND NOT " + reallyHotCondition
	}

	return fmt.Sprintf(`(
	SELECT COUNT(DISTINCT studio_facial_marker.id)
	FROM scenes studio_facial_scene
	INNER JOIN scene_markers studio_facial_marker ON studio_facial_marker.scene_id = studio_facial_scene.id
	WHERE studio_facial_scene.studio_id = studios.id
		AND %s%s
)`, facialCondition, variantCondition)
}

func studioFacialMarkerCountExprCustom(variant string) string {
	roleTagIDs := GetRoleTagIDs()
	return studioFacialMarkerCountExprForTagsCustom(variant, roleTagIDs.FacialTagID, roleTagIDs.ReallyHotTagID)
}

func (qb *StudioStore) sortByFacialMarkerCountCustom(variant string, direction string) string {
	return studioSortMetricOrderClauseCustom(studioFacialMarkerCountExprCustom(variant), direction)
}
