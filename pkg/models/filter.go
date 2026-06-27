package models

import (
	"fmt"
	"io"
	"strconv"
)

type OperatorFilter[T any] struct {
	And *T `json:"AND"`
	Or  *T `json:"OR"`
	Not *T `json:"NOT"`
}

// SubFilter returns the subfilter of the operator filter.
// Only one of And, Or, or Not should be set, so it returns the first of these that are not nil.
func (f *OperatorFilter[T]) SubFilter() *T {
	if f.And != nil {
		return f.And
	}
	if f.Or != nil {
		return f.Or
	}
	if f.Not != nil {
		return f.Not
	}
	return nil
}

type CriterionModifier string

const (
	// =
	CriterionModifierEquals CriterionModifier = "EQUALS"
	// !=
	CriterionModifierNotEquals CriterionModifier = "NOT_EQUALS"
	// >
	CriterionModifierGreaterThan CriterionModifier = "GREATER_THAN"
	// >=
	CriterionModifierGreaterThanEquals CriterionModifier = "GREATER_THAN_EQUALS" // CUSTOM
	// <
	CriterionModifierLessThan CriterionModifier = "LESS_THAN"
	// <=
	CriterionModifierLessThanEquals CriterionModifier = "LESS_THAN_EQUALS" // CUSTOM
	// IS NULL
	CriterionModifierIsNull CriterionModifier = "IS_NULL"
	// IS NOT NULL
	CriterionModifierNotNull CriterionModifier = "NOT_NULL"
	// INCLUDES ALL
	CriterionModifierIncludesAll CriterionModifier = "INCLUDES_ALL"
	CriterionModifierIncludes    CriterionModifier = "INCLUDES"
	CriterionModifierExcludes    CriterionModifier = "EXCLUDES"
	// MATCHES REGEX
	CriterionModifierMatchesRegex CriterionModifier = "MATCHES_REGEX"
	// NOT MATCHES REGEX
	CriterionModifierNotMatchesRegex CriterionModifier = "NOT_MATCHES_REGEX"
	// >= AND <=
	CriterionModifierBetween CriterionModifier = "BETWEEN"
	// < OR >
	CriterionModifierNotBetween CriterionModifier = "NOT_BETWEEN"
)

var AllCriterionModifier = []CriterionModifier{
	CriterionModifierEquals,
	CriterionModifierNotEquals,
	CriterionModifierGreaterThan,
	CriterionModifierGreaterThanEquals, // CUSTOM
	CriterionModifierLessThan,
	CriterionModifierLessThanEquals, // CUSTOM
	CriterionModifierIsNull,
	CriterionModifierNotNull,
	CriterionModifierIncludesAll,
	CriterionModifierIncludes,
	CriterionModifierExcludes,
	CriterionModifierMatchesRegex,
	CriterionModifierNotMatchesRegex,
	CriterionModifierBetween,
	CriterionModifierNotBetween,
}

func (e CriterionModifier) IsValid() bool {
	switch e {
	case CriterionModifierEquals, CriterionModifierNotEquals, CriterionModifierGreaterThan, CriterionModifierGreaterThanEquals, CriterionModifierLessThan, CriterionModifierLessThanEquals, CriterionModifierIsNull, CriterionModifierNotNull, CriterionModifierIncludesAll, CriterionModifierIncludes, CriterionModifierExcludes, CriterionModifierMatchesRegex, CriterionModifierNotMatchesRegex, CriterionModifierBetween, CriterionModifierNotBetween: // CUSTOM: added GreaterThanEquals, LessThanEquals
		return true
	}
	return false
}

func (e CriterionModifier) String() string {
	return string(e)
}

func (e *CriterionModifier) UnmarshalGQL(v interface{}) error {
	str, ok := v.(string)
	if !ok {
		return fmt.Errorf("enums must be strings")
	}

	*e = CriterionModifier(str)
	if !e.IsValid() {
		return fmt.Errorf("%s is not a valid CriterionModifier", str)
	}
	return nil
}

func (e CriterionModifier) MarshalGQL(w io.Writer) {
	fmt.Fprint(w, strconv.Quote(e.String()))
}

type StringCriterionInput struct {
	Value    string            `json:"value"`
	Modifier CriterionModifier `json:"modifier"`
}

func (i StringCriterionInput) ValidModifier() bool {
	switch i.Modifier {
	case CriterionModifierEquals, CriterionModifierNotEquals, CriterionModifierIncludes, CriterionModifierExcludes, CriterionModifierMatchesRegex, CriterionModifierNotMatchesRegex,
		CriterionModifierIsNull, CriterionModifierNotNull:
		return true
	}

	return false
}

type IntCriterionInput struct {
	Value    int               `json:"value"`
	Value2   *int              `json:"value2"`
	Modifier CriterionModifier `json:"modifier"`
}

func (i IntCriterionInput) ValidModifier() bool {
	switch i.Modifier {
	case CriterionModifierEquals, CriterionModifierNotEquals, CriterionModifierGreaterThan, CriterionModifierGreaterThanEquals, CriterionModifierLessThan, CriterionModifierLessThanEquals, CriterionModifierIsNull, CriterionModifierNotNull, CriterionModifierBetween, CriterionModifierNotBetween: // CUSTOM: added GreaterThanEquals, LessThanEquals
		return true
	}
	return false
}

type FloatCriterionInput struct {
	Value    float64           `json:"value"`
	Value2   *float64          `json:"value2"`
	Modifier CriterionModifier `json:"modifier"`
}

func (i FloatCriterionInput) ValidModifier() bool {
	switch i.Modifier {
	case CriterionModifierEquals, CriterionModifierNotEquals, CriterionModifierGreaterThan, CriterionModifierGreaterThanEquals, CriterionModifierLessThan, CriterionModifierLessThanEquals, CriterionModifierIsNull, CriterionModifierNotNull, CriterionModifierBetween, CriterionModifierNotBetween: // CUSTOM: added GreaterThanEquals, LessThanEquals
		return true
	}
	return false
}

type ResolutionCriterionInput struct {
	Value    ResolutionEnum    `json:"value"`
	Modifier CriterionModifier `json:"modifier"`
}

type HierarchicalMultiCriterionInput struct {
	Value    []string          `json:"value"`
	Modifier CriterionModifier `json:"modifier"`
	Depth    *int              `json:"depth"`
	Excludes []string          `json:"excludes"`
}

func (i HierarchicalMultiCriterionInput) CombineExcludes() HierarchicalMultiCriterionInput {
	ii := i
	if ii.Modifier == CriterionModifierExcludes {
		ii.Modifier = CriterionModifierIncludesAll
		ii.Excludes = append(ii.Excludes, ii.Value...)
		ii.Value = nil
	}

	return ii
}

type MultiCriterionInput struct {
	Value    []string          `json:"value"`
	Modifier CriterionModifier `json:"modifier"`
	Excludes []string          `json:"excludes"`
}

// CUSTOM: begin
// EthnicityCountInput specifies a minimum count of performers with a given ethnicity
type EthnicityCountInput struct {
	Ethnicity string `json:"ethnicity"`
	MinCount  int    `json:"min_count"`
}

// CountryCountInput specifies a minimum count of performers from a given country
type CountryCountInput struct {
	Country  string `json:"country"`
	MinCount int    `json:"min_count"`
}

// UnnamedPerformerCriterionInput represents criteria for matching a distinct performer
// Each slot must match a DIFFERENT performer that satisfies ALL the criteria
// The ID is used to correlate the same unnamed performer across different marker groups
type UnnamedPerformerCriterionInput struct {
	ID             *string                    `json:"id"` // Used to correlate across marker groups
	Ethnicities    []string                   `json:"ethnicities"`
	Countries      []string                   `json:"countries"`
	Rating         *IntCriterionInput         `json:"rating"`
	RatingCriteria *RatingCriteriaFilterInput `json:"rating_criteria"` // CUSTOM
}

// SceneMarkerTagGroupInput represents a group for scene marker tags filtering
// with optional performer attributes
type SceneMarkerTagGroupInput struct {
	TagIDs                []string `json:"tag_ids"`
	ExcludeTagIDs         []string `json:"exclude_tag_ids"`           // Tags that must NOT be present on any marker
	ExcludeTagIDsOnMarker []string `json:"exclude_tag_ids_on_marker"` // Tags that must NOT be present on the matched marker
	Depth                 *int     `json:"depth"`

	// Top criteria
	TopPerformerIDs    []string              `json:"top_performer_ids"`
	TopAnyCount        *int                  `json:"top_any_count"` // Minimum number of ANY top performers required
	TopEthnicities     []string              `json:"top_ethnicities"`
	TopCountries       []string              `json:"top_countries"`
	TopEthnicityCounts []EthnicityCountInput `json:"top_ethnicity_counts"`
	TopCountryCounts   []CountryCountInput   `json:"top_country_counts"`
	TopRating          *IntCriterionInput    `json:"top_rating"`

	// Bottom criteria
	BottomPerformerIDs    []string              `json:"bottom_performer_ids"`
	BottomAnyCount        *int                  `json:"bottom_any_count"` // Minimum number of ANY bottom performers required
	BottomEthnicities     []string              `json:"bottom_ethnicities"`
	BottomCountries       []string              `json:"bottom_countries"`
	BottomEthnicityCounts []EthnicityCountInput `json:"bottom_ethnicity_counts"`
	BottomCountryCounts   []CountryCountInput   `json:"bottom_country_counts"`
	BottomRating          *IntCriterionInput    `json:"bottom_rating"`

	// Both-roles criteria (performer must be BOTH top AND bottom)
	BothRolesPerformerIDs    []string              `json:"both_roles_performer_ids"`
	BothRolesEthnicities     []string              `json:"both_roles_ethnicities"`
	BothRolesCountries       []string              `json:"both_roles_countries"`
	BothRolesEthnicityCounts []EthnicityCountInput `json:"both_roles_ethnicity_counts"`
	BothRolesCountryCounts   []CountryCountInput   `json:"both_roles_country_counts"`
	BothRolesRating          *IntCriterionInput    `json:"both_roles_rating"`

	// Unnamed performer slots - each must match a DISTINCT performer satisfying all criteria
	TopUnnamedPerformers       []UnnamedPerformerCriterionInput `json:"top_unnamed_performers"`
	BottomUnnamedPerformers    []UnnamedPerformerCriterionInput `json:"bottom_unnamed_performers"`
	BothRolesUnnamedPerformers []UnnamedPerformerCriterionInput `json:"both_roles_unnamed_performers"`

	// Mode for performer matching
	PerformerMode *string `json:"performer_mode"` // "AND" or "OR" (default: "OR")

	// DEPRECATED: Use role-specific fields instead
	PerformerCountries   []string           `json:"performer_countries"`
	PerformerEthnicities []string           `json:"performer_ethnicities"`
	PerformerRating      *IntCriterionInput `json:"performer_rating"`
}

// SceneMarkerTagsCriterionInput supports grouped tag semantics for scene marker tag filtering on scenes.
// - For modifier = EQUALS (IS): use Groups, where each inner slice represents tags that must all appear on a single marker.
// - For modifier = INCLUDES / INCLUDES_ALL: use Value as a flat list of tag IDs across any markers on the scene.
// - IS_NULL / NOT_NULL are also supported to check presence/absence of any marker tags.
type SceneMarkerTagsCriterionInput struct {
	Modifier CriterionModifier `json:"modifier"`
	// Used by INCLUDES and INCLUDES_ALL (flat set of tag IDs)
	Value []string `json:"value"`
	// Used by EQUALS (IS): each inner list is a group of tag IDs that must all be present on a single marker
	Groups [][]string `json:"groups"`
	// Extended groups with performer attributes
	GroupsExtended []SceneMarkerTagGroupInput `json:"groups_extended"`
	// Marker requirements that must be satisfied by direct overlapping markers.
	OverlapGroups []SceneMarkerTagGroupInput `json:"overlap_groups"`
	// Exclusion groups with full performer criteria. Each group defines a marker pattern that,
	// when matched, causes the scene to be excluded from results.
	GroupsExtendedExclude []SceneMarkerTagGroupInput `json:"groups_extended_exclude"`
	// Modifier for exclusion groups logic:
	// - INCLUDES_ALL: ALL exclusion groups must match for the scene to be excluded
	// - INCLUDES: ANY exclusion group matching causes the scene to be excluded
	ExcludeModifier *CriterionModifier `json:"exclude_modifier"`
}

// CUSTOM: end

type DateCriterionInput struct {
	Value    string            `json:"value"`
	Value2   *string           `json:"value2"`
	Modifier CriterionModifier `json:"modifier"`
}

type TimestampCriterionInput struct {
	Value    string            `json:"value"`
	Value2   *string           `json:"value2"`
	Modifier CriterionModifier `json:"modifier"`
}

type PhashDistanceCriterionInput struct {
	Value    string            `json:"value"`
	Modifier CriterionModifier `json:"modifier"`
	Distance *int              `json:"distance"`
}

type OrientationCriterionInput struct {
	Value []OrientationEnum `json:"value"`
}

type CustomFieldCriterionInput struct {
	Field    string            `json:"field"`
	Value    []any             `json:"value"`
	Modifier CriterionModifier `json:"modifier"`
}

type FingerprintFilterInput struct {
	Type  string `json:"type"`
	Value string `json:"value"`
	// Hamming distance - defaults to 0
	Distance *int `json:"distance,omitempty"`
}

type VideoFileFilterInput struct {
	Format      *StringCriterionInput      `json:"format,omitempty"`
	Resolution  *ResolutionCriterionInput  `json:"resolution,omitempty"`
	Orientation *OrientationCriterionInput `json:"orientation,omitempty"`
	Framerate   *IntCriterionInput         `json:"framerate,omitempty"`
	Bitrate     *IntCriterionInput         `json:"bitrate,omitempty"`
	VideoCodec  *StringCriterionInput      `json:"video_codec,omitempty"`
	AudioCodec  *StringCriterionInput      `json:"audio_codec,omitempty"`
	// in seconds
	Duration         *IntCriterionInput    `json:"duration,omitempty"`
	Captions         *StringCriterionInput `json:"captions,omitempty"`
	Interactive      *bool                 `json:"interactive,omitempty"`
	InteractiveSpeed *IntCriterionInput    `json:"interactive_speed,omitempty"`
}

type ImageFileFilterInput struct {
	Format      *StringCriterionInput      `json:"format,omitempty"`
	Resolution  *ResolutionCriterionInput  `json:"resolution,omitempty"`
	Orientation *OrientationCriterionInput `json:"orientation,omitempty"`
}
