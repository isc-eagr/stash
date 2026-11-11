package sqlite

// CUSTOM: performer ethnicity and country criteria shared by the scene,
// gallery, image and scene marker filters.

import (
	"context"
	"fmt"
	"strings"

	"github.com/stashapp/stash/pkg/models"
)

// relatedPerformersCustom says how a filtered row reaches its performers.
type relatedPerformersCustom struct {
	joinTable string // performers_scenes, performers_galleries or performers_images
	joinKey   string // join table column that points at the owner
	ownerRef  string // owner column it must equal, e.g. scenes.id
}

var (
	scenePerformersCustom   = relatedPerformersCustom{"performers_scenes", "scene_id", "scenes.id"}
	galleryPerformersCustom = relatedPerformersCustom{"performers_galleries", "gallery_id", "galleries.id"}
	imagePerformersCustom   = relatedPerformersCustom{"performers_images", "image_id", "images.id"}
	// Markers use the performers of the marker's scene.
	sceneMarkerPerformersCustom = relatedPerformersCustom{"performers_scenes", "scene_id", "scene_markers.scene_id"}
)

// any matches rows that have at least one performer.
func (r relatedPerformersCustom) any() string {
	return fmt.Sprintf("EXISTS (SELECT 1 FROM %s pj WHERE pj.%s = %s)", r.joinTable, r.joinKey, r.ownerRef)
}

// with matches rows that have a performer satisfying cond.
func (r relatedPerformersCustom) with(cond string) string {
	return fmt.Sprintf(
		"EXISTS (SELECT 1 FROM %s pj JOIN performers p ON p.id = pj.performer_id WHERE pj.%s = %s AND %s)",
		r.joinTable, r.joinKey, r.ownerRef, cond,
	)
}

// addAttributeWhere filters by a performer column. Each group holds the
// database values that satisfy one selected value.
//   - INCLUDES (and anything unrecognised): some performer matches any group
//   - INCLUDES_ALL: every group is matched by some performer
//   - EQUALS: every performer matches a group, and every group is matched
//   - NOT_EQUALS: no performer matches any group
func (r relatedPerformersCustom) addAttributeWhere(f *filterBuilder, modifier models.CriterionModifier, column string, groups [][]string) {
	if len(groups) == 0 {
		return
	}

	in := func(values []string) (string, []interface{}) {
		args := make([]interface{}, len(values))
		for i, v := range values {
			args[i] = v
		}
		return sqlitePlaceholders(len(values)), args
	}

	var all []string
	for _, group := range groups {
		all = append(all, group...)
	}
	allPlaceholders, allArgs := in(uniqueStringsCustom(all))

	addEachGroup := func() {
		for _, group := range groups {
			placeholders, args := in(group)
			f.addWhere(r.with(fmt.Sprintf("%s IN (%s)", column, placeholders)), args...)
		}
	}

	switch modifier {
	case models.CriterionModifierIncludesAll:
		addEachGroup()
	case models.CriterionModifierEquals:
		f.addWhere("NOT "+r.with(fmt.Sprintf(
			"(%[1]s IS NULL OR TRIM(%[1]s) = '' OR %[1]s NOT IN (%[2]s))", column, allPlaceholders,
		)), allArgs...)
		f.addWhere(r.any())
		addEachGroup()
	case models.CriterionModifierNotEquals:
		f.addWhere("NOT "+r.with(fmt.Sprintf("%s IN (%s)", column, allPlaceholders)), allArgs...)
		f.addWhere(r.any())
	default:
		f.addWhere(r.with(fmt.Sprintf("%s IN (%s)", column, allPlaceholders)), allArgs...)
		f.addWhere(r.any())
	}
}

// selectedValuesCustom splits a comma-separated criterion value.
func selectedValuesCustom(value string) []string {
	var ret []string
	for _, v := range strings.Split(value, ",") {
		if v = strings.TrimSpace(v); v != "" {
			ret = append(ret, v)
		}
	}
	return ret
}

// ethnicityCriterionHandler filters by the ethnicity of the row's performers.
// Black also matches Mixed and Afrolatino, White matches Mixed, and Latino
// matches Afrolatino.
func (r relatedPerformersCustom) ethnicityCriterionHandler(pe *models.StringCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if pe == nil || !pe.Modifier.IsValid() {
			return
		}

		var groups [][]string
		for _, selected := range selectedValuesCustom(pe.Value) {
			groups = append(groups, expandMarkerEthnicitiesCustom([]string{selected}))
		}
		r.addAttributeWhere(f, pe.Modifier, "p.ethnicity", groups)
	}
}

// countryCriterionHandler filters by the country of the row's performers.
func (r relatedPerformersCustom) countryCriterionHandler(pc *models.StringCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if pc == nil || !pc.Modifier.IsValid() {
			return
		}

		var groups [][]string
		for _, country := range selectedValuesCustom(pc.Value) {
			groups = append(groups, []string{country})
		}
		r.addAttributeWhere(f, pc.Modifier, "p.country", groups)
	}
}
