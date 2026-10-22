package sqlite

import "fmt"

const (
	studioFacialMarkerStandardCustom  = "standard"
	studioFacialMarkerReallyHotCustom = "really_hot"
	studioFacialMarkerGoatCustom      = "goat"
)

var studioFacialMarkerSortKeysCustom = map[string]string{
	"standard_facial_count":   studioFacialMarkerStandardCustom,
	"really_hot_facial_count": studioFacialMarkerReallyHotCustom,
	"goat_facial_count":       studioFacialMarkerGoatCustom,
}

func studioFacialMarkerCountExprForTagsCustom(variant string, facialTagID int, reallyHotTagID int, goatTagIDs ...int) string {
	if facialTagID == 0 {
		return "0"
	}

	facialCondition := sceneMarkerDirectTagHierarchyConditionCustom("studio_facial_marker", facialTagID)
	goatTagID := 0
	if len(goatTagIDs) > 0 {
		goatTagID = goatTagIDs[0]
	}
	variantCondition := "\n\t\tAND " + markerQualityConditionCustom("studio_facial_marker", variant, reallyHotTagID, goatTagID)

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
	return studioFacialMarkerCountExprForTagsCustom(variant, roleTagIDs.FacialTagID, roleTagIDs.ReallyHotTagID, roleTagIDs.GoatTagID)
}

func (qb *StudioStore) sortByFacialMarkerCountCustom(variant string, direction string) string {
	return studioSortMetricOrderClauseCustom(studioFacialMarkerCountExprCustom(variant), direction)
}
