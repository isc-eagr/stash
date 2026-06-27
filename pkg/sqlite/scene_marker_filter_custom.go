package sqlite

// CUSTOM: Custom criterion handlers for scene marker filters.

import (
	"context"
	"fmt"
	"strings"

	"github.com/stashapp/stash/pkg/models"
)

// getRatingComparison returns the SQL comparison for a rating criterion.
func getRatingComparison(columnName string, rating *models.IntCriterionInput) (string, []interface{}) {
	if rating == nil {
		return "", nil
	}

	return getIntWhereClause(columnName, rating.Modifier, rating.Value, rating.Value2)
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

		appendPerformerRatingCriteria := func(conds *[]string, args *[]interface{}, performerAlias string, ratingCriteria *models.RatingCriteriaFilterInput) bool {
			if ratingCriteria == nil {
				return true
			}

			for _, c := range ratingCriteria.Criteria {
				if c == nil || c.Value == nil || c.Key == "" {
					continue
				}
				if !c.Value.ValidModifier() {
					f.setError(fmt.Errorf("invalid modifier %s for performer rating criterion %s", c.Value.Modifier, c.Key))
					return false
				}

				whereClause, whereArgs := getFloatCriterionWhereClause("rs.raw_value", *c.Value)
				*conds = append(*conds, fmt.Sprintf(
					"EXISTS (SELECT 1 FROM %s rs WHERE rs.entity_type = ? AND rs.entity_id = %s.id AND rs.key = ? AND %s)",
					ratingCriteriaScoresTable,
					performerAlias,
					whereClause,
				))
				*args = append(*args, models.RatingEntityPerformer, c.Key)
				*args = append(*args, whereArgs...)
			}

			for _, c := range ratingCriteria.Bonuses {
				if c == nil || c.Key == "" {
					continue
				}
				clause := fmt.Sprintf(
					"EXISTS (SELECT 1 FROM %s rs WHERE rs.entity_type = ? AND rs.entity_id = %s.id AND rs.key = ? AND (rs.raw_value != 0 OR rs.weighted_value != 0))",
					ratingBonusScoresTable,
					performerAlias,
				)
				if !c.Value {
					clause = "NOT (" + clause + ")"
				}
				*conds = append(*conds, clause)
				*args = append(*args, models.RatingEntityPerformer, c.Key)
			}

			for _, c := range ratingCriteria.Penalties {
				if c == nil || c.Key == "" {
					continue
				}
				clause := fmt.Sprintf(
					"EXISTS (SELECT 1 FROM %s rs WHERE rs.entity_type = ? AND rs.entity_id = %s.id AND rs.key = ? AND (rs.raw_value != 0 OR rs.weighted_value != 0))",
					ratingPenaltyScoresTable,
					performerAlias,
				)
				if !c.Value {
					clause = "NOT (" + clause + ")"
				}
				*conds = append(*conds, clause)
				*args = append(*args, models.RatingEntityPerformer, c.Key)
			}

			return true
		}

		buildDirectOverlapGroupCondition := func(g models.SceneMarkerTagGroupInput, smAlias string) (string, []interface{}, bool) {
			var conditions []string
			var args []interface{}

			addPerformerAttr := func(performerAlias string, ethnicities []string, countries []string, rating *models.IntCriterionInput, ratingCriteria *models.RatingCriteriaFilterInput) (string, []interface{}, bool) {
				var attrConds []string
				var attrArgs []interface{}
				if len(ethnicities) > 0 {
					expanded := expandEthnicities(ethnicities)
					ph := getInBinding(len(expanded))
					attrConds = append(attrConds, performerAlias+".ethnicity IN "+ph)
					for _, e := range expanded {
						attrArgs = append(attrArgs, e)
					}
				}
				if len(countries) > 0 {
					ph := getInBinding(len(countries))
					attrConds = append(attrConds, performerAlias+".country IN "+ph)
					for _, c := range countries {
						attrArgs = append(attrArgs, c)
					}
				}
				if rating != nil {
					ratingCond, ratingArgs := getRatingComparison(performerAlias+".rating", rating)
					attrConds = append(attrConds, ratingCond)
					attrArgs = append(attrArgs, ratingArgs...)
				}
				if !appendPerformerRatingCriteria(&attrConds, &attrArgs, performerAlias, ratingCriteria) {
					return "", nil, false
				}
				if len(attrConds) == 0 {
					return "1=1", attrArgs, true
				}
				return strings.Join(attrConds, " AND "), attrArgs, true
			}

			buildUnnamedSelect := func(role string, slot models.UnnamedPerformerCriterionInput, smpAlias string, performerAlias string, bothRoles bool) (string, []interface{}, bool) {
				attrClause, attrArgs, ok := addPerformerAttr(performerAlias, slot.Ethnicities, slot.Countries, slot.Rating, slot.RatingCriteria)
				if !ok {
					return "", nil, false
				}
				clauses := []string{
					fmt.Sprintf("%s.scene_marker_id = %s.id", smpAlias, smAlias),
					attrClause,
				}
				if role != "" {
					clauses = append(clauses, fmt.Sprintf("%s.role = '%s'", smpAlias, role))
				}
				if bothRoles {
					clauses = append(clauses,
						fmt.Sprintf("EXISTS (SELECT 1 FROM scene_marker_performers WHERE scene_marker_id = %s.id AND performer_id = %s.performer_id AND role = 'top')", smAlias, smpAlias),
						fmt.Sprintf("EXISTS (SELECT 1 FROM scene_marker_performers WHERE scene_marker_id = %s.id AND performer_id = %s.performer_id AND role = 'bottom')", smAlias, smpAlias),
					)
				}
				return fmt.Sprintf(`SELECT DISTINCT %[1]s.performer_id
FROM scene_marker_performers %[1]s
JOIN performers %[2]s ON %[2]s.id = %[1]s.performer_id
WHERE %[3]s`, smpAlias, performerAlias, strings.Join(clauses, " AND ")), attrArgs, true
			}

			buildUnnamedDistinctCount := func(role string, slots []models.UnnamedPerformerCriterionInput, aliasPrefix string, bothRoles bool) (string, []interface{}, bool) {
				if len(slots) < 2 {
					return "", nil, true
				}
				var selects []string
				var selectArgs []interface{}
				for i, slot := range slots {
					selectClause, args, ok := buildUnnamedSelect(role, slot, fmt.Sprintf("%s_smp_%d", aliasPrefix, i), fmt.Sprintf("%s_p_%d", aliasPrefix, i), bothRoles)
					if !ok {
						return "", nil, false
					}
					selects = append(selects, selectClause)
					selectArgs = append(selectArgs, args...)
				}
				return fmt.Sprintf("(SELECT COUNT(*) FROM (%s) AS %s_union) >= %d", strings.Join(selects, " UNION "), aliasPrefix, len(slots)), selectArgs, true
			}

			buildRoleSide := func(role string, performerIDs []string, anyCount *int, ethnicities []string, countries []string, rating *models.IntCriterionInput, unnamed []models.UnnamedPerformerCriterionInput, aliasPrefix string) (string, []interface{}, bool) {
				var roleConditions []string
				var roleArgs []interface{}

				for i, pid := range performerIDs {
					roleConditions = append(roleConditions, fmt.Sprintf(`EXISTS (
    SELECT 1 FROM scene_marker_performers %[1]s_ids_%[4]d
    WHERE %[1]s_ids_%[4]d.scene_marker_id = %[2]s.id AND %[1]s_ids_%[4]d.role = '%[3]s' AND %[1]s_ids_%[4]d.performer_id = ?
  )`, aliasPrefix, smAlias, role, i))
					roleArgs = append(roleArgs, pid)
				}

				attrClause, attrArgs, ok := addPerformerAttr(aliasPrefix+"_p_attr", ethnicities, countries, rating, nil)
				if !ok {
					return "", nil, false
				}
				if attrClause != "1=1" {
					roleConditions = append(roleConditions, fmt.Sprintf(`EXISTS (
    SELECT 1 FROM scene_marker_performers %[1]s_attr
    JOIN performers %[1]s_p_attr ON %[1]s_p_attr.id = %[1]s_attr.performer_id
    WHERE %[1]s_attr.scene_marker_id = %[2]s.id AND %[1]s_attr.role = '%[3]s' AND %[4]s
  )`, aliasPrefix, smAlias, role, attrClause))
					roleArgs = append(roleArgs, attrArgs...)
				}

				for i, slot := range unnamed {
					selectClause, selectArgs, ok := buildUnnamedSelect(role, slot, fmt.Sprintf("%s_u_%d", aliasPrefix, i), fmt.Sprintf("%s_up_%d", aliasPrefix, i), false)
					if !ok {
						return "", nil, false
					}
					roleConditions = append(roleConditions, "EXISTS (\n"+selectClause+"\n  )")
					roleArgs = append(roleArgs, selectArgs...)
				}
				distinctClause, distinctArgs, ok := buildUnnamedDistinctCount(role, unnamed, aliasPrefix+"_distinct", false)
				if !ok {
					return "", nil, false
				}
				if distinctClause != "" {
					roleConditions = append(roleConditions, distinctClause)
					roleArgs = append(roleArgs, distinctArgs...)
				}

				if anyCount != nil && *anyCount > 0 {
					roleConditions = append(roleConditions, fmt.Sprintf(`(
    SELECT COUNT(DISTINCT %[1]s_any.performer_id) FROM scene_marker_performers %[1]s_any
    WHERE %[1]s_any.scene_marker_id = %[2]s.id AND %[1]s_any.role = '%[3]s'
  ) >= %[4]d`, aliasPrefix, smAlias, role, *anyCount))
				}

				if len(roleConditions) == 0 {
					return "", roleArgs, true
				}
				return "(" + strings.Join(roleConditions, " AND ") + ")", roleArgs, true
			}

			if len(g.TagIDs) > 0 {
				if g.Depth != nil && *g.Depth != 0 {
					for _, tagID := range g.TagIDs {
						valuesClause, err := getHierarchicalValues(ctx, []string{tagID}, tagTable, "tags_relations", "parent_id", "child_id", g.Depth)
						if err != nil {
							f.setError(err)
							return "", nil, false
						}
						var expandedIDs []string
						expandQuery := fmt.Sprintf("SELECT DISTINCT column2 FROM (%s)", valuesClause)
						if err := dbWrapper.Select(ctx, &expandedIDs, expandQuery); err != nil {
							f.setError(err)
							return "", nil, false
						}
						if len(expandedIDs) == 0 {
							conditions = append(conditions, "0=1")
							continue
						}
						ph := getInBinding(len(expandedIDs))
						conditions = append(conditions, sceneMarkerDirectHasTagInClauseCustom(smAlias, ph))
						for _, tid := range expandedIDs {
							args = append(args, tid)
						}
					}
				} else {
					ph := getInBinding(len(g.TagIDs))
					conditions = append(conditions, sceneMarkerDirectTagsCountClauseCustom(smAlias, ph, len(g.TagIDs)))
					for _, tid := range g.TagIDs {
						args = append(args, tid)
					}
				}
			}

			if len(g.ExcludeTagIDsOnMarker) > 0 {
				ph := getInBinding(len(g.ExcludeTagIDsOnMarker))
				conditions = append(conditions, fmt.Sprintf(`NOT (
    %[1]s.primary_tag_id IN %[2]s
    OR EXISTS (
      SELECT 1 FROM scene_markers_tags mt_excl
      WHERE mt_excl.scene_marker_id = %[1]s.id AND mt_excl.tag_id IN %[2]s
    )
  )`, smAlias, ph))
				for _, tid := range g.ExcludeTagIDsOnMarker {
					args = append(args, tid)
				}
				for _, tid := range g.ExcludeTagIDsOnMarker {
					args = append(args, tid)
				}
			}

			topEthnicities := g.TopEthnicities
			if len(topEthnicities) == 0 {
				topEthnicities = g.PerformerEthnicities
			}
			topCountries := g.TopCountries
			if len(topCountries) == 0 {
				topCountries = g.PerformerCountries
			}
			topRating := g.TopRating
			if topRating == nil {
				topRating = g.PerformerRating
			}
			bottomEthnicities := g.BottomEthnicities
			if len(bottomEthnicities) == 0 {
				bottomEthnicities = g.PerformerEthnicities
			}
			bottomCountries := g.BottomCountries
			if len(bottomCountries) == 0 {
				bottomCountries = g.PerformerCountries
			}
			bottomRating := g.BottomRating
			if bottomRating == nil {
				bottomRating = g.PerformerRating
			}

			topSide, topArgs, ok := buildRoleSide("top", g.TopPerformerIDs, g.TopAnyCount, topEthnicities, topCountries, topRating, g.TopUnnamedPerformers, "smp_overlap_top")
			if !ok {
				return "", nil, false
			}
			bottomSide, bottomArgs, ok := buildRoleSide("bottom", g.BottomPerformerIDs, g.BottomAnyCount, bottomEthnicities, bottomCountries, bottomRating, g.BottomUnnamedPerformers, "smp_overlap_bottom")
			if !ok {
				return "", nil, false
			}
			switch {
			case topSide != "" && bottomSide != "":
				if g.PerformerMode != nil && strings.EqualFold(*g.PerformerMode, "AND") {
					conditions = append(conditions, topSide, bottomSide)
					args = append(args, topArgs...)
					args = append(args, bottomArgs...)
				} else {
					conditions = append(conditions, "("+topSide+" OR "+bottomSide+")")
					args = append(args, topArgs...)
					args = append(args, bottomArgs...)
				}
			case topSide != "":
				conditions = append(conditions, topSide)
				args = append(args, topArgs...)
			case bottomSide != "":
				conditions = append(conditions, bottomSide)
				args = append(args, bottomArgs...)
			}

			for i, performerID := range g.BothRolesPerformerIDs {
				aliasPrefix := fmt.Sprintf("smp_overlap_both_%d", i)
				conditions = append(conditions, fmt.Sprintf(`(
    EXISTS (SELECT 1 FROM scene_marker_performers %[1]s_top WHERE %[1]s_top.scene_marker_id = %[2]s.id AND %[1]s_top.role = 'top' AND %[1]s_top.performer_id = ?)
    AND EXISTS (SELECT 1 FROM scene_marker_performers %[1]s_bottom WHERE %[1]s_bottom.scene_marker_id = %[2]s.id AND %[1]s_bottom.role = 'bottom' AND %[1]s_bottom.performer_id = ?)
  )`, aliasPrefix, smAlias))
				args = append(args, performerID, performerID)
			}

			for i, slot := range g.BothRolesUnnamedPerformers {
				selectClause, selectArgs, ok := buildUnnamedSelect("", slot, fmt.Sprintf("smp_overlap_both_u_%d", i), fmt.Sprintf("smp_overlap_both_up_%d", i), true)
				if !ok {
					return "", nil, false
				}
				conditions = append(conditions, "EXISTS (\n"+selectClause+"\n  )")
				args = append(args, selectArgs...)
			}
			distinctClause, distinctArgs, ok := buildUnnamedDistinctCount("", g.BothRolesUnnamedPerformers, "smp_overlap_both_distinct", true)
			if !ok {
				return "", nil, false
			}
			if distinctClause != "" {
				conditions = append(conditions, distinctClause)
				args = append(args, distinctArgs...)
			}

			if len(conditions) == 0 {
				return "", args, false
			}
			return "(" + strings.Join(conditions, " AND ") + ")", args, true
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

		if len(input.OverlapGroups) > 0 {
			var fromParts []string
			var whereParts []string
			var overlapArgs []interface{}

			for i, group := range input.OverlapGroups {
				markerAlias := fmt.Sprintf("sm_overlap_req_%d", i)
				fromParts = append(fromParts, "scene_markers "+markerAlias)
				whereParts = append(whereParts, markerAlias+".scene_id = scene_markers.scene_id")

				markerCondition, markerArgs, ok := buildDirectOverlapGroupCondition(group, markerAlias)
				if f.getError() != nil {
					return
				}
				if !ok {
					whereParts = append(whereParts, "0=1")
					continue
				}
				whereParts = append(whereParts, markerCondition)
				overlapArgs = append(overlapArgs, markerArgs...)
			}

			for i := 0; i < len(input.OverlapGroups); i++ {
				for j := i + 1; j < len(input.OverlapGroups); j++ {
					whereParts = append(whereParts, sceneMarkerSameOrOverlapWhereCustom(
						fmt.Sprintf("sm_overlap_req_%d", i),
						fmt.Sprintf("sm_overlap_req_%d", j),
					))
				}
			}

			var narrowestResultParts []string
			for i := range input.OverlapGroups {
				currentAlias := fmt.Sprintf("sm_overlap_req_%d", i)
				var narrowerParts []string
				for j := range input.OverlapGroups {
					if i == j {
						continue
					}
					otherAlias := fmt.Sprintf("sm_overlap_req_%d", j)
					narrowerParts = append(narrowerParts, sceneMarkerIsNarrowerThanClauseCustom(otherAlias, currentAlias))
				}
				noNarrower := "1=1"
				if len(narrowerParts) > 0 {
					noNarrower = "NOT (" + strings.Join(narrowerParts, " OR ") + ")"
				}
				narrowestResultParts = append(narrowestResultParts, fmt.Sprintf("(scene_markers.id = %[1]s.id AND %[2]s)", currentAlias, noNarrower))
			}
			whereParts = append(whereParts, "("+strings.Join(narrowestResultParts, " OR ")+")")

			existsClause := fmt.Sprintf(`EXISTS (
SELECT 1
FROM %s
WHERE %s
)`, strings.Join(fromParts, ", "), strings.Join(whereParts, "\n  AND "))
			if input.Modifier == models.CriterionModifierNotEquals {
				existsClause = "NOT (" + existsClause + ")"
			}
			f.addWhere(existsClause, overlapArgs...)
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
			var topRoleConditions []string
			var topRoleArgs []interface{}
			var bottomRoleConditions []string
			var bottomRoleArgs []interface{}
			var bothRoleConditions []string
			var bothRoleArgs []interface{}
			var crossRoleDistinctConditions []string
			var crossRoleDistinctArgs []interface{}

			// Determine performer mode: default is OR
			performerMode := "OR"
			if g.PerformerMode != nil && *g.PerformerMode == "AND" {
				performerMode = "AND"
			}

			// ===== TAG MATCHING =====
			// Each tag must be present directly or through overlapping markers. The returned
			// marker must directly carry at least one requested tag, and the shortest
			// overlapping matching marker wins.
			if len(g.TagIDs) > 0 {
				depthUsed := g.Depth != nil && *g.Depth != 0

				appendTagArgs := func(args *[]interface{}, tagIDs []string) {
					for _, tid := range tagIDs {
						*args = append(*args, tid)
					}
				}

				var directTagIDs []string
				var currentMatchFragments []string
				var currentMatchArgs []interface{}
				var narrowMatchFragments []string
				var narrowMatchArgs []interface{}

				if depthUsed {
					for _, tagID := range g.TagIDs {
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
						if len(expandedIDs) == 0 {
							currentMatchFragments = append(currentMatchFragments, "0=1")
							narrowMatchFragments = append(narrowMatchFragments, "0=1")
							continue
						}

						directTagIDs = append(directTagIDs, expandedIDs...)
						ph := getInBinding(len(expandedIDs))
						currentMatchFragments = append(currentMatchFragments, sceneMarkerHasEffectiveTagInClauseCustom("scene_markers", ph))
						appendTagArgs(&currentMatchArgs, expandedIDs)
						narrowMatchFragments = append(narrowMatchFragments, sceneMarkerHasEffectiveTagInClauseCustom("sm_narrow", ph))
						appendTagArgs(&narrowMatchArgs, expandedIDs)
					}
				} else {
					directTagIDs = append(directTagIDs, g.TagIDs...)
					ph := getInBinding(len(g.TagIDs))
					currentMatchFragments = append(currentMatchFragments, sceneMarkerEffectiveTagsCountClauseCustom("scene_markers", ph, len(g.TagIDs)))
					appendTagArgs(&currentMatchArgs, g.TagIDs)
					narrowMatchFragments = append(narrowMatchFragments, sceneMarkerEffectiveTagsCountClauseCustom("sm_narrow", ph, len(g.TagIDs)))
					appendTagArgs(&narrowMatchArgs, g.TagIDs)
				}

				if len(directTagIDs) == 0 {
					tagConditions = append(tagConditions, "0=1")
				} else {
					directPh := getInBinding(len(directTagIDs))
					tagCond := fmt.Sprintf(`(
						%[1]s
						AND %[2]s
						AND NOT EXISTS (
							SELECT 1 FROM scene_markers sm_narrow
							WHERE %[3]s
							AND %[4]s
							AND %[5]s
							AND %[6]s
						)
					)`,
						sceneMarkerDirectHasTagInClauseCustom("scene_markers", directPh),
						strings.Join(currentMatchFragments, " AND "),
						sceneMarkerOverlapWhereCustom("scene_markers", "sm_narrow"),
						sceneMarkerDirectHasTagInClauseCustom("sm_narrow", directPh),
						strings.Join(narrowMatchFragments, " AND "),
						sceneMarkerIsNarrowerThanClauseCustom("sm_narrow", "scene_markers"),
					)
					tagConditions = append(tagConditions, tagCond)
					appendTagArgs(&tagArgs, directTagIDs)
					tagArgs = append(tagArgs, currentMatchArgs...)
					appendTagArgs(&tagArgs, directTagIDs)
					tagArgs = append(tagArgs, narrowMatchArgs...)
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
					topRoleConditions = append(topRoleConditions, cond)
					topRoleArgs = append(topRoleArgs, perfID)
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
					bottomRoleConditions = append(bottomRoleConditions, cond)
					bottomRoleArgs = append(bottomRoleArgs, perfID)
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
					bothRoleConditions = append(bothRoleConditions, cond)
					bothRoleArgs = append(bothRoleArgs, perfID, perfID)
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
						ratingCond, ratingArgs := getRatingComparison(palias+".rating", slot.Rating)
						slotConds = append(slotConds, ratingCond)
						slotArgs = append(slotArgs, ratingArgs...)
					}
					if !appendPerformerRatingCriteria(&slotConds, &slotArgs, palias, slot.RatingCriteria) {
						return
					}

					existsCond := fmt.Sprintf(`EXISTS (
						SELECT 1 FROM scene_marker_performers %s
						JOIN performers %s ON %s.id = %s.performer_id
						WHERE %s.scene_marker_id = scene_markers.id
						AND %s
					)`, alias, palias, palias, alias, alias, strings.Join(slotConds, " AND "))

					topRoleConditions = append(topRoleConditions, existsCond)
					topRoleArgs = append(topRoleArgs, slotArgs...)
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
							ratingCond, ratingArgs := getRatingComparison(palias+".rating", slot.Rating)
							slotConds = append(slotConds, ratingCond)
							countArgs = append(countArgs, ratingArgs...)
						}
						if !appendPerformerRatingCriteria(&slotConds, &countArgs, palias, slot.RatingCriteria) {
							return
						}

						part := fmt.Sprintf(`SELECT DISTINCT %s.performer_id FROM scene_marker_performers %s
							JOIN performers %s ON %s.id = %s.performer_id
							WHERE %s`,
							alias, alias, palias, palias, alias, strings.Join(slotConds, " AND "))
						unionParts = append(unionParts, part)
					}

					countCond := fmt.Sprintf(`(SELECT COUNT(*) FROM (%s) AS up_union) >= %d`,
						strings.Join(unionParts, " UNION "), len(g.TopUnnamedPerformers))
					topRoleConditions = append(topRoleConditions, countCond)
					topRoleArgs = append(topRoleArgs, countArgs...)
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
						ratingCond, ratingArgs := getRatingComparison(palias+".rating", slot.Rating)
						slotConds = append(slotConds, ratingCond)
						slotArgs = append(slotArgs, ratingArgs...)
					}
					if !appendPerformerRatingCriteria(&slotConds, &slotArgs, palias, slot.RatingCriteria) {
						return
					}

					existsCond := fmt.Sprintf(`EXISTS (
						SELECT 1 FROM scene_marker_performers %s
						JOIN performers %s ON %s.id = %s.performer_id
						WHERE %s.scene_marker_id = scene_markers.id
						AND %s
					)`, alias, palias, palias, alias, alias, strings.Join(slotConds, " AND "))

					bottomRoleConditions = append(bottomRoleConditions, existsCond)
					bottomRoleArgs = append(bottomRoleArgs, slotArgs...)
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
							ratingCond, ratingArgs := getRatingComparison("p.rating", slot.Rating)
							slotConds = append(slotConds, ratingCond)
							slotSlotArgs = append(slotSlotArgs, ratingArgs...)
						}
						if !appendPerformerRatingCriteria(&slotConds, &slotSlotArgs, "p", slot.RatingCriteria) {
							return
						}

						unionPart := fmt.Sprintf(`SELECT smp.performer_id FROM scene_marker_performers smp
							JOIN performers p ON p.id = smp.performer_id
							WHERE smp.scene_marker_id = scene_markers.id AND %s`, strings.Join(slotConds, " AND "))
						unionParts = append(unionParts, unionPart)
						countArgs = append(countArgs, slotSlotArgs...)
					}

					countCond := fmt.Sprintf(`(SELECT COUNT(*) FROM (%s) AS upb_union) >= %d`,
						strings.Join(unionParts, " UNION "), len(g.BottomUnnamedPerformers))
					bottomRoleConditions = append(bottomRoleConditions, countCond)
					bottomRoleArgs = append(bottomRoleArgs, countArgs...)
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
						ratingCond, ratingArgs := getRatingComparison(palias+".rating", slot.Rating)
						slotConds = append(slotConds, ratingCond)
						slotArgs = append(slotArgs, ratingArgs...)
					}
					if !appendPerformerRatingCriteria(&slotConds, &slotArgs, palias, slot.RatingCriteria) {
						return
					}

					// Must be both top AND bottom
					var whereClause string
					if len(slotConds) > 0 {
						whereClause = "AND " + strings.Join(slotConds, " AND ")
					}

					existsCond := fmt.Sprintf(`EXISTS (
						SELECT 1 FROM scene_marker_performers %[1]s
						JOIN performers %[2]s ON %[2]s.id = %[1]s.performer_id
						WHERE %[1]s.scene_marker_id = scene_markers.id
						AND EXISTS (SELECT 1 FROM scene_marker_performers %[1]s_top_scope WHERE %[1]s_top_scope.scene_marker_id = scene_markers.id AND %[1]s_top_scope.performer_id = %[1]s.performer_id AND %[1]s_top_scope.role = 'top')
						AND EXISTS (SELECT 1 FROM scene_marker_performers %[1]s_bottom_scope WHERE %[1]s_bottom_scope.scene_marker_id = scene_markers.id AND %[1]s_bottom_scope.performer_id = %[1]s.performer_id AND %[1]s_bottom_scope.role = 'bottom')
						%[3]s
					)`,
						alias, palias,
						whereClause,
					)

					bothRoleConditions = append(bothRoleConditions, existsCond)
					bothRoleArgs = append(bothRoleArgs, slotArgs...)
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
							ratingCond, ratingArgs := getRatingComparison("p.rating", slot.Rating)
							slotConds = append(slotConds, ratingCond)
							slotSlotArgs = append(slotSlotArgs, ratingArgs...)
						}
						if !appendPerformerRatingCriteria(&slotConds, &slotSlotArgs, "p", slot.RatingCriteria) {
							return
						}

						var criteriaClause string
						if len(slotConds) > 0 {
							criteriaClause = " AND " + strings.Join(slotConds, " AND ")
						}

						unionPart := fmt.Sprintf(`SELECT smp.performer_id FROM scene_marker_performers smp
							JOIN performers p ON p.id = smp.performer_id
							WHERE smp.scene_marker_id = scene_markers.id
							AND EXISTS (SELECT 1 FROM scene_marker_performers smp_upbr_top_scope WHERE smp_upbr_top_scope.scene_marker_id = scene_markers.id AND smp_upbr_top_scope.performer_id = smp.performer_id AND smp_upbr_top_scope.role = 'top')
							AND EXISTS (SELECT 1 FROM scene_marker_performers smp_upbr_bottom_scope WHERE smp_upbr_bottom_scope.scene_marker_id = scene_markers.id AND smp_upbr_bottom_scope.performer_id = smp.performer_id AND smp_upbr_bottom_scope.role = 'bottom')
							%s`,
							criteriaClause)
						unionParts = append(unionParts, unionPart)
						countArgs = append(countArgs, slotSlotArgs...)
					}

					countCond := fmt.Sprintf(`(SELECT COUNT(*) FROM (%s) AS upbr_union) >= %d`,
						strings.Join(unionParts, " UNION "), len(g.BothRolesUnnamedPerformers))
					bothRoleConditions = append(bothRoleConditions, countCond)
					bothRoleArgs = append(bothRoleArgs, countArgs...)
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
						ratingCond, ratingArgs := getRatingComparison("p.rating", slot.Rating)
						slotConds = append(slotConds, ratingCond)
						slotSlotArgs = append(slotSlotArgs, ratingArgs...)
					}
					if !appendPerformerRatingCriteria(&slotConds, &slotSlotArgs, "p", slot.RatingCriteria) {
						return
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
						ratingCond, ratingArgs := getRatingComparison("p.rating", slot.Rating)
						slotConds = append(slotConds, ratingCond)
						slotSlotArgs = append(slotSlotArgs, ratingArgs...)
					}
					if !appendPerformerRatingCriteria(&slotConds, &slotSlotArgs, "p", slot.RatingCriteria) {
						return
					}

					unionPart := fmt.Sprintf(`SELECT smp.performer_id FROM scene_marker_performers smp
						JOIN performers p ON p.id = smp.performer_id
						WHERE smp.scene_marker_id = scene_markers.id AND %s`, strings.Join(slotConds, " AND "))
					allUnionParts = append(allUnionParts, unionPart)
					allCountArgs = append(allCountArgs, slotSlotArgs...)
				}

				crossRoleCountCond := fmt.Sprintf(`(SELECT COUNT(*) FROM (%s) AS cross_role_union) >= %d`,
					strings.Join(allUnionParts, " UNION "), totalUnnamedSlots)
				crossRoleDistinctConditions = append(crossRoleDistinctConditions, crossRoleCountCond)
				crossRoleDistinctArgs = append(crossRoleDistinctArgs, allCountArgs...)
			}

			// Combine all conditions for this group
			var allConditions []string
			var allCondArgs []interface{}

			// Add tag conditions (always AND)
			if len(tagConditions) > 0 {
				allConditions = append(allConditions, tagConditions...)
				allCondArgs = append(allCondArgs, tagArgs...)
			}

			// Add performer conditions based on performer mode. Each role's selected
			// named/unnamed criteria are always ALL; performerMode only combines
			// top-vs-bottom role groups.
			topRoleClause := ""
			if len(topRoleConditions) > 0 {
				topRoleClause = "(" + strings.Join(topRoleConditions, " AND ") + ")"
			}
			bottomRoleClause := ""
			if len(bottomRoleConditions) > 0 {
				bottomRoleClause = "(" + strings.Join(bottomRoleConditions, " AND ") + ")"
			}

			switch {
			case topRoleClause != "" && bottomRoleClause != "":
				if performerMode == "OR" {
					allConditions = append(allConditions, "("+topRoleClause+" OR "+bottomRoleClause+")")
					allCondArgs = append(allCondArgs, topRoleArgs...)
					allCondArgs = append(allCondArgs, bottomRoleArgs...)
				} else {
					allConditions = append(allConditions, topRoleClause, bottomRoleClause)
					allCondArgs = append(allCondArgs, topRoleArgs...)
					allCondArgs = append(allCondArgs, bottomRoleArgs...)
					allConditions = append(allConditions, crossRoleDistinctConditions...)
					allCondArgs = append(allCondArgs, crossRoleDistinctArgs...)
				}
			case topRoleClause != "":
				allConditions = append(allConditions, topRoleClause)
				allCondArgs = append(allCondArgs, topRoleArgs...)
			case bottomRoleClause != "":
				allConditions = append(allConditions, bottomRoleClause)
				allCondArgs = append(allCondArgs, bottomRoleArgs...)
			}

			if len(bothRoleConditions) > 0 {
				allConditions = append(allConditions, bothRoleConditions...)
				allCondArgs = append(allCondArgs, bothRoleArgs...)
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
