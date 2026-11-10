package sqlite

// CUSTOM: Exclusive marker quality. GOAT wins when both qualifiers are present.
func markerQualityConditionCustom(alias string, variant string, reallyHotTagID, goatTagID int) string {
	hot, goat := "0 = 1", "0 = 1"
	if reallyHotTagID != 0 {
		hot = sceneMarkerDirectTagHierarchyConditionCustom(alias, reallyHotTagID)
	}
	if goatTagID != 0 {
		goat = sceneMarkerDirectTagHierarchyConditionCustom(alias, goatTagID)
	}
	switch variant {
	case "goat":
		return "(" + goat + ")"
	case "really_hot":
		return "(" + hot + ") AND NOT (" + goat + ")"
	default:
		return "NOT (" + hot + ") AND NOT (" + goat + ")"
	}
}
