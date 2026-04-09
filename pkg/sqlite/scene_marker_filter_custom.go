package sqlite

// CUSTOM: Custom criterion handlers for scene marker filters.

import (
	"context"
	"fmt"
	"strings"

	"github.com/stashapp/stash/pkg/models"
)

// getRatingComparison returns the SQL comparison operator and column expression for a rating criterion.
// Returns the column condition like "p.rating >= ?" based on the modifier.
func getRatingComparison(columnName string, rating *models.IntCriterionInput) (string, int) {
	if rating == nil {
		return "", 0
	}

	var op string
	switch rating.Modifier {
	case models.CriterionModifierGreaterThan:
		op = ">="
	case models.CriterionModifierLessThan:
		op = "<="
	default:
		// Default to EQUALS
		op = "="
	}

	return fmt.Sprintf("%s %s ?", columnName, op), rating.Value
}

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
			childFK:        "child_id",
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

// markerTagsWithPerformersCriterionHandler filters markers by tags with performer attributes.
//
// Logic (simplified):
// - Tags: Marker must have ALL specified tags (primary or secondary). With depth=-1, subtags also match.
// - Named performers: ALL specified performers must be present in their specified role.
// - Unnamed performers: Each slot represents a DISTINCT performer matching the criteria.
// - If same unnamed performer is in both top and bottom arrays, they must have BOTH roles.
//
// Groups are combined with OR logic - at least one group must match.
func (qb *sceneMarkerFilterHandler) markerTagsWithPerformersCriterionHandler(input *models.SceneMarkerTagsCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if input == nil {
			return
		}

		// Helper to expand ethnicity selections (Black includes Mixed and Afrolatino, etc.)
		expandEthnicities := func(ethnicities []string) []string {
			var out []string
			seen := make(map[string]bool)
			for _, e := range ethnicities {
				v := strings.TrimSpace(e)
				if v == "" {
					continue
				}
				if !seen[v] {
					seen[v] = true
					out = append(out, v)
				}
				if strings.EqualFold(v, "Black") {
					for _, exp := range []string{"Mixed", "Afrolatino"} {
						if !seen[exp] {
							seen[exp] = true
							out = append(out, exp)
						}
					}
				}
				if strings.EqualFold(v, "White") {
					if !seen["Mixed"] {
						seen["Mixed"] = true
						out = append(out, "Mixed")
					}
				}
				if strings.EqualFold(v, "Latino") {
					if !seen["Afrolatino"] {
						seen["Afrolatino"] = true
						out = append(out, "Afrolatino")
					}
				}
			}
			return out
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

		// Process groups_extended (the main filter path)
		if len(input.GroupsExtended) == 0 {
			return
		}

		var groupClauses []string
		var allArgs []interface{}

		for _, g := range input.GroupsExtended {
			// Separate tag conditions from performer conditions for OR mode support
			var tagConditions []string
			var tagArgs []interface{}
			var performerConditions []string
			var performerArgs []interface{}

			// Determine performer mode: default is AND
			performerMode := "AND"
			if g.PerformerMode != nil && *g.PerformerMode == "OR" {
				performerMode = "OR"
			}

			// ===== TAG MATCHING =====
			// Each tag must be present (primary OR secondary). With depth, include subtags.
			if len(g.TagIDs) > 0 {
				depthUsed := g.Depth != nil && *g.Depth != 0

				for _, tagID := range g.TagIDs {
					if depthUsed {
						// Expand tag to include descendants
						valuesClause, err := getHierarchicalValues(ctx, []string{tagID}, tagTable, "tags_relations", "parent_id", "child_id", g.Depth)
						if err != nil {
							f.setError(err)
							return
						}
						var expandedIDs []string
						expandQuery := fmt.Sprintf("SELECT DISTINCT column2 FROM (%s)", valuesClause)
						if err := dbWrapper.Select(ctx, &expandedIDs, expandQuery); err != nil {
							f.setError(err)
							return
						}
						if len(expandedIDs) > 0 {
							ph := getInBinding(len(expandedIDs))
							// Marker must have this tag or any of its subtags as primary or secondary
							tagCond := fmt.Sprintf(`(
								scene_markers.primary_tag_id IN %s
								OR EXISTS (
									SELECT 1 FROM scene_markers_tags smt 
									WHERE smt.scene_marker_id = scene_markers.id 
									AND smt.tag_id IN %s
								)
							)`, ph, ph)
							tagConditions = append(tagConditions, tagCond)
							for _, tid := range expandedIDs {
								tagArgs = append(tagArgs, tid)
							}
							for _, tid := range expandedIDs {
								tagArgs = append(tagArgs, tid)
							}
						}
					} else {
						// Exact tag match (no subtags)
						tagCond := `(
							scene_markers.primary_tag_id = ?
							OR EXISTS (
								SELECT 1 FROM scene_markers_tags smt 
								WHERE smt.scene_marker_id = scene_markers.id 
								AND smt.tag_id = ?
							)
						)`
						tagConditions = append(tagConditions, tagCond)
						tagArgs = append(tagArgs, tagID, tagID)
					}
				}
			}

			// ===== NAMED TOP PERFORMERS =====
			// ALL specified top performers must be present as tops on this marker
			if len(g.TopPerformerIDs) > 0 {
				for _, perfID := range g.TopPerformerIDs {
					cond := `EXISTS (
						SELECT 1 FROM scene_marker_performers smp 
						WHERE smp.scene_marker_id = scene_markers.id 
						AND smp.performer_id = ? 
						AND smp.role = 'top'
					)`
					performerConditions = append(performerConditions, cond)
					performerArgs = append(performerArgs, perfID)
				}
			}

			// ===== NAMED BOTTOM PERFORMERS =====
			// ALL specified bottom performers must be present as bottoms on this marker
			if len(g.BottomPerformerIDs) > 0 {
				for _, perfID := range g.BottomPerformerIDs {
					cond := `EXISTS (
						SELECT 1 FROM scene_marker_performers smp 
						WHERE smp.scene_marker_id = scene_markers.id 
						AND smp.performer_id = ? 
						AND smp.role = 'bottom'
					)`
					performerConditions = append(performerConditions, cond)
					performerArgs = append(performerArgs, perfID)
				}
			}

			// ===== NAMED BOTH-ROLES PERFORMERS =====
			// ALL specified both-roles performers must appear as BOTH top AND bottom
			if len(g.BothRolesPerformerIDs) > 0 {
				for _, perfID := range g.BothRolesPerformerIDs {
					cond := `(
						EXISTS (
							SELECT 1 FROM scene_marker_performers smp 
							WHERE smp.scene_marker_id = scene_markers.id 
							AND smp.performer_id = ? 
							AND smp.role = 'top'
						)
						AND EXISTS (
							SELECT 1 FROM scene_marker_performers smp 
							WHERE smp.scene_marker_id = scene_markers.id 
							AND smp.performer_id = ? 
							AND smp.role = 'bottom'
						)
					)`
					performerConditions = append(performerConditions, cond)
					performerArgs = append(performerArgs, perfID, perfID)
				}
			}

			// ===== UNNAMED TOP PERFORMERS =====
			// Each slot must match a DISTINCT performer with the given criteria as a top
			if len(g.TopUnnamedPerformers) > 0 {
				for i, slot := range g.TopUnnamedPerformers {
					alias := fmt.Sprintf("upt%d", i)
					palias := fmt.Sprintf("uptp%d", i)

					var slotConds []string
					var slotArgs []interface{}

					slotConds = append(slotConds, fmt.Sprintf("%s.role = 'top'", alias))

					if len(slot.Ethnicities) > 0 {
						expanded := expandEthnicities(slot.Ethnicities)
						ph := getInBinding(len(expanded))
						slotConds = append(slotConds, fmt.Sprintf("%s.ethnicity IN %s", palias, ph))
						for _, e := range expanded {
							slotArgs = append(slotArgs, e)
						}
					}

					if len(slot.Countries) > 0 {
						ph := getInBinding(len(slot.Countries))
						slotConds = append(slotConds, fmt.Sprintf("%s.country IN %s", palias, ph))
						for _, c := range slot.Countries {
							slotArgs = append(slotArgs, c)
						}
					}

					if slot.Rating != nil {
						ratingCond, ratingVal := getRatingComparison(palias+".rating", slot.Rating)
						slotConds = append(slotConds, ratingCond)
						slotArgs = append(slotArgs, ratingVal)
					}

					existsCond := fmt.Sprintf(`EXISTS (
						SELECT 1 FROM scene_marker_performers %s
						JOIN performers %s ON %s.id = %s.performer_id
						WHERE %s.scene_marker_id = scene_markers.id
						AND %s
					)`, alias, palias, palias, alias, alias, strings.Join(slotConds, " AND "))

					performerConditions = append(performerConditions, existsCond)
					performerArgs = append(performerArgs, slotArgs...)
				}

				// If multiple top unnamed performers, ensure they are DISTINCT
				if len(g.TopUnnamedPerformers) > 1 {
					var unionParts []string
					var countArgs []interface{}

					for i, slot := range g.TopUnnamedPerformers {
						alias := fmt.Sprintf("upt_cnt%d", i)
						palias := fmt.Sprintf("uptp_cnt%d", i)

						var slotConds []string
						slotConds = append(slotConds, fmt.Sprintf("%s.role = 'top'", alias))
						slotConds = append(slotConds, fmt.Sprintf("%s.scene_marker_id = scene_markers.id", alias))

						if len(slot.Ethnicities) > 0 {
							expanded := expandEthnicities(slot.Ethnicities)
							ph := getInBinding(len(expanded))
							slotConds = append(slotConds, fmt.Sprintf("%s.ethnicity IN %s", palias, ph))
							for _, e := range expanded {
								countArgs = append(countArgs, e)
							}
						}

						if len(slot.Countries) > 0 {
							ph := getInBinding(len(slot.Countries))
							slotConds = append(slotConds, fmt.Sprintf("%s.country IN %s", palias, ph))
							for _, c := range slot.Countries {
								countArgs = append(countArgs, c)
							}
						}

						if slot.Rating != nil {
							ratingCond, ratingVal := getRatingComparison(palias+".rating", slot.Rating)
							slotConds = append(slotConds, ratingCond)
							countArgs = append(countArgs, ratingVal)
						}

						part := fmt.Sprintf(`SELECT DISTINCT %s.performer_id FROM scene_marker_performers %s
							JOIN performers %s ON %s.id = %s.performer_id
							WHERE %s`,
							alias, alias, palias, palias, alias, strings.Join(slotConds, " AND "))
						unionParts = append(unionParts, part)
					}

					countCond := fmt.Sprintf(`(SELECT COUNT(*) FROM (%s) AS up_union) >= %d`,
						strings.Join(unionParts, " UNION "), len(g.TopUnnamedPerformers))
					performerConditions = append(performerConditions, countCond)
					performerArgs = append(performerArgs, countArgs...)
				}
			}

			// ===== UNNAMED BOTTOM PERFORMERS =====
			// Each slot must match a DISTINCT performer with the given criteria as a bottom
			if len(g.BottomUnnamedPerformers) > 0 {
				for i, slot := range g.BottomUnnamedPerformers {
					alias := fmt.Sprintf("upb%d", i)
					palias := fmt.Sprintf("upbp%d", i)

					var slotConds []string
					var slotArgs []interface{}

					slotConds = append(slotConds, fmt.Sprintf("%s.role = 'bottom'", alias))

					if len(slot.Ethnicities) > 0 {
						expanded := expandEthnicities(slot.Ethnicities)
						ph := getInBinding(len(expanded))
						slotConds = append(slotConds, fmt.Sprintf("%s.ethnicity IN %s", palias, ph))
						for _, e := range expanded {
							slotArgs = append(slotArgs, e)
						}
					}

					if len(slot.Countries) > 0 {
						ph := getInBinding(len(slot.Countries))
						slotConds = append(slotConds, fmt.Sprintf("%s.country IN %s", palias, ph))
						for _, c := range slot.Countries {
							slotArgs = append(slotArgs, c)
						}
					}

					if slot.Rating != nil {
						ratingCond, ratingVal := getRatingComparison(palias+".rating", slot.Rating)
						slotConds = append(slotConds, ratingCond)
						slotArgs = append(slotArgs, ratingVal)
					}

					existsCond := fmt.Sprintf(`EXISTS (
						SELECT 1 FROM scene_marker_performers %s
						JOIN performers %s ON %s.id = %s.performer_id
						WHERE %s.scene_marker_id = scene_markers.id
						AND %s
					)`, alias, palias, palias, alias, alias, strings.Join(slotConds, " AND "))

					performerConditions = append(performerConditions, existsCond)
					performerArgs = append(performerArgs, slotArgs...)
				}

				// If multiple bottom unnamed performers, ensure they are DISTINCT
				if len(g.BottomUnnamedPerformers) > 1 {
					var unionParts []string
					var countArgs []interface{}
					for _, slot := range g.BottomUnnamedPerformers {
						var slotConds []string
						var slotSlotArgs []interface{}

						slotConds = append(slotConds, "smp.role = 'bottom'")

						if len(slot.Ethnicities) > 0 {
							expanded := expandEthnicities(slot.Ethnicities)
							ph := getInBinding(len(expanded))
							slotConds = append(slotConds, fmt.Sprintf("p.ethnicity IN %s", ph))
							for _, e := range expanded {
								slotSlotArgs = append(slotSlotArgs, e)
							}
						}

						if len(slot.Countries) > 0 {
							ph := getInBinding(len(slot.Countries))
							slotConds = append(slotConds, fmt.Sprintf("p.country IN %s", ph))
							for _, c := range slot.Countries {
								slotSlotArgs = append(slotSlotArgs, c)
							}
						}

						if slot.Rating != nil {
							ratingCond, ratingVal := getRatingComparison("p.rating", slot.Rating)
							slotConds = append(slotConds, ratingCond)
							slotSlotArgs = append(slotSlotArgs, ratingVal)
						}

						unionPart := fmt.Sprintf(`SELECT smp.performer_id FROM scene_marker_performers smp
							JOIN performers p ON p.id = smp.performer_id
							WHERE smp.scene_marker_id = scene_markers.id AND %s`, strings.Join(slotConds, " AND "))
						unionParts = append(unionParts, unionPart)
						countArgs = append(countArgs, slotSlotArgs...)
					}

					countCond := fmt.Sprintf(`(SELECT COUNT(*) FROM (%s) AS upb_union) >= %d`,
						strings.Join(unionParts, " UNION "), len(g.BottomUnnamedPerformers))
					performerConditions = append(performerConditions, countCond)
					performerArgs = append(performerArgs, countArgs...)
				}
			}

			// ===== UNNAMED BOTH-ROLES PERFORMERS =====
			// Each slot must match a DISTINCT performer who is BOTH top AND bottom
			if len(g.BothRolesUnnamedPerformers) > 0 {
				for i, slot := range g.BothRolesUnnamedPerformers {
					alias := fmt.Sprintf("upbr%d", i)
					palias := fmt.Sprintf("upbrp%d", i)

					var slotConds []string
					var slotArgs []interface{}

					if len(slot.Ethnicities) > 0 {
						expanded := expandEthnicities(slot.Ethnicities)
						ph := getInBinding(len(expanded))
						slotConds = append(slotConds, fmt.Sprintf("%s.ethnicity IN %s", palias, ph))
						for _, e := range expanded {
							slotArgs = append(slotArgs, e)
						}
					}

					if len(slot.Countries) > 0 {
						ph := getInBinding(len(slot.Countries))
						slotConds = append(slotConds, fmt.Sprintf("%s.country IN %s", palias, ph))
						for _, c := range slot.Countries {
							slotArgs = append(slotArgs, c)
						}
					}

					if slot.Rating != nil {
						ratingCond, ratingVal := getRatingComparison(palias+".rating", slot.Rating)
						slotConds = append(slotConds, ratingCond)
						slotArgs = append(slotArgs, ratingVal)
					}

					// Must be both top AND bottom
					var whereClause string
					if len(slotConds) > 0 {
						whereClause = "AND " + strings.Join(slotConds, " AND ")
					}

					existsCond := fmt.Sprintf(`EXISTS (
						SELECT 1 FROM scene_marker_performers %s
						JOIN performers %s ON %s.id = %s.performer_id
						WHERE %s.scene_marker_id = scene_markers.id
						AND EXISTS (SELECT 1 FROM scene_marker_performers WHERE scene_marker_id = scene_markers.id AND performer_id = %s.performer_id AND role = 'top')
						AND EXISTS (SELECT 1 FROM scene_marker_performers WHERE scene_marker_id = scene_markers.id AND performer_id = %s.performer_id AND role = 'bottom')
						%s
					)`, alias, palias, palias, alias, alias, alias, alias, whereClause)

					performerConditions = append(performerConditions, existsCond)
					performerArgs = append(performerArgs, slotArgs...)
				}

				// If multiple both-roles unnamed performers, ensure they are DISTINCT
				if len(g.BothRolesUnnamedPerformers) > 1 {
					var unionParts []string
					var countArgs []interface{}
					for _, slot := range g.BothRolesUnnamedPerformers {
						var slotConds []string
						var slotSlotArgs []interface{}

						if len(slot.Ethnicities) > 0 {
							expanded := expandEthnicities(slot.Ethnicities)
							ph := getInBinding(len(expanded))
							slotConds = append(slotConds, fmt.Sprintf("p.ethnicity IN %s", ph))
							for _, e := range expanded {
								slotSlotArgs = append(slotSlotArgs, e)
							}
						}

						if len(slot.Countries) > 0 {
							ph := getInBinding(len(slot.Countries))
							slotConds = append(slotConds, fmt.Sprintf("p.country IN %s", ph))
							for _, c := range slot.Countries {
								slotSlotArgs = append(slotSlotArgs, c)
							}
						}

						if slot.Rating != nil {
							ratingCond, ratingVal := getRatingComparison("p.rating", slot.Rating)
							slotConds = append(slotConds, ratingCond)
							slotSlotArgs = append(slotSlotArgs, ratingVal)
						}

						var criteriaClause string
						if len(slotConds) > 0 {
							criteriaClause = " AND " + strings.Join(slotConds, " AND ")
						}

						unionPart := fmt.Sprintf(`SELECT smp.performer_id FROM scene_marker_performers smp
							JOIN performers p ON p.id = smp.performer_id
							WHERE smp.scene_marker_id = scene_markers.id
							AND EXISTS (SELECT 1 FROM scene_marker_performers WHERE scene_marker_id = scene_markers.id AND performer_id = smp.performer_id AND role = 'top')
							AND EXISTS (SELECT 1 FROM scene_marker_performers WHERE scene_marker_id = scene_markers.id AND performer_id = smp.performer_id AND role = 'bottom')
							%s`, criteriaClause)
						unionParts = append(unionParts, unionPart)
						countArgs = append(countArgs, slotSlotArgs...)
					}

					countCond := fmt.Sprintf(`(SELECT COUNT(*) FROM (%s) AS upbr_union) >= %d`,
						strings.Join(unionParts, " UNION "), len(g.BothRolesUnnamedPerformers))
					performerConditions = append(performerConditions, countCond)
					performerArgs = append(performerArgs, countArgs...)
				}
			}

			// ===== CROSS-ROLE DISTINCT CHECK =====
			totalUnnamedSlots := len(g.TopUnnamedPerformers) + len(g.BottomUnnamedPerformers)
			if totalUnnamedSlots > 1 && len(g.TopUnnamedPerformers) > 0 && len(g.BottomUnnamedPerformers) > 0 {
				var allUnionParts []string
				var allCountArgs []interface{}

				// Add top unnamed performers
				for _, slot := range g.TopUnnamedPerformers {
					var slotConds []string
					var slotSlotArgs []interface{}

					slotConds = append(slotConds, "smp.role = 'top'")

					if len(slot.Ethnicities) > 0 {
						expanded := expandEthnicities(slot.Ethnicities)
						ph := getInBinding(len(expanded))
						slotConds = append(slotConds, fmt.Sprintf("p.ethnicity IN %s", ph))
						for _, e := range expanded {
							slotSlotArgs = append(slotSlotArgs, e)
						}
					}

					if len(slot.Countries) > 0 {
						ph := getInBinding(len(slot.Countries))
						slotConds = append(slotConds, fmt.Sprintf("p.country IN %s", ph))
						for _, c := range slot.Countries {
							slotSlotArgs = append(slotSlotArgs, c)
						}
					}

					if slot.Rating != nil {
						ratingCond, ratingVal := getRatingComparison("p.rating", slot.Rating)
						slotConds = append(slotConds, ratingCond)
						slotSlotArgs = append(slotSlotArgs, ratingVal)
					}

					unionPart := fmt.Sprintf(`SELECT smp.performer_id FROM scene_marker_performers smp
						JOIN performers p ON p.id = smp.performer_id
						WHERE smp.scene_marker_id = scene_markers.id AND %s`, strings.Join(slotConds, " AND "))
					allUnionParts = append(allUnionParts, unionPart)
					allCountArgs = append(allCountArgs, slotSlotArgs...)
				}

				// Add bottom unnamed performers
				for _, slot := range g.BottomUnnamedPerformers {
					var slotConds []string
					var slotSlotArgs []interface{}

					slotConds = append(slotConds, "smp.role = 'bottom'")

					if len(slot.Ethnicities) > 0 {
						expanded := expandEthnicities(slot.Ethnicities)
						ph := getInBinding(len(expanded))
						slotConds = append(slotConds, fmt.Sprintf("p.ethnicity IN %s", ph))
						for _, e := range expanded {
							slotSlotArgs = append(slotSlotArgs, e)
						}
					}

					if len(slot.Countries) > 0 {
						ph := getInBinding(len(slot.Countries))
						slotConds = append(slotConds, fmt.Sprintf("p.country IN %s", ph))
						for _, c := range slot.Countries {
							slotSlotArgs = append(slotSlotArgs, c)
						}
					}

					if slot.Rating != nil {
						ratingCond, ratingVal := getRatingComparison("p.rating", slot.Rating)
						slotConds = append(slotConds, ratingCond)
						slotSlotArgs = append(slotSlotArgs, ratingVal)
					}

					unionPart := fmt.Sprintf(`SELECT smp.performer_id FROM scene_marker_performers smp
						JOIN performers p ON p.id = smp.performer_id
						WHERE smp.scene_marker_id = scene_markers.id AND %s`, strings.Join(slotConds, " AND "))
					allUnionParts = append(allUnionParts, unionPart)
					allCountArgs = append(allCountArgs, slotSlotArgs...)
				}

				crossRoleCountCond := fmt.Sprintf(`(SELECT COUNT(*) FROM (%s) AS cross_role_union) >= %d`,
					strings.Join(allUnionParts, " UNION "), totalUnnamedSlots)
				performerConditions = append(performerConditions, crossRoleCountCond)
				performerArgs = append(performerArgs, allCountArgs...)
			}

			// Combine all conditions for this group
			var allConditions []string
			var allCondArgs []interface{}

			// Add tag conditions (always AND)
			if len(tagConditions) > 0 {
				allConditions = append(allConditions, tagConditions...)
				allCondArgs = append(allCondArgs, tagArgs...)
			}

			// Add performer conditions based on performer mode
			if len(performerConditions) > 0 {
				if performerMode == "OR" {
					perfClause := "(" + strings.Join(performerConditions, " OR ") + ")"
					allConditions = append(allConditions, perfClause)
				} else {
					allConditions = append(allConditions, performerConditions...)
				}
				allCondArgs = append(allCondArgs, performerArgs...)
			}

			if len(allConditions) > 0 {
				groupClause := "(" + strings.Join(allConditions, " AND ") + ")"
				groupClauses = append(groupClauses, groupClause)
				allArgs = append(allArgs, allCondArgs...)
			}
		}

		// Combine all groups with OR (at least one group must match)
		if len(groupClauses) > 0 {
			var finalClause string
			if input.Modifier == models.CriterionModifierEquals {
				finalClause = "(" + strings.Join(groupClauses, " OR ") + ")"
			} else {
				finalClause = "NOT (" + strings.Join(groupClauses, " OR ") + ")"
			}
			f.addWhere(finalClause, allArgs...)
		}
	}
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

			// Markers tagged with oralTagId (or a subtag) where ALL performers are both tops and bottoms
			f.addWhere(fmt.Sprintf(`
				-- Marker must be tagged with oralTagId or a descendant (primary or secondary)
				(scene_markers.primary_tag_id IN (
					WITH RECURSIVE oral_tags(id) AS (
						SELECT id FROM tags WHERE id = %s
						UNION ALL
						SELECT tr.child_id FROM tags_relations tr JOIN oral_tags ot ON tr.parent_id = ot.id
					)
					SELECT id FROM oral_tags
				)
				OR EXISTS (
					WITH RECURSIVE oral_tags(id) AS (
						SELECT id FROM tags WHERE id = %s
						UNION ALL
						SELECT tr.child_id FROM tags_relations tr JOIN oral_tags ot ON tr.parent_id = ot.id
					)
					SELECT 1 FROM scene_markers_tags smt WHERE smt.scene_marker_id = scene_markers.id AND smt.tag_id IN (SELECT id FROM oral_tags)
				))
				-- Marker must have at least one performer
				AND EXISTS (SELECT 1 FROM scene_marker_performers smp WHERE smp.scene_marker_id = scene_markers.id)
				-- All performers on this marker must be both top AND bottom
				AND NOT EXISTS (
					SELECT 1 FROM scene_marker_performers smp 
					WHERE smp.scene_marker_id = scene_markers.id
					AND smp.performer_id NOT IN (
						SELECT smp2.performer_id 
						FROM scene_marker_performers smp2 
						WHERE smp2.scene_marker_id = scene_markers.id AND smp2.role = 'top'
					)
				)
				AND NOT EXISTS (
					SELECT 1 FROM scene_marker_performers smp 
					WHERE smp.scene_marker_id = scene_markers.id
					AND smp.performer_id NOT IN (
						SELECT smp2.performer_id 
						FROM scene_marker_performers smp2 
						WHERE smp2.scene_marker_id = scene_markers.id AND smp2.role = 'bottom'
					)
				)
			`, oralTagID, oralTagID))
		}
	}
}
