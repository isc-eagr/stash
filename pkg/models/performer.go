package models

import (
	"fmt"
	"io"
	"strconv"
)

type GenderEnum string

const (
	GenderEnumMale              GenderEnum = "MALE"
	GenderEnumFemale            GenderEnum = "FEMALE"
	GenderEnumTransgenderMale   GenderEnum = "TRANSGENDER_MALE"
	GenderEnumTransgenderFemale GenderEnum = "TRANSGENDER_FEMALE"
	GenderEnumIntersex          GenderEnum = "INTERSEX"
	GenderEnumNonBinary         GenderEnum = "NON_BINARY"
)

var AllGenderEnum = []GenderEnum{
	GenderEnumMale,
	GenderEnumFemale,
	GenderEnumTransgenderMale,
	GenderEnumTransgenderFemale,
	GenderEnumIntersex,
	GenderEnumNonBinary,
}

func (e GenderEnum) IsValid() bool {
	switch e {
	case GenderEnumMale, GenderEnumFemale, GenderEnumTransgenderMale, GenderEnumTransgenderFemale, GenderEnumIntersex, GenderEnumNonBinary:
		return true
	}
	return false
}

func (e GenderEnum) String() string {
	return string(e)
}

func (e *GenderEnum) UnmarshalGQL(v interface{}) error {
	str, ok := v.(string)
	if !ok {
		return fmt.Errorf("enums must be strings")
	}

	*e = GenderEnum(str)
	if !e.IsValid() {
		return fmt.Errorf("%s is not a valid GenderEnum", str)
	}
	return nil
}

func (e GenderEnum) MarshalGQL(w io.Writer) {
	fmt.Fprint(w, strconv.Quote(e.String()))
}

type GenderCriterionInput struct {
	Value     GenderEnum        `json:"value"`
	ValueList []GenderEnum      `json:"value_list"`
	Modifier  CriterionModifier `json:"modifier"`
}

type CircumcisedEnum string

const (
	CircumcisedEnumCut   CircumcisedEnum = "CUT"
	CircumcisedEnumUncut CircumcisedEnum = "UNCUT"
)

var AllCircumcisionEnum = []CircumcisedEnum{
	CircumcisedEnumCut,
	CircumcisedEnumUncut,
}

func (e CircumcisedEnum) IsValid() bool {
	switch e {
	case CircumcisedEnumCut, CircumcisedEnumUncut:
		return true
	}
	return false
}

func (e CircumcisedEnum) String() string {
	return string(e)
}

func (e *CircumcisedEnum) UnmarshalGQL(v interface{}) error {
	str, ok := v.(string)
	if !ok {
		return fmt.Errorf("enums must be strings")
	}

	*e = CircumcisedEnum(str)
	if !e.IsValid() {
		return fmt.Errorf("%s is not a valid CircumcisedEnum", str)
	}
	return nil
}

func (e CircumcisedEnum) MarshalGQL(w io.Writer) {
	fmt.Fprint(w, strconv.Quote(e.String()))
}

type CircumcisionCriterionInput struct {
	Value    []CircumcisedEnum `json:"value"`
	Modifier CriterionModifier `json:"modifier"`
}

type PerformerFilterType struct {
	OperatorFilter[PerformerFilterType]
	Name           *StringCriterionInput `json:"name"`
	Disambiguation *StringCriterionInput `json:"disambiguation"`
	Details        *StringCriterionInput `json:"details"`
	// Filter by favorite
	FilterFavorites *bool `json:"filter_favorites"`
	// Filter by birth year
	BirthYear *IntCriterionInput `json:"birth_year"`
	// Filter by age
	Age *IntCriterionInput `json:"age"`
	// Filter by ethnicity
	Ethnicity *StringCriterionInput `json:"ethnicity"`
	// Filter by country
	Country *StringCriterionInput `json:"country"`
	// Filter by eye color
	EyeColor *StringCriterionInput `json:"eye_color"`
	// Filter by height - deprecated: use height_cm instead
	Height *StringCriterionInput `json:"height"`
	// Filter by height in centimeters
	HeightCm *IntCriterionInput `json:"height_cm"`
	// Filter by measurements
	Measurements *StringCriterionInput `json:"measurements"`
	// Filter by fake tits value
	FakeTits *StringCriterionInput `json:"fake_tits"`
	// Filter by penis length value
	PenisLength *FloatCriterionInput `json:"penis_length"`
	// Filter by circumcision
	Circumcised *CircumcisionCriterionInput `json:"circumcised"`
	// Filter by career length
	CareerLength *StringCriterionInput `json:"career_length"` // deprecated
	// Filter by career start year
	CareerStart *DateCriterionInput `json:"career_start"`
	// Filter by career end year
	CareerEnd *DateCriterionInput `json:"career_end"`
	// Filter by tattoos
	Tattoos *StringCriterionInput `json:"tattoos"`
	// Filter by piercings
	Piercings *StringCriterionInput `json:"piercings"`
	// Filter by aliases
	Aliases *StringCriterionInput `json:"aliases"`
	// Filter by gender
	Gender *GenderCriterionInput `json:"gender"`
	// Filter to only include performers missing this property
	IsMissing *string `json:"is_missing"`
	// Filter to only include performers with these tags
	Tags *HierarchicalMultiCriterionInput `json:"tags"`
	// Filter by tag count
	TagCount *IntCriterionInput `json:"tag_count"`
	// Filter by scene count
	SceneCount *IntCriterionInput `json:"scene_count"`
	// Filter by scene marker count (via scene)
	MarkerCount *IntCriterionInput `json:"marker_count"`
	// Filter by image count
	ImageCount *IntCriterionInput `json:"image_count"`
	// Filter by profile image count (default performer image + additional performer images)
	ProfileImageCount *IntCriterionInput `json:"profile_image_count"` // CUSTOM
	// Filter by gallery count
	GalleryCount *IntCriterionInput `json:"gallery_count"`
	// Filter by play count
	PlayCount *IntCriterionInput `json:"play_count"`
	// Filter by O count
	OCounter *IntCriterionInput `json:"o_counter"`
	// Filter by StashID
	StashID *StringCriterionInput `json:"stash_id"`
	// Filter by StashID Endpoint
	StashIDEndpoint *StashIDCriterionInput `json:"stash_id_endpoint"`
	// Filter by StashIDs Endpoint
	StashIDsEndpoint *StashIDsCriterionInput `json:"stash_ids_endpoint"`
	// Filter by rating expressed as 1-100
	Rating100 *IntCriterionInput `json:"rating100"`
	// Filter by metallic card style after rating thresholds and tag overrides
	MetallicRating *MultiCriterionInput `json:"metallic_rating"` // CUSTOM
	// Filter by stored rating criteria, bonuses, and penalties
	RatingCriteria *RatingCriteriaFilterInput `json:"rating_criteria"` // CUSTOM
	// Filter by configured activity percentages
	ActivityPercentages       *PerformerActivityPercentFilterInput `json:"activity_percentages"`         // CUSTOM
	SexActivityPercent        *IntCriterionInput                   `json:"sex_activity_percent"`         // CUSTOM
	OralActivityPercent       *IntCriterionInput                   `json:"oral_activity_percent"`        // CUSTOM
	SoloActivityPercent       *IntCriterionInput                   `json:"solo_activity_percent"`        // CUSTOM
	SexTopActivityPercent     *IntCriterionInput                   `json:"sex_top_activity_percent"`     // CUSTOM
	SexBottomActivityPercent  *IntCriterionInput                   `json:"sex_bottom_activity_percent"`  // CUSTOM
	OralTopActivityPercent    *IntCriterionInput                   `json:"oral_top_activity_percent"`    // CUSTOM
	OralBottomActivityPercent *IntCriterionInput                   `json:"oral_bottom_activity_percent"` // CUSTOM
	// Filter by url
	URL *StringCriterionInput `json:"url"`
	// Filter by hair color
	HairColor *StringCriterionInput `json:"hair_color"`
	// Filter by weight
	Weight *IntCriterionInput `json:"weight"`
	// Filter by death year
	DeathYear *IntCriterionInput `json:"death_year"`
	// Filter by studios where performer appears in scene/image/gallery
	Studios *HierarchicalMultiCriterionInput `json:"studios"`
	// Filter by groups where performer appears in scene
	Groups *HierarchicalMultiCriterionInput `json:"groups"`
	// Filter by performers where performer appears with another performer in scene/image/gallery
	Performers *MultiCriterionInput `json:"performers"`
	// Filter by autotag ignore value
	IgnoreAutoTag *bool `json:"ignore_auto_tag"`
	// Filter by birthdate
	Birthdate *DateCriterionInput `json:"birth_date"`
	// Filter by death date
	DeathDate *DateCriterionInput `json:"death_date"`
	// Filter by related scenes that meet this criteria
	ScenesFilter *SceneFilterType `json:"scenes_filter"`
	// CUSTOM: begin
	// Filter to only include performers that have scene markers where they are top/bottom
	HasMarkers *string `json:"has_markers"`
	// Filter by partner counts (topped/bottomed/unique × sex/oral/facial)
	Partners *PerformerPartnersFilterInput `json:"partners"`
	// Filter by scene type based on marker tags
	SceneType *SceneTypeFilterInput `json:"scene_type"`
	// CUSTOM: end
	// Filter by related images that meet this criteria
	ImagesFilter *ImageFilterType `json:"images_filter"`
	// Filter by related galleries that meet this criteria
	GalleriesFilter *GalleryFilterType `json:"galleries_filter"`
	// Filter by related tags that meet this criteria
	TagsFilter *TagFilterType `json:"tags_filter"`
	// Filter by related scene markers (via scene) that meet this criteria
	MarkersFilter *SceneMarkerFilterType `json:"markers_filter"`
	// Filter to only include performers that have at least one scene marker with all the selected tags
	MarkerTags *HierarchicalMultiCriterionInput `json:"marker_tags"` // CUSTOM
	// Filter by created at
	CreatedAt *TimestampCriterionInput `json:"created_at"`
	// Filter by updated at
	UpdatedAt *TimestampCriterionInput `json:"updated_at"`

	// Filter by custom fields
	CustomFields []CustomFieldCriterionInput `json:"custom_fields"`

	// CUSTOM: begin
	// Filter by scene marker participation with tag + role + partner attributes
	PerformerMarkers *PerformerMarkersCriterionInput `json:"performer_markers"`

	// Filter by markers with specific tags and performer's role on those markers
	PerformerMarkerTags *PerformerMarkerTagsCriterionInput `json:"performer_marker_tags"`

	// Filter by markers shared with partners having specific attributes
	PerformerMarkerPartners *PerformerMarkerPartnersCriterionInput `json:"performer_marker_partners"`
}

// PerformerPartnersFilterInput filters performers by partner counts across role/category combinations.
// Metrics within a row are combined with that row's operator (AND/OR). Rows are always AND-ed.
type PerformerPartnersFilterInput struct { // CUSTOM: begin
	SexTopped        *IntCriterionInput `json:"sex_topped"`
	OralTopped       *IntCriterionInput `json:"oral_topped"`
	FacialTopped     *IntCriterionInput `json:"facial_topped"`
	ToppedOperator   *string            `json:"topped_operator"` // "AND" (default) or "OR"
	SexBottomed      *IntCriterionInput `json:"sex_bottomed"`
	OralBottomed     *IntCriterionInput `json:"oral_bottomed"`
	FacialBottomed   *IntCriterionInput `json:"facial_bottomed"`
	BottomedOperator *string            `json:"bottomed_operator"` // "AND" (default) or "OR"
	SexUnique        *IntCriterionInput `json:"sex_unique"`
	OralUnique       *IntCriterionInput `json:"oral_unique"`
	FacialUnique     *IntCriterionInput `json:"facial_unique"`
	UniqueOperator   *string            `json:"unique_operator"` // "AND" (default) or "OR"
	// Backend-only: oral OR facial bottomed partners combined (for lenient tops stat)
	AnyNonSexBottomed *IntCriterionInput `json:"any_non_sex_bottomed"`
	// Backend-only: oral OR facial topped partners combined (for lenient bottoms stat)
	AnyNonSexTopped *IntCriterionInput `json:"any_non_sex_topped"`
} // CUSTOM: end

// PerformerMarkersCriterionInput filters performers by their scene marker participation
type PerformerMarkersCriterionInput struct {
	// Conditions that must all be satisfied (performer must have markers matching ALL of these)
	Include []PerformerMarkerConditionInput `json:"include"`
	// Conditions that must not be satisfied (performer must NOT have markers matching ANY of these)
	Exclude []PerformerMarkerConditionInput `json:"exclude"`
}

// PerformerMarkerConditionInput defines a single condition for performer marker filtering
type PerformerMarkerConditionInput struct {
	// Tag IDs to match on the marker (marker must have at least one of these tags)
	TagIDs []string `json:"tag_ids"`
	// Depth for hierarchical tag matching (0 = exact tags only, -1 = all sub-tags, positive = depth limit)
	Depth *int `json:"depth"`
	// This performer's role on the marker: "top", "bottom", or "any" (default: "any")
	Role *string `json:"role"`
	// Filter by the performer's own ethnicities (OR match)
	SelfEthnicities []string `json:"self_ethnicities"`
	// Filter by the performer's own countries (OR match)
	SelfCountries []string `json:"self_countries"`
	// Filter by the performer's own rating criterion
	SelfRating *IntCriterionInput `json:"self_rating"`
	// Specific partner performer IDs to filter by (OR match - must have marker with one of these partners)
	PartnerPerformerIDs []string `json:"partner_performer_ids"`
	// Partner's role on the marker: "top", "bottom", or "any" (default: "any")
	PartnerRole *string `json:"partner_role"`
	// Partner's ethnicities to filter by (OR match)
	PartnerEthnicities []string `json:"partner_ethnicities"`
	// Partner's countries to filter by (OR match)
	PartnerCountries []string `json:"partner_countries"`
	// Partner's rating criterion
	PartnerRating *IntCriterionInput `json:"partner_rating"`
}

// PerformerMarkerTagsCriterionInput filters performers by markers with specific tags
type PerformerMarkerTagsCriterionInput struct {
	// Tag IDs to match on markers
	TagIds []string `json:"tag_ids"`
	// Performer's role on the marker: 'top', 'bottom', or 'any' (default: 'any')
	Role *string `json:"role"`
	// Depth for hierarchical tags
	Depth *int `json:"depth"`
	// Modifier for the filter (INCLUDES, INCLUDES_ALL, EXCLUDES)
	Modifier CriterionModifier `json:"modifier"`
}

// PerformerMarkerPartnersCriterionInput filters performers by attributes of their marker partners
type PerformerMarkerPartnersCriterionInput struct {
	// Tag IDs to match on markers (optional)
	TagIds []string `json:"tag_ids"`
	// Depth for hierarchical tags
	Depth *int `json:"depth"`
	// Specific partner performers to filter by (OR match)
	PartnerPerformerIds []string `json:"partner_performer_ids"`
	// Partner's ethnicities to filter by (OR match)
	PartnerEthnicities []string `json:"partner_ethnicities"`
	// Partner's countries to filter by (OR match)
	PartnerCountries []string `json:"partner_countries"`
	// Partner's rating criterion
	PartnerRating *IntCriterionInput `json:"partner_rating"`
	// Partner's role: 'top', 'bottom', or 'any' (default: 'any')
	PartnerRole *string `json:"partner_role"`
	// Modifier for the filter (INCLUDES, EXCLUDES)
	Modifier CriterionModifier `json:"modifier"`
}

// CUSTOM: end

type PerformerCreateInput struct {
	Name           string           `json:"name"`
	Disambiguation *string          `json:"disambiguation"`
	URL            *string          `json:"url"` // deprecated
	Urls           []string         `json:"urls"`
	Gender         *GenderEnum      `json:"gender"`
	Birthdate      *string          `json:"birthdate"`
	Ethnicity      *string          `json:"ethnicity"`
	Country        *string          `json:"country"`
	EyeColor       *string          `json:"eye_color"`
	Height         *string          `json:"height"`
	HeightCm       *int             `json:"height_cm"`
	Measurements   *string          `json:"measurements"`
	FakeTits       *string          `json:"fake_tits"`
	PenisLength    *float64         `json:"penis_length"`
	Circumcised    *CircumcisedEnum `json:"circumcised"`
	CareerLength   *string          `json:"career_length"`
	CareerStart    *string          `json:"career_start"`
	CareerEnd      *string          `json:"career_end"`
	Tattoos        *string          `json:"tattoos"`
	Piercings      *string          `json:"piercings"`
	Aliases        *string          `json:"aliases"`
	AliasList      []string         `json:"alias_list"`
	Twitter        *string          `json:"twitter"`   // deprecated
	Instagram      *string          `json:"instagram"` // deprecated
	Favorite       *bool            `json:"favorite"`
	TagIds         []string         `json:"tag_ids"`
	// This should be a URL or a base64 encoded data URL
	Image         *string        `json:"image"`
	StashIds      []StashIDInput `json:"stash_ids"`
	Rating100     *int           `json:"rating100"`
	Details       *string        `json:"details"`
	DeathDate     *string        `json:"death_date"`
	HairColor     *string        `json:"hair_color"`
	Weight        *int           `json:"weight"`
	IgnoreAutoTag *bool          `json:"ignore_auto_tag"`

	CustomFields map[string]interface{} `json:"custom_fields"`
}

type PerformerUpdateInput struct {
	ID             string           `json:"id"`
	Name           *string          `json:"name"`
	Disambiguation *string          `json:"disambiguation"`
	URL            *string          `json:"url"` // deprecated
	Urls           []string         `json:"urls"`
	Gender         *GenderEnum      `json:"gender"`
	Birthdate      *string          `json:"birthdate"`
	Ethnicity      *string          `json:"ethnicity"`
	Country        *string          `json:"country"`
	EyeColor       *string          `json:"eye_color"`
	Height         *string          `json:"height"`
	HeightCm       *int             `json:"height_cm"`
	Measurements   *string          `json:"measurements"`
	FakeTits       *string          `json:"fake_tits"`
	PenisLength    *float64         `json:"penis_length"`
	Circumcised    *CircumcisedEnum `json:"circumcised"`
	CareerLength   *string          `json:"career_length"`
	CareerStart    *string          `json:"career_start"`
	CareerEnd      *string          `json:"career_end"`
	Tattoos        *string          `json:"tattoos"`
	Piercings      *string          `json:"piercings"`
	Aliases        *string          `json:"aliases"`
	AliasList      []string         `json:"alias_list"`
	Twitter        *string          `json:"twitter"`   // deprecated
	Instagram      *string          `json:"instagram"` // deprecated
	Favorite       *bool            `json:"favorite"`
	TagIds         []string         `json:"tag_ids"`
	// This should be a URL or a base64 encoded data URL
	Image         *string        `json:"image"`
	StashIds      []StashIDInput `json:"stash_ids"`
	Rating100     *int           `json:"rating100"`
	Details       *string        `json:"details"`
	DeathDate     *string        `json:"death_date"`
	HairColor     *string        `json:"hair_color"`
	Weight        *int           `json:"weight"`
	IgnoreAutoTag *bool          `json:"ignore_auto_tag"`

	CustomFields CustomFieldsInput `json:"custom_fields"`
}
