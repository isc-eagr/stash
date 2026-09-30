package sqlite

// CUSTOM: Custom criterion handlers for scene marker filters.

import (
	"context"
	"fmt"
	"strings"

	"github.com/stashapp/stash/pkg/models"
)

func (qb *sceneMarkerFilterHandler) sceneDirectorCriterionHandler(criterion *models.StringCriterionInput) criterionHandler {
	return criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
		if criterion != nil {
			qb.joinScenes(f)
			stringCriterionHandler(criterion, "scenes.director")(ctx, f)
		}
	})
}

func (qb *sceneMarkerFilterHandler) studiosCriterionHandler(studios *models.HierarchicalMultiCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if studios == nil {
			return
		}

		// Join scenes to get the studio_id
		qb.joinScenes(f)

		h := hierarchicalMultiCriterionHandlerBuilder{
			primaryTable: sceneTable,
			foreignTable: studioTable,
			foreignFK:    studioIDColumn,

			parentFK:       "parent_id",
			childFK:        "id",
			relationsTable: "studios",
		}

		h.handler(studios).handle(ctx, f)
	}
}

// hasEndTimeCriterionHandler filters markers by whether they have an end time set.
func (qb *sceneMarkerFilterHandler) hasEndTimeCriterionHandler(hasEndTime *bool) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if hasEndTime != nil {
			if *hasEndTime {
				f.addWhere("scene_markers.end_seconds IS NOT NULL")
			} else {
				f.addWhere("scene_markers.end_seconds IS NULL")
			}
		}
	}
}

// performerEthnicityCriterionHandler filters markers by ethnicity of performers on the marker's scene.
func (qb *sceneMarkerFilterHandler) performerEthnicityCriterionHandler(pe *models.StringCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if pe == nil {
			return
		}
		if !pe.Modifier.IsValid() {
			return
		}

		selected := []string{}
		for _, e := range strings.Split(pe.Value, ",") {
			e = strings.TrimSpace(e)
			if e != "" {
				selected = append(selected, e)
			}
		}
		if len(selected) == 0 {
			return
		}

		// Expand ethnicity selections to include special cases (same as scenes):
		// - Black matches Black, Mixed, Afrolatino
		// - White matches White, Mixed
		// - Latino matches Latino, Afrolatino
		expandForFilter := func(s string) []string {
			out := []string{s}
			if strings.EqualFold(s, "Black") {
				out = append(out, "Mixed", "Afrolatino")
			}
			if strings.EqualFold(s, "White") {
				out = append(out, "Mixed")
			}
			if strings.EqualFold(s, "Latino") {
				out = append(out, "Afrolatino")
			}
			return out
		}

		allowedSet := map[string]struct{}{}
		for _, s := range selected {
			for _, v := range expandForFilter(s) {
				allowedSet[v] = struct{}{}
			}
		}
		allowed := make([]string, 0, len(allowedSet))
		for v := range allowedSet {
			allowed = append(allowed, v)
		}

		placeholders := strings.Repeat("?,", len(allowed))
		placeholders = placeholders[:len(placeholders)-1]
		args := make([]interface{}, len(allowed))
		for i, v := range allowed {
			args[i] = v
		}

		existsPerformer := "EXISTS (SELECT 1 FROM performers_scenes ps WHERE ps.scene_id = scene_markers.scene_id)"

		switch pe.Modifier {
		case models.CriterionModifierIncludes:
			clause := fmt.Sprintf("EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scene_markers.scene_id AND p.ethnicity IN (%s))", placeholders)
			f.addWhere(clause, args...)
			f.addWhere(existsPerformer)
		case models.CriterionModifierIncludesAll:
			for _, s := range selected {
				group := expandForFilter(s)
				ph := strings.Repeat("?,", len(group))
				ph = ph[:len(ph)-1]
				gargs := make([]interface{}, len(group))
				for i, v := range group {
					gargs[i] = v
				}
				f.addWhere(fmt.Sprintf("EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scene_markers.scene_id AND p.ethnicity IN (%s))", ph), gargs...)
			}
		case models.CriterionModifierEquals:
			clause := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scene_markers.scene_id AND (p.ethnicity IS NULL OR TRIM(p.ethnicity) = '' OR p.ethnicity NOT IN (%s)))", placeholders)
			f.addWhere(clause, args...)
			f.addWhere(existsPerformer)
			for _, s := range selected {
				group := expandForFilter(s)
				ph := strings.Repeat("?,", len(group))
				ph = ph[:len(ph)-1]
				gargs := make([]interface{}, len(group))
				for i, v := range group {
					gargs[i] = v
				}
				f.addWhere(fmt.Sprintf("EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scene_markers.scene_id AND p.ethnicity IN (%s))", ph), gargs...)
			}
		case models.CriterionModifierNotEquals:
			clause := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scene_markers.scene_id AND p.ethnicity IN (%s))", placeholders)
			f.addWhere(clause, args...)
			f.addWhere(existsPerformer)
		default:
			clause := fmt.Sprintf("EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scene_markers.scene_id AND p.ethnicity IN (%s))", placeholders)
			f.addWhere(clause, args...)
			f.addWhere(existsPerformer)
		}
	}
}

// performerCountryCriterionHandler filters markers by country of performers on the marker's scene.
func (qb *sceneMarkerFilterHandler) performerCountryCriterionHandler(pc *models.StringCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if pc == nil {
			return
		}
		if !pc.Modifier.IsValid() {
			return
		}

		countries := []string{}
		for _, c := range strings.Split(pc.Value, ",") {
			c = strings.TrimSpace(c)
			if c != "" {
				countries = append(countries, c)
			}
		}
		if len(countries) == 0 {
			return
		}

		placeholders := strings.Repeat("?,", len(countries))
		placeholders = placeholders[:len(placeholders)-1]
		args := make([]interface{}, len(countries))
		for i, v := range countries {
			args[i] = v
		}

		existsPerformer := "EXISTS (SELECT 1 FROM performers_scenes ps WHERE ps.scene_id = scene_markers.scene_id)"

		switch pc.Modifier {
		case models.CriterionModifierIncludes:
			clause := fmt.Sprintf("EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scene_markers.scene_id AND p.country IN (%s))", placeholders)
			f.addWhere(clause, args...)
			f.addWhere(existsPerformer)
		case models.CriterionModifierIncludesAll:
			for _, c := range countries {
				f.addWhere("EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scene_markers.scene_id AND p.country = ?)", c)
			}
		case models.CriterionModifierEquals:
			clause := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scene_markers.scene_id AND (p.country IS NULL OR TRIM(p.country) = '' OR p.country NOT IN (%s)))", placeholders)
			f.addWhere(clause, args...)
			f.addWhere(existsPerformer)
			for _, c := range countries {
				f.addWhere("EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scene_markers.scene_id AND p.country = ?)", c)
			}
		case models.CriterionModifierNotEquals:
			clause := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scene_markers.scene_id AND p.country IN (%s))", placeholders)
			f.addWhere(clause, args...)
			f.addWhere(existsPerformer)
		default:
			clause := fmt.Sprintf("EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scene_markers.scene_id AND p.country IN (%s))", placeholders)
			f.addWhere(clause, args...)
			f.addWhere(existsPerformer)
		}
	}
}

// performerRatingCriterionHandler filters markers by rating of performers on the marker's scene.
func (qb *sceneMarkerFilterHandler) performerRatingCriterionHandler(sceneMarkerFilter *models.SceneMarkerFilterType) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if sceneMarkerFilter.PerformerRating == nil {
			return
		}

		pr := sceneMarkerFilter.PerformerRating
		// default to ALL performers must satisfy unless explicitly overridden
		modeAll := true
		if sceneMarkerFilter.PerformerRatingAll != nil {
			modeAll = *sceneMarkerFilter.PerformerRatingAll
		}

		if !modeAll {
			// ANY performer must satisfy: simple join + numeric comparison via marker's scene
			f.addInnerJoin("performers_scenes", "", "performers_scenes.scene_id = scene_markers.scene_id")
			f.addInnerJoin("performers", "", "performers_scenes.performer_id = performers.id")
			intCriterionHandler(pr, "performers.rating", nil)(ctx, f)
			return
		}

		// ALL performers must satisfy: ensure no violating performer exists and at least one performer exists
		existsPerformer := "EXISTS (SELECT 1 FROM performers_scenes ps WHERE ps.scene_id = scene_markers.scene_id)"
		switch pr.Modifier {
		case models.CriterionModifierEquals:
			f.addWhere("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scene_markers.scene_id AND (p.rating IS NULL OR p.rating != ?))", pr.Value)
			f.addWhere(existsPerformer)
		case models.CriterionModifierNotEquals:
			f.addWhere("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scene_markers.scene_id AND p.rating = ?)", pr.Value)
			f.addWhere(existsPerformer)
		case models.CriterionModifierGreaterThan:
			f.addWhere("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scene_markers.scene_id AND (p.rating IS NULL OR p.rating <= ?))", pr.Value)
			f.addWhere(existsPerformer)
		case models.CriterionModifierLessThan:
			f.addWhere("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scene_markers.scene_id AND (p.rating IS NULL OR p.rating >= ?))", pr.Value)
			f.addWhere(existsPerformer)
		case models.CriterionModifierBetween:
			f.addWhere("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scene_markers.scene_id AND (p.rating IS NULL OR p.rating < ? OR p.rating > ?))", pr.Value, pr.Value2)
			f.addWhere(existsPerformer)
		case models.CriterionModifierNotBetween:
			f.addWhere("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scene_markers.scene_id AND (p.rating IS NULL OR (p.rating >= ? AND p.rating <= ?)))", pr.Value, pr.Value2)
			f.addWhere(existsPerformer)
		case models.CriterionModifierNotNull:
			f.addWhere("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scene_markers.scene_id AND p.rating IS NULL)")
			f.addWhere(existsPerformer)
		case models.CriterionModifierIsNull:
			f.addWhere("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scene_markers.scene_id AND p.rating IS NOT NULL)")
			f.addWhere(existsPerformer)
		default:
			f.addInnerJoin("performers_scenes", "", "performers_scenes.scene_id = scene_markers.scene_id")
			f.addInnerJoin("performers", "", "performers_scenes.performer_id = performers.id")
			intCriterionHandler(pr, "performers.rating", nil)(ctx, f)
		}
	}
}

// scenePerformerCountCriterionHandler filters by the number of performers on the marker's scene
func (qb *sceneMarkerFilterHandler) scenePerformerCountCriterionHandler(count *models.IntCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if count == nil {
			return
		}

		// Join scenes to get the scene_id for performer count
		qb.joinScenes(f)

		// Create a subquery to count performers on the scene
		countColumn := "(SELECT COUNT(*) FROM performers_scenes ps WHERE ps.scene_id = scene_markers.scene_id)"
		intCriterionHandler(count, countColumn, nil)(ctx, f)
	}
}

// hasMarkerPerformersCriterionHandler filters by whether the marker has performers assigned directly to it
func (qb *sceneMarkerFilterHandler) hasMarkerPerformersCriterionHandler(hasPerformers *string) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if hasPerformers == nil || *hasPerformers == "" {
			return
		}

		if *hasPerformers == "true" {
			// Marker has at least one performer assigned
			f.addWhere("EXISTS (SELECT 1 FROM scene_marker_performers smp WHERE smp.scene_marker_id = scene_markers.id)")
		} else {
			// Marker has no performers assigned
			f.addWhere("NOT EXISTS (SELECT 1 FROM scene_marker_performers smp WHERE smp.scene_marker_id = scene_markers.id)")
		}
	}
}

// hasRolesCriterionHandler filters markers by whether they have tops/bottoms assigned.
// - Both true: markers with at least 1 top AND at least 1 bottom
// - HasTops true, HasBottoms false: markers with at least 1 top AND 0 bottoms
// - HasTops false, HasBottoms true: markers with 0 tops AND at least 1 bottom
// - Both false: markers with 0 tops AND 0 bottoms
func (qb *sceneMarkerFilterHandler) hasRolesCriterionHandler(input *models.HasRolesCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if input == nil {
			return
		}

		// Filter by tops
		if input.HasTops {
			// Has at least one performer as top
			f.addWhere("EXISTS (SELECT 1 FROM scene_marker_performers smp WHERE smp.scene_marker_id = scene_markers.id AND smp.role = 'top')")
		} else {
			// Has no performers as tops
			f.addWhere("NOT EXISTS (SELECT 1 FROM scene_marker_performers smp WHERE smp.scene_marker_id = scene_markers.id AND smp.role = 'top')")
		}

		// Filter by bottoms
		if input.HasBottoms {
			// Has at least one performer as bottom
			f.addWhere("EXISTS (SELECT 1 FROM scene_marker_performers smp WHERE smp.scene_marker_id = scene_markers.id AND smp.role = 'bottom')")
		} else {
			// Has no performers as bottoms
			f.addWhere("NOT EXISTS (SELECT 1 FROM scene_marker_performers smp WHERE smp.scene_marker_id = scene_markers.id AND smp.role = 'bottom')")
		}
	}
}

// markerTagsWithPerformersCriterionHandler filters markers by Marker Match
// configurations, using the same marker semantics as Scene Markers.
//   - One configuration returns each matching marker that carries a requested
//     tag itself, unless a shorter overlapping marker matches the same
//     configuration.
//   - Several configurations must match different, mutually overlapping
//     markers; the shortest of them is returned.
//
// Empty configurations are ignored. Separate groups_extended entries are
// alternatives.
func (qb *sceneMarkerFilterHandler) markerTagsWithPerformersCriterionHandler(input *models.SceneMarkerTagsCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if input == nil {
			return
		}

		// Handle IS_NULL / NOT_NULL modifiers for simple presence checks
		if input.Modifier == models.CriterionModifierIsNull || input.Modifier == models.CriterionModifierNotNull {
			var notClause string
			if input.Modifier == models.CriterionModifierNotNull {
				notClause = "NOT"
			}
			f.addLeftJoin("scene_markers_tags", "", "scene_markers.id = scene_markers_tags.scene_marker_id")
			f.addWhere(fmt.Sprintf("scene_markers_tags.tag_id IS %s NULL", notClause))
			return
		}

		negate := input.Modifier == models.CriterionModifierNotEquals
		add := func(clause sqlClause) {
			if negate {
				clause = clause.not()
			}
			f.addWhere(clause.sql, clause.args...)
		}

		overlap := nonEmptyMarkerGroupsCustom(normalizeSceneMarkerTagGroupsSameUnnamedRolesCustom(input.OverlapGroups))
		if len(overlap) > 0 {
			const prefix = "sm_overlap_req"
			assignment, err := sceneMarkerAssignmentCustom(ctx, overlap, "scene_markers.scene_id", prefix, true, true)
			if err != nil {
				f.setError(err)
				return
			}
			var shortest []string
			for i := range overlap {
				current := markerAssignmentAliasCustom(prefix, i)
				var narrower []string
				for j := range overlap {
					if i != j {
						narrower = append(narrower, sceneMarkerIsNarrowerThanClauseCustom(markerAssignmentAliasCustom(prefix, j), current))
					}
				}
				noNarrower := "1=1"
				if len(narrower) > 0 {
					noNarrower = "NOT (" + strings.Join(narrower, " OR ") + ")"
				}
				shortest = append(shortest, fmt.Sprintf("(scene_markers.id = %s.id AND %s)", current, noNarrower))
			}
			add(assignment.exists(makeClause("(" + strings.Join(shortest, " OR ") + ")")))
		}

		groups := nonEmptyMarkerGroupsCustom(normalizeSceneMarkerTagGroupsSameUnnamedRolesCustom(input.GroupsExtended))
		if len(groups) == 0 {
			return
		}
		var alternatives []sqlClause
		for _, g := range groups {
			clause, err := markerSingleConfigurationClauseCustom(ctx, g)
			if err != nil {
				f.setError(err)
				return
			}
			alternatives = append(alternatives, clause)
		}
		add(joinClausesCustom(alternatives, " OR "))
	}
}

// markerSingleConfigurationClauseCustom matches scene_markers against one
// configuration. The returned marker must carry a requested tag itself, and a
// shorter overlapping marker matching the whole configuration (tags and vatos)
// hides it.
func markerSingleConfigurationClauseCustom(ctx context.Context, g models.SceneMarkerTagGroupInput) (sqlClause, error) {
	tagIDs := uniqueStringsCustom(g.TagIDs)
	// With one tag family a direct match is the whole tag requirement, so the
	// inherited-tag scan is skipped.
	builder := markerGroupSQLCustom{ctx: ctx, direct: len(tagIDs) == 1}
	current, err := builder.condition(g, "scene_markers")
	if err != nil || len(tagIDs) == 0 {
		return current, err
	}

	families, err := markerTagFamiliesCustom(ctx, g)
	if err != nil {
		return sqlClause{}, err
	}
	var directIDs []string
	for _, family := range families {
		directIDs = append(directIDs, family...)
	}
	directIDs = uniqueStringsCustom(directIDs)
	if len(directIDs) == 0 {
		return makeClause("0=1"), nil
	}
	narrow, err := builder.condition(g, "sm_narrow")
	if err != nil {
		return sqlClause{}, err
	}

	ph := getInBinding(len(directIDs))
	parts := []sqlClause{current}
	narrowParts := []sqlClause{
		makeClause(sceneMarkerOverlapWhereCustom("scene_markers", "sm_narrow")),
		makeClause(sceneMarkerIsNarrowerThanClauseCustom("sm_narrow", "scene_markers")),
		narrow,
	}
	if len(tagIDs) > 1 {
		parts = append([]sqlClause{makeClause(sceneMarkerDirectHasTagInClauseCustom("scene_markers", ph), stringArgsCustom(directIDs)...)}, parts...)
		narrowParts = append(narrowParts, makeClause(sceneMarkerDirectHasTagInClauseCustom("sm_narrow", ph), stringArgsCustom(directIDs)...))
	}
	narrowWhere := joinClausesCustom(narrowParts, "\n  AND ")
	parts = append(parts, sqlClause{
		sql:  "NOT EXISTS (\nSELECT 1 FROM scene_markers sm_narrow\nWHERE " + narrowWhere.sql + "\n)",
		args: narrowWhere.args,
	})
	return joinClausesCustom(parts, " AND "), nil
}

// customFiltersCriterionHandler applies predefined complex filters for scene markers.
// Options:
// - 'circular_oral': Markers tagged with oralTagId (or subtag) where all performers are both tops and bottoms
// Note: All tag checks include both primary_tag_id and secondary tags (scene_markers_tags)
func (qb *sceneMarkerFilterHandler) customFiltersCriterionHandler(customFilters *models.CustomSceneMarkerFilterInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if customFilters == nil || customFilters.Type == "" {
			return
		}

		switch customFilters.Type {
		case "circular_oral":
			// Use oralTagId if provided, otherwise return early
			if customFilters.OralTagID == nil || *customFilters.OralTagID == "" {
				return
			}
			oralTagID := *customFilters.OralTagID

			addSceneMarkerCircularOralFilterCustom(f, oralTagID)
		}
	}
}
