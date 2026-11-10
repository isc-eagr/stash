package api

// The compact dashboard only needs its effective date. Preserve the previous
// client-side scene-date fallback even for legacy blank release dates.
func sceneStatsEffectiveDateValueCustom(effectiveDate, sceneDate interface{}) *string {
	if date := sceneStatsStringPtrValue(effectiveDate); date != nil {
		return date
	}
	return sceneStatsStringPtrValue(sceneDate)
}
