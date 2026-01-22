package models

// CustomSceneMarkerFilterInput is the input for custom scene marker filters
type CustomSceneMarkerFilterInput struct {
	// The filter type: circular_oral, simultaneous_orgasm, self_facial
	Type string `json:"type"`
	// The tag ID for 'oral' markers
	OralTagID *string `json:"oral_tag_id"`
	// The tag ID for 'orgasm' markers
	OrgasmTagID *string `json:"orgasm_tag_id"`
	// The tag ID for 'facial' markers
	FacialTagID *string `json:"facial_tag_id"`
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
	// Custom scene marker filters: predefined complex filters
	// Options: 'circular_oral', 'simultaneous_orgasm', 'self_facial'
	CustomFilters *CustomSceneMarkerFilterInput `json:"custom_filters"`
}

type MarkerStringsResultType struct {
	Count int    `json:"count"`
	ID    string `json:"id"`
	Title string `json:"title"`
}
