package models

// MarkerPerformersFilterInput is the input for filtering by marker performers with top/bottom roles
type MarkerPerformersFilterInput struct {
	TopPerformerIDs    []string          `json:"top_performer_ids"`
	BottomPerformerIDs []string          `json:"bottom_performer_ids"`
	Mode               *string           `json:"mode"` // "AND" or "OR" (default: "OR")
	Modifier           CriterionModifier `json:"modifier"`
}

type SceneMarkerFilterType struct {
	// Filter to only include scene markers with this tag
	TagID *string `json:"tag_id"`
	// Filter to only include scene markers with these tags
	Tags *HierarchicalMultiCriterionInput `json:"tags"`
	// Filter to only include scene markers attached to a scene with these tags
	SceneTags *HierarchicalMultiCriterionInput `json:"scene_tags"`
	// Filter to only include scene markers with these performers (scene performers)
	Performers *MultiCriterionInput `json:"performers"`
	// Filter by performer rating (scene performers, 1-100)
	PerformerRating *IntCriterionInput `json:"performer_rating"`
	// Filter to only include scene markers by performer ethnicity (scene performers)
	PerformerEthnicity *StringCriterionInput `json:"performer_ethnicity"`
	// Filter to only include scene markers by performer country (scene performers)
	PerformerCountry *StringCriterionInput `json:"performer_country"`
	// When true, all linked performers must satisfy the performer_rating condition; when false, at least one performer must satisfy it (default: true)
	PerformerRatingAll *bool `json:"performer_rating_all"`

	// Filter by scene director
	SceneDirector *StringCriterionInput `json:"scene_director"`

	// Filter by whether the marker has an end time
	HasEndTime *bool `json:"has_end_time"`

	// Filter by performers assigned directly to the marker with top/bottom role support
	MarkerPerformers *MarkerPerformersFilterInput `json:"marker_performers"`
	// Filter by ethnicity of performers assigned directly to the marker
	MarkerPerformerEthnicity *StringCriterionInput `json:"marker_performer_ethnicity"`
	// Filter by country of performers assigned directly to the marker
	MarkerPerformerCountry *StringCriterionInput `json:"marker_performer_country"`
	// Filter by rating of performers assigned directly to the marker (1-100)
	MarkerPerformerRating *IntCriterionInput `json:"marker_performer_rating"`
	// When true, all marker performers must satisfy the marker_performer_rating condition; when false, at least one (default: true)
	MarkerPerformerRatingAll *bool `json:"marker_performer_rating_all"`
	// Filter by whether the marker has performers assigned directly to it
	HasMarkerPerformers *string `json:"has_marker_performers"`

	// Filter by marker tags with performer attributes (top/bottom/both roles)
	SceneMarkerTags *SceneMarkerTagsCriterionInput `json:"scene_marker_tags"`

	// Filter to only include scene markers from these scenes
	Scenes *MultiCriterionInput `json:"scenes"`
	// Filter to only include scene markers from scenes belonging to these studios
	Studios *HierarchicalMultiCriterionInput `json:"studios"`
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
