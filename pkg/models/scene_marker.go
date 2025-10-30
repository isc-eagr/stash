package models

type SceneMarkerFilterType struct {
	// Filter to only include scene markers with this tag
	TagID *string `json:"tag_id"`
	// Filter to only include scene markers with these tags
	Tags *HierarchicalMultiCriterionInput `json:"tags"`
	// Filter to only include scene markers attached to a scene with these tags
	SceneTags *HierarchicalMultiCriterionInput `json:"scene_tags"`
	// Filter to only include scene markers with these performers
	Performers *MultiCriterionInput `json:"performers"`
	// Filter by performer rating (1-100)
	PerformerRating *IntCriterionInput `json:"performer_rating"`
	// Filter to only include scene markers by performer ethnicity
	PerformerEthnicity *StringCriterionInput `json:"performer_ethnicity"`
	// Filter to only include scene markers by performer country
	PerformerCountry *StringCriterionInput `json:"performer_country"`
	// When true, all linked performers must satisfy the performer_rating condition; when false, at least one performer must satisfy it (default: true)
	PerformerRatingAll *bool `json:"performer_rating_all"`
	// Filter to only include scene markers from these scenes
	Scenes *MultiCriterionInput `json:"scenes"`
	// Filter by duration (in seconds)
	Duration *FloatCriterionInput `json:"duration"`
	// Filter by created at
	CreatedAt *TimestampCriterionInput `json:"created_at"`
	// Filter by updated at
	UpdatedAt *TimestampCriterionInput `json:"updated_at"`
	// Filter by scenes date
	SceneDate *DateCriterionInput `json:"scene_date"`
	// Filter by scenes created at
	SceneCreatedAt *TimestampCriterionInput `json:"scene_created_at"`
	// Filter by scenes updated at
	SceneUpdatedAt *TimestampCriterionInput `json:"scene_updated_at"`
	// Filter by related scenes that meet this criteria
	SceneFilter *SceneFilterType `json:"scene_filter"`
}

type MarkerStringsResultType struct {
	Count int    `json:"count"`
	ID    string `json:"id"`
	Title string `json:"title"`
}
