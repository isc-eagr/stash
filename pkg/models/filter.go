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
	// <
	CriterionModifierLessThan CriterionModifier = "LESS_THAN"
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
	CriterionModifierLessThan,
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
	case CriterionModifierEquals, CriterionModifierNotEquals, CriterionModifierGreaterThan, CriterionModifierLessThan, CriterionModifierIsNull, CriterionModifierNotNull, CriterionModifierIncludesAll, CriterionModifierIncludes, CriterionModifierExcludes, CriterionModifierMatchesRegex, CriterionModifierNotMatchesRegex, CriterionModifierBetween, CriterionModifierNotBetween:
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
	case CriterionModifierEquals, CriterionModifierNotEquals, CriterionModifierGreaterThan, CriterionModifierLessThan, CriterionModifierIsNull, CriterionModifierNotNull, CriterionModifierBetween, CriterionModifierNotBetween:
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
	case CriterionModifierEquals, CriterionModifierNotEquals, CriterionModifierGreaterThan, CriterionModifierLessThan, CriterionModifierIsNull, CriterionModifierNotNull, CriterionModifierBetween, CriterionModifierNotBetween:
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
}

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

// PerformerSceneTagPairInput is a compact input for filtering scenes by a performer+tag pair
type PerformerSceneTagPairInput struct {
	PerformerID string `json:"performer_id"`
	TagID       string `json:"tag_id"`
}

// PerformerSceneTagGroupInput represents a single group in the
// PerformerSceneTagsWithAttrsCriterionInput. Each group requires that at
// least one performer on the scene has the specified tag (from
// performer_scene_tags) and matches the optional attributes.
type PerformerSceneTagGroupInput struct {
	TagIDs             []string           `json:"tag_ids"`
	PerformerCountry   *string            `json:"performer_country"`
	PerformerEthnicity *string            `json:"performer_ethnicity"`
	PerformerRating    *IntCriterionInput `json:"performer_rating"`
}

// PerformerSceneTagsWithAttrsCriterionInput is a grouped input for filtering
// scenes by performer_scene_tags combined with performer attributes. For each
// group, at least one performer must match the tag and provided attributes.
type PerformerSceneTagsWithAttrsCriterionInput struct {
	Groups   []PerformerSceneTagGroupInput `json:"groups"`
	MatchAny *bool                         `json:"match_any"`
}
