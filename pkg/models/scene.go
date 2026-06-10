package models

import "context"

type DuplicationCriterionInput struct {
	// Deprecated: Use Phash field instead. Kept for backwards compatibility.
	Duplicated *bool `json:"duplicated"`
	// Currently unimplemented. Intended for phash distance matching.
	Distance *int `json:"distance"`
	// Filter by phash duplication
	Phash *bool `json:"phash"`
	// Filter by URL duplication
	URL *bool `json:"url"`
	// Filter by Stash ID duplication
	StashID *bool `json:"stash_id"`
	// Filter by title duplication
	Title *bool `json:"title"`
}

type FileDuplicationCriterionInput struct {
	// Deprecated: Use Phash field instead. Kept for backwards compatibility.
	Duplicated *bool `json:"duplicated"`
	// Currently unimplemented. Intended for phash distance matching.
	Distance *int `json:"distance"`
	// Filter by phash duplication
	Phash *bool `json:"phash"`
}

// CUSTOM: begin
// CustomSceneFilterInput is the input for custom scene filters
type CustomSceneFilterInput struct {
	// The filter type: multiple_orgasms, versatile_scenes, circular_oral, simultaneous_orgasm, self_facial
	Type string `json:"type"`
	// The tag ID for 'sex' markers
	SexTagID *string `json:"sex_tag_id"`
	// The tag ID for 'orgasm' markers
	OrgasmTagID *string `json:"orgasm_tag_id"`
	// The tag ID for 'oral' markers
	OralTagID *string `json:"oral_tag_id"`
	// The tag ID for 'facial' markers
	FacialTagID *string `json:"facial_tag_id"`
}

// SceneTypeFilterInput is the input for filtering scenes by type (sex, oral, solo, facial)
type SceneTypeFilterInput struct {
	// Selected scene types to filter by
	Types []string `json:"types"`
	// The tag ID for 'sex' markers
	SexTagID *string `json:"sex_tag_id"`
	// The tag ID for 'oral' markers
	OralTagID *string `json:"oral_tag_id"`
	// The tag ID for 'solo' markers
	SoloTagID *string `json:"solo_tag_id"`
	// The tag ID for 'facial' markers
	FacialTagID *string `json:"facial_tag_id"`
}

// CUSTOM: end

type SceneFilterType struct {
	OperatorFilter[SceneFilterType]
	ID       *IntCriterionInput    `json:"id"`
	Title    *StringCriterionInput `json:"title"`
	Code     *StringCriterionInput `json:"code"`
	Details  *StringCriterionInput `json:"details"`
	Director *StringCriterionInput `json:"director"`
	// Filter by file oshash
	Oshash *StringCriterionInput `json:"oshash"`
	// Filter by file checksum
	Checksum *StringCriterionInput `json:"checksum"`
	// Filter by file phash
	Phash *StringCriterionInput `json:"phash"`
	// Filter by phash distance
	PhashDistance *PhashDistanceCriterionInput `json:"phash_distance"`
	// Filter by path
	Path *StringCriterionInput `json:"path"`
	// Filter by file count
	FileCount *IntCriterionInput `json:"file_count"`
	// Filter by release count
	ReleaseCount *IntCriterionInput `json:"release_count"` // CUSTOM
	// Filter by rating expressed as 1-100
	Rating100 *IntCriterionInput `json:"rating100"`
	// Filter by metallic card style after rating thresholds and tag overrides
	MetallicRating *MultiCriterionInput `json:"metallic_rating"` // CUSTOM
	// Filter by stored rating criteria, bonuses, and penalties
	RatingCriteria *RatingCriteriaFilterInput `json:"rating_criteria"` // CUSTOM
	// Filter by organized
	Organized *bool `json:"organized"`
	// Filter by o-counter
	OCounter *IntCriterionInput `json:"o_counter"`
	// Filter Scenes by duplication criteria
	Duplicated *DuplicationCriterionInput `json:"duplicated"`
	// Filter by resolution
	Resolution *ResolutionCriterionInput `json:"resolution"`
	// Filter by orientation
	Orientation *OrientationCriterionInput `json:"orientation"`
	// Filter by framerate
	Framerate *IntCriterionInput `json:"framerate"`
	// Filter by bitrate
	Bitrate *IntCriterionInput `json:"bitrate"`
	// Filter by video codec
	VideoCodec *StringCriterionInput `json:"video_codec"`
	// Filter by audio codec
	AudioCodec *StringCriterionInput `json:"audio_codec"`
	// Filter by duration (in seconds)
	Duration *IntCriterionInput `json:"duration"`
	// Filter to only include scenes which have markers. `true` or `false`
	HasMarkers *string `json:"has_markers"`
	// CUSTOM: begin
	// Filter to only include scenes with markers that have assigned performers. `true` or `false`
	HasMarkerPerformers *string `json:"has_marker_performers"`
	// Custom scene filters: predefined complex filters.
	// Options: 'multiple_orgasms', 'versatile_scenes'
	CustomFilters *CustomSceneFilterInput `json:"custom_filters"`
	// Filter by scene type based on marker tags
	SceneType *SceneTypeFilterInput `json:"scene_type"`
	// Filter by scene marker tags with optional performer role criteria
	SceneMarkerTags *SceneMarkerTagsCriterionInput `json:"scene_marker_tags"`
	// CUSTOM: end
	// Filter to only include scenes missing this property
	IsMissing *string `json:"is_missing"`
	// Filter to only include scenes with this studio
	Studios *HierarchicalMultiCriterionInput `json:"studios"`
	// Filter to only include scenes with this group
	Groups *HierarchicalMultiCriterionInput `json:"groups"`
	// Filter to only include scenes with this movie
	Movies *MultiCriterionInput `json:"movies"`
	// Filter to only include scenes with this gallery
	Galleries *MultiCriterionInput `json:"galleries"`
	// Filter to only include scenes with these tags
	Tags *HierarchicalMultiCriterionInput `json:"tags"`
	// Filter by tag count
	TagCount *IntCriterionInput `json:"tag_count"`
	// Filter to only include scenes with performers with these tags
	PerformerTags *HierarchicalMultiCriterionInput `json:"performer_tags"`
	// Filter scenes that have performers that have been favorited
	PerformerFavorite *bool `json:"performer_favorite"`
	// Filter scenes by performer age at time of scene
	PerformerAge *IntCriterionInput `json:"performer_age"`
	// Filter to only include scenes with these performers
	Performers *MultiCriterionInput `json:"performers"`
	// CUSTOM: begin
	// Filter by performer ethnicity
	PerformerEthnicity *StringCriterionInput `json:"performer_ethnicity"`
	// Filter by performer ethnicity
	PerformerCountry *StringCriterionInput `json:"performer_country"`
	// Filter by performer rating (1-100)
	PerformerRating *IntCriterionInput `json:"performer_rating"`
	// When true, all linked performers must satisfy performer_rating; when false, any matching performer is sufficient
	PerformerRatingAll *bool `json:"performer_rating_all"`
	// CUSTOM: end
	// Filter by performer count
	PerformerCount *IntCriterionInput `json:"performer_count"`
	// Filter by StashID
	StashID *StringCriterionInput `json:"stash_id"`
	// Filter by StashID Endpoint
	StashIDEndpoint *StashIDCriterionInput `json:"stash_id_endpoint"`
	// Filter by StashIDs Endpoint
	StashIDsEndpoint *StashIDsCriterionInput `json:"stash_ids_endpoint"`
	// Filter by StashID count
	StashIDCount *IntCriterionInput `json:"stash_id_count"`
	// Filter by url
	URL *StringCriterionInput `json:"url"`
	// Filter by interactive
	Interactive *bool `json:"interactive"`
	// Filter by InteractiveSpeed
	InteractiveSpeed *IntCriterionInput `json:"interactive_speed"`
	// Filter by captions
	Captions *StringCriterionInput `json:"captions"`
	// Filter by resume time
	ResumeTime *IntCriterionInput `json:"resume_time"`
	// Filter by play count
	PlayCount *IntCriterionInput `json:"play_count"`
	// Filter by play duration (in seconds)
	PlayDuration *IntCriterionInput `json:"play_duration"`
	// Filter by last played at
	LastPlayedAt *TimestampCriterionInput `json:"last_played_at"`
	// Filter by date
	Date *DateCriterionInput `json:"date"`
	// Filter by effective date (earliest date among scene date and release dates)
	EffectiveDate *DateCriterionInput `json:"effective_date"` // CUSTOM
	// Filter by related galleries that meet this criteria
	GalleriesFilter *GalleryFilterType `json:"galleries_filter"`
	// Filter by related performers that meet this criteria
	PerformersFilter *PerformerFilterType `json:"performers_filter"`
	// Filter by related studios that meet this criteria
	StudiosFilter *StudioFilterType `json:"studios_filter"`
	// Filter by related tags that meet this criteria
	TagsFilter *TagFilterType `json:"tags_filter"`
	// Filter by related groups that meet this criteria
	GroupsFilter *GroupFilterType `json:"groups_filter"`
	// Filter by related movies that meet this criteria
	MoviesFilter *GroupFilterType `json:"movies_filter"`
	// Filter by related markers that meet this criteria
	MarkersFilter *SceneMarkerFilterType `json:"markers_filter"`
	// Filter by related files that meet this criteria
	FilesFilter *FileFilterType `json:"files_filter"`
	// Filter by created at
	CreatedAt *TimestampCriterionInput `json:"created_at"`
	// Filter by updated at
	UpdatedAt *TimestampCriterionInput `json:"updated_at"`

	// Filter by custom fields
	CustomFields []CustomFieldCriterionInput `json:"custom_fields"`
}

type SceneQueryOptions struct {
	QueryOptions
	SceneFilter *SceneFilterType

	TotalDuration bool
	TotalSize     bool
}

type SceneQueryResult struct {
	QueryResult[int]
	TotalDuration float64
	TotalSize     float64

	getter     SceneGetter
	scenes     []*Scene
	resolveErr error
}

// SceneMovieInput is used for groups and movies
type SceneMovieInput struct {
	MovieID    string `json:"movie_id"`
	SceneIndex *int   `json:"scene_index"`
}

type SceneGroupInput struct {
	GroupID    string `json:"group_id"`
	SceneIndex *int   `json:"scene_index"`
}

type SceneCreateInput struct {
	Title        *string           `json:"title"`
	Code         *string           `json:"code"`
	Details      *string           `json:"details"`
	Director     *string           `json:"director"`
	URL          *string           `json:"url"`
	Urls         []string          `json:"urls"`
	Date         *string           `json:"date"`
	Rating100    *int              `json:"rating100"`
	Organized    *bool             `json:"organized"`
	StudioID     *string           `json:"studio_id"`
	GalleryIds   []string          `json:"gallery_ids"`
	PerformerIds []string          `json:"performer_ids"`
	Movies       []SceneMovieInput `json:"movies"`
	Groups       []SceneGroupInput `json:"groups"`
	TagIds       []string          `json:"tag_ids"`
	// This should be a URL or a base64 encoded data URL
	CoverImage *string        `json:"cover_image"`
	StashIds   []StashIDInput `json:"stash_ids"`
	// The first id will be assigned as primary.
	// Files will be reassigned from existing scenes if applicable.
	// Files must not already be primary for another scene.
	FileIds      []string       `json:"file_ids"`
	CustomFields map[string]any `json:"custom_fields,omitempty"`
}

type SceneUpdateInput struct {
	ClientMutationID *string           `json:"clientMutationId"`
	ID               string            `json:"id"`
	Title            *string           `json:"title"`
	Code             *string           `json:"code"`
	Details          *string           `json:"details"`
	Director         *string           `json:"director"`
	URL              *string           `json:"url"`
	Urls             []string          `json:"urls"`
	Date             *string           `json:"date"`
	Rating100        *int              `json:"rating100"`
	OCounter         *int              `json:"o_counter"`
	Organized        *bool             `json:"organized"`
	StudioID         *string           `json:"studio_id"`
	GalleryIds       []string          `json:"gallery_ids"`
	PerformerIds     []string          `json:"performer_ids"`
	Movies           []SceneMovieInput `json:"movies"`
	Groups           []SceneGroupInput `json:"groups"`
	TagIds           []string          `json:"tag_ids"`
	// This should be a URL or a base64 encoded data URL
	CoverImage    *string        `json:"cover_image"`
	StashIds      []StashIDInput `json:"stash_ids"`
	ResumeTime    *float64       `json:"resume_time"`
	PlayDuration  *float64       `json:"play_duration"`
	PlayCount     *int           `json:"play_count"`
	PrimaryFileID *string        `json:"primary_file_id"`
	CustomFields  *CustomFieldsInput
}

type SceneDestroyInput struct {
	ID               string `json:"id"`
	DeleteFile       *bool  `json:"delete_file"`
	DeleteGenerated  *bool  `json:"delete_generated"`
	DestroyFileEntry *bool  `json:"destroy_file_entry"`
}

type ScenesDestroyInput struct {
	Ids              []string `json:"ids"`
	DeleteFile       *bool    `json:"delete_file"`
	DeleteGenerated  *bool    `json:"delete_generated"`
	DestroyFileEntry *bool    `json:"destroy_file_entry"`
}

func NewSceneQueryResult(getter SceneGetter) *SceneQueryResult {
	return &SceneQueryResult{
		getter: getter,
	}
}

func (r *SceneQueryResult) Resolve(ctx context.Context) ([]*Scene, error) {
	// cache results
	if r.scenes == nil && r.resolveErr == nil {
		r.scenes, r.resolveErr = r.getter.FindMany(ctx, r.IDs)
	}
	return r.scenes, r.resolveErr
}
