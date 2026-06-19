package sqlite

// CUSTOM: Custom criterion handlers for scene marker tags, custom filters, scene types,
// performer markers, ethnicity, country, etc.

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/utils"
)

type joinedSceneMarkerTagsHandler struct {
	criterion *models.SceneMarkerTagsCriterionInput

	primaryTable   string // eg scenes
	joinTable      string // eg scene_markers
	joinPrimaryKey string // eg scene_id
}

func (h *joinedSceneMarkerTagsHandler) handle(ctx context.Context, f *filterBuilder) {
	if h.criterion == nil {
		return
	}

	// Always join the scene_markers table for consistency with other handlers
	f.addLeftJoin(h.joinTable, "", utils.StrFormat("{primaryTable}.id = {joinTable}.{joinPrimaryKey}", utils.StrFormatMap{
		"primaryTable":   h.primaryTable,
		"joinTable":      h.joinTable,
		"joinPrimaryKey": h.joinPrimaryKey,
	}))

	c := h.criterion

	// helper to expand ethnicity like global filters for consistency
	expandEthnicity := func(s string) []string {
		v := strings.TrimSpace(s)
		if v == "" {
			return nil
		}
		out := []string{v}
		if strings.EqualFold(v, "Black") {
			out = append(out, "Mixed", "Afrolatino")
		}
		if strings.EqualFold(v, "White") {
			out = append(out, "Mixed")
		}
		if strings.EqualFold(v, "Latino") {
			out = append(out, "Afrolatino")
		}
		return out
	}

	// helper to expand multiple ethnicities
	expandEthnicities := func(ethnicities []string) []string {
		var out []string
		seen := make(map[string]bool)
		for _, e := range ethnicities {
			for _, exp := range expandEthnicity(e) {
				if !seen[exp] {
					seen[exp] = true
					out = append(out, exp)
				}
			}
		}
		return out
	}

	type sqlFragment struct {
		clause string
		args   []any
	}

	joinFragments := func(fragments []sqlFragment, sep string) sqlFragment {
		var clauses []string
		var args []any
		for _, fragment := range fragments {
			if strings.TrimSpace(fragment.clause) == "" {
				continue
			}
			clauses = append(clauses, fragment.clause)
			args = append(args, fragment.args...)
		}
		if len(clauses) == 0 {
			return sqlFragment{}
		}
		return sqlFragment{
			clause: "(" + strings.Join(clauses, sep) + ")",
			args:   args,
		}
	}

	buildPerformerRatingCriteriaClause := func(performerAlias string, ratingCriteria *models.RatingCriteriaFilterInput) sqlFragment {
		if ratingCriteria == nil {
			return sqlFragment{}
		}

		var clauses []sqlFragment
		for _, c := range ratingCriteria.Criteria {
			if c == nil || c.Value == nil || c.Key == "" {
				continue
			}
			if !c.Value.ValidModifier() {
				f.setError(fmt.Errorf("invalid modifier %s for performer rating criterion %s", c.Value.Modifier, c.Key))
				return sqlFragment{}
			}

			whereClause, whereArgs := getFloatCriterionWhereClause("rs.raw_value", *c.Value)
			args := []any{models.RatingEntityPerformer, c.Key}
			args = append(args, whereArgs...)
			clauses = append(clauses, sqlFragment{
				clause: fmt.Sprintf(
					"EXISTS (SELECT 1 FROM %s rs WHERE rs.entity_type = ? AND rs.entity_id = %s.id AND rs.key = ? AND %s)",
					ratingCriteriaScoresTable,
					performerAlias,
					whereClause,
				),
				args: args,
			})
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
			fragment := sqlFragment{clause: clause, args: []any{models.RatingEntityPerformer, c.Key}}
			if !c.Value {
				fragment.clause = "NOT (" + fragment.clause + ")"
			}
			clauses = append(clauses, fragment)
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
			fragment := sqlFragment{clause: clause, args: []any{models.RatingEntityPerformer, c.Key}}
			if !c.Value {
				fragment.clause = "NOT (" + fragment.clause + ")"
			}
			clauses = append(clauses, fragment)
		}

		return joinFragments(clauses, " AND ")
	}

	buildPerformerAttributeClause := func(performerAlias string, ethnicities []string, countries []string, rating *models.IntCriterionInput, ratingCriteria *models.RatingCriteriaFilterInput) sqlFragment {
		var clauses []string
		var args []any

		if len(ethnicities) > 0 {
			expanded := expandEthnicities(ethnicities)
			ph := getInBinding(len(expanded))
			clauses = append(clauses, performerAlias+".ethnicity IN "+ph)
			for _, e := range expanded {
				args = append(args, e)
			}
		}
		if len(countries) > 0 {
			ph := getInBinding(len(countries))
			clauses = append(clauses, performerAlias+".country IN "+ph)
			for _, c := range countries {
				args = append(args, c)
			}
		}
		if rating != nil {
			w, wargs := getIntWhereClause(performerAlias+".rating", rating.Modifier, rating.Value, rating.Value2)
			clauses = append(clauses, w)
			args = append(args, wargs...)
		}
		if ratingCriteriaFragment := buildPerformerRatingCriteriaClause(performerAlias, ratingCriteria); ratingCriteriaFragment.clause != "" {
			clauses = append(clauses, ratingCriteriaFragment.clause)
			args = append(args, ratingCriteriaFragment.args...)
		}

		if len(clauses) == 0 {
			return sqlFragment{clause: "1=1"}
		}

		return sqlFragment{
			clause: strings.Join(clauses, " AND "),
			args:   args,
		}
	}

	buildUnnamedPerformerSelect := func(smAlias string, role string, slot models.UnnamedPerformerCriterionInput, smpAlias string, performerAlias string, bothRoles bool) sqlFragment {
		attr := buildPerformerAttributeClause(performerAlias, slot.Ethnicities, slot.Countries, slot.Rating, slot.RatingCriteria)
		clauses := []string{
			fmt.Sprintf("%s.scene_marker_id = %s.id", smpAlias, smAlias),
			attr.clause,
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

		return sqlFragment{
			clause: fmt.Sprintf(`SELECT DISTINCT %[1]s.performer_id
FROM scene_marker_performers %[1]s
JOIN performers %[2]s ON %[2]s.id = %[1]s.performer_id
WHERE %[3]s`, smpAlias, performerAlias, strings.Join(clauses, " AND ")),
			args: attr.args,
		}
	}

	buildUnnamedDistinctCount := func(smAlias string, role string, slots []models.UnnamedPerformerCriterionInput, aliasPrefix string, bothRoles bool) sqlFragment {
		if len(slots) < 2 {
			return sqlFragment{}
		}

		var selects []string
		var args []any
		for i, slot := range slots {
			fragment := buildUnnamedPerformerSelect(smAlias, role, slot, fmt.Sprintf("%s_smp_%d", aliasPrefix, i), fmt.Sprintf("%s_p_%d", aliasPrefix, i), bothRoles)
			selects = append(selects, fragment.clause)
			args = append(args, fragment.args...)
		}

		return sqlFragment{
			clause: fmt.Sprintf("(SELECT COUNT(*) FROM (%s) AS %s_union) >= %d", strings.Join(selects, " UNION "), aliasPrefix, len(slots)),
			args:   args,
		}
	}

	buildCrossRoleUnnamedDistinctCount := func(smAlias string, topSlots []models.UnnamedPerformerCriterionInput, bottomSlots []models.UnnamedPerformerCriterionInput, aliasPrefix string) sqlFragment {
		totalSlots := len(topSlots) + len(bottomSlots)
		if totalSlots < 2 || len(topSlots) == 0 || len(bottomSlots) == 0 {
			return sqlFragment{}
		}

		var selects []string
		var args []any
		for i, slot := range topSlots {
			fragment := buildUnnamedPerformerSelect(smAlias, "top", slot, fmt.Sprintf("%s_top_smp_%d", aliasPrefix, i), fmt.Sprintf("%s_top_p_%d", aliasPrefix, i), false)
			selects = append(selects, fragment.clause)
			args = append(args, fragment.args...)
		}
		for i, slot := range bottomSlots {
			fragment := buildUnnamedPerformerSelect(smAlias, "bottom", slot, fmt.Sprintf("%s_bottom_smp_%d", aliasPrefix, i), fmt.Sprintf("%s_bottom_p_%d", aliasPrefix, i), false)
			selects = append(selects, fragment.clause)
			args = append(args, fragment.args...)
		}

		return sqlFragment{
			clause: fmt.Sprintf("(SELECT COUNT(*) FROM (%s) AS %s_union) >= %d", strings.Join(selects, " UNION "), aliasPrefix, totalSlots),
			args:   args,
		}
	}

	buildSceneMarkerGroupCondition := func(g models.SceneMarkerTagGroupInput, smAlias string) (sqlFragment, bool) {
		var markerConditions []sqlFragment

		if len(g.TagIDs) > 0 {
			if g.Depth != nil && *g.Depth != 0 {
				for _, originalTagID := range g.TagIDs {
					valuesClause, err := getHierarchicalValues(ctx, []string{originalTagID}, tagTable, "tags_relations", "parent_id", "child_id", g.Depth)
					if err != nil {
						f.setError(err)
						return sqlFragment{}, false
					}

					var expandedIDs []string
					expandQuery := fmt.Sprintf("SELECT DISTINCT column2 FROM (%s)", valuesClause)
					if err := dbWrapper.Select(ctx, &expandedIDs, expandQuery); err != nil {
						f.setError(err)
						return sqlFragment{}, false
					}
					if len(expandedIDs) == 0 {
						markerConditions = append(markerConditions, sqlFragment{clause: "0=1"})
						continue
					}

					ph := getInBinding(len(expandedIDs))
					args := make([]any, 0, len(expandedIDs)*2)
					for _, tid := range expandedIDs {
						args = append(args, tid)
					}
					for _, tid := range expandedIDs {
						args = append(args, tid)
					}
					markerConditions = append(markerConditions, sqlFragment{
						clause: fmt.Sprintf(`(
    %[1]s.primary_tag_id IN %[2]s
    OR EXISTS (
        SELECT 1 FROM scene_markers_tags mt2 WHERE mt2.scene_marker_id = %[1]s.id AND mt2.tag_id IN %[2]s
    )
)`, smAlias, ph),
						args: args,
					})
				}
			} else {
				tagPh := getInBinding(len(g.TagIDs))
				args := make([]any, 0, len(g.TagIDs))
				for _, tid := range g.TagIDs {
					args = append(args, tid)
				}
				markerConditions = append(markerConditions, sqlFragment{
					clause: fmt.Sprintf(`(
    SELECT COUNT(DISTINCT tag_id) FROM (
      SELECT %[1]s.primary_tag_id AS tag_id
      UNION ALL
      SELECT mt2.tag_id AS tag_id FROM scene_markers_tags mt2 WHERE mt2.scene_marker_id = %[1]s.id
    ) tags_per_marker
    WHERE tag_id IN %[2]s
  ) = %[3]d`, smAlias, tagPh, len(g.TagIDs)),
					args: args,
				})
			}
		}

		if len(g.ExcludeTagIDsOnMarker) > 0 {
			exclPh := getInBinding(len(g.ExcludeTagIDsOnMarker))
			args := make([]any, 0, len(g.ExcludeTagIDsOnMarker)*2)
			for _, tid := range g.ExcludeTagIDsOnMarker {
				args = append(args, tid)
			}
			for _, tid := range g.ExcludeTagIDsOnMarker {
				args = append(args, tid)
			}
			markerConditions = append(markerConditions, sqlFragment{
				clause: fmt.Sprintf(`NOT (
		%[1]s.primary_tag_id IN %[2]s
		OR EXISTS (
			SELECT 1 FROM scene_markers_tags mt_excl
			WHERE mt_excl.scene_marker_id = %[1]s.id AND mt_excl.tag_id IN %[2]s
		)
	)`, smAlias, exclPh),
				args: args,
			})
		}

		buildRoleSide := func(role string, performerIDs []string, anyCount *int, ethnicities []string, countries []string, rating *models.IntCriterionInput, unnamed []models.UnnamedPerformerCriterionInput, aliasPrefix string) sqlFragment {
			var roleConditions []sqlFragment

			if len(performerIDs) > 0 {
				ph := getInBinding(len(performerIDs))
				args := make([]any, 0, len(performerIDs))
				for _, pid := range performerIDs {
					args = append(args, pid)
				}
				roleConditions = append(roleConditions, sqlFragment{
					clause: fmt.Sprintf(`EXISTS (
    SELECT 1 FROM scene_marker_performers %[1]s_ids
    WHERE %[1]s_ids.scene_marker_id = %[2]s.id AND %[1]s_ids.role = '%[3]s' AND %[1]s_ids.performer_id IN %[4]s
  )`, aliasPrefix, smAlias, role, ph),
					args: args,
				})
			}

			attr := buildPerformerAttributeClause(aliasPrefix+"_p_attr", ethnicities, countries, rating, nil)
			if attr.clause != "1=1" {
				roleConditions = append(roleConditions, sqlFragment{
					clause: fmt.Sprintf(`EXISTS (
    SELECT 1 FROM scene_marker_performers %[1]s_attr
    JOIN performers %[1]s_p_attr ON %[1]s_p_attr.id = %[1]s_attr.performer_id
    WHERE %[1]s_attr.scene_marker_id = %[2]s.id AND %[1]s_attr.role = '%[3]s' AND %[4]s
  )`, aliasPrefix, smAlias, role, attr.clause),
					args: attr.args,
				})
			}

			for i, slot := range unnamed {
				fragment := buildUnnamedPerformerSelect(smAlias, role, slot, fmt.Sprintf("%s_u_%d", aliasPrefix, i), fmt.Sprintf("%s_up_%d", aliasPrefix, i), false)
				roleConditions = append(roleConditions, sqlFragment{
					clause: "EXISTS (\n" + fragment.clause + "\n  )",
					args:   fragment.args,
				})
			}
			if distinct := buildUnnamedDistinctCount(smAlias, role, unnamed, aliasPrefix+"_distinct", false); distinct.clause != "" {
				roleConditions = append(roleConditions, distinct)
			}

			if anyCount != nil && *anyCount > 0 {
				roleConditions = append(roleConditions, sqlFragment{
					clause: fmt.Sprintf(`(
    SELECT COUNT(DISTINCT %[1]s_any.performer_id) FROM scene_marker_performers %[1]s_any
    WHERE %[1]s_any.scene_marker_id = %[2]s.id AND %[1]s_any.role = '%[3]s'
  ) >= %[4]d`, aliasPrefix, smAlias, role, *anyCount),
				})
			}

			return joinFragments(roleConditions, " AND ")
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

		topSide := buildRoleSide("top", g.TopPerformerIDs, g.TopAnyCount, topEthnicities, topCountries, topRating, g.TopUnnamedPerformers, "smp_top")
		bottomSide := buildRoleSide("bottom", g.BottomPerformerIDs, g.BottomAnyCount, bottomEthnicities, bottomCountries, bottomRating, g.BottomUnnamedPerformers, "smp_bottom")

		performerModeAnd := g.PerformerMode != nil && strings.EqualFold(*g.PerformerMode, "AND")
		switch {
		case topSide.clause != "" && bottomSide.clause != "":
			if performerModeAnd {
				markerConditions = append(markerConditions, topSide, bottomSide)
				if crossDistinct := buildCrossRoleUnnamedDistinctCount(smAlias, g.TopUnnamedPerformers, g.BottomUnnamedPerformers, "smp_cross_distinct"); crossDistinct.clause != "" {
					markerConditions = append(markerConditions, crossDistinct)
				}
			} else {
				markerConditions = append(markerConditions, joinFragments([]sqlFragment{topSide, bottomSide}, " OR "))
			}
		case topSide.clause != "":
			markerConditions = append(markerConditions, topSide)
		case bottomSide.clause != "":
			markerConditions = append(markerConditions, bottomSide)
		}

		var bothRoleConditions []sqlFragment
		for i, performerID := range g.BothRolesPerformerIDs {
			aliasPrefix := fmt.Sprintf("smp_both_%d", i)
			bothRoleConditions = append(bothRoleConditions, sqlFragment{
				clause: fmt.Sprintf(`(
    EXISTS (
      SELECT 1 FROM scene_marker_performers %[1]s_top
      WHERE %[1]s_top.scene_marker_id = %[2]s.id AND %[1]s_top.role = 'top' AND %[1]s_top.performer_id = ?
    )
    AND EXISTS (
      SELECT 1 FROM scene_marker_performers %[1]s_bottom
      WHERE %[1]s_bottom.scene_marker_id = %[2]s.id AND %[1]s_bottom.role = 'bottom' AND %[1]s_bottom.performer_id = ?
    )
  )`, aliasPrefix, smAlias),
				args: []any{performerID, performerID},
			})
		}

		bothRoleAttr := buildPerformerAttributeClause("p_both_attr", g.BothRolesEthnicities, g.BothRolesCountries, g.BothRolesRating, nil)
		if bothRoleAttr.clause != "1=1" {
			bothRoleConditions = append(bothRoleConditions, sqlFragment{
				clause: fmt.Sprintf(`EXISTS (
    SELECT 1 FROM performers p_both_attr
    WHERE %[1]s
      AND EXISTS (SELECT 1 FROM scene_marker_performers smp_both_attr_t WHERE smp_both_attr_t.scene_marker_id = %[2]s.id AND smp_both_attr_t.performer_id = p_both_attr.id AND smp_both_attr_t.role = 'top')
      AND EXISTS (SELECT 1 FROM scene_marker_performers smp_both_attr_b WHERE smp_both_attr_b.scene_marker_id = %[2]s.id AND smp_both_attr_b.performer_id = p_both_attr.id AND smp_both_attr_b.role = 'bottom')
  )`, bothRoleAttr.clause, smAlias),
				args: bothRoleAttr.args,
			})
		}

		for i, slot := range g.BothRolesUnnamedPerformers {
			fragment := buildUnnamedPerformerSelect(smAlias, "", slot, fmt.Sprintf("smp_both_u_%d", i), fmt.Sprintf("smp_both_up_%d", i), true)
			bothRoleConditions = append(bothRoleConditions, sqlFragment{
				clause: "EXISTS (\n" + fragment.clause + "\n  )",
				args:   fragment.args,
			})
		}
		if distinct := buildUnnamedDistinctCount(smAlias, "", g.BothRolesUnnamedPerformers, "smp_both_distinct", true); distinct.clause != "" {
			bothRoleConditions = append(bothRoleConditions, distinct)
		}

		if bothRoles := joinFragments(bothRoleConditions, " AND "); bothRoles.clause != "" {
			markerConditions = append(markerConditions, bothRoles)
		}

		final := joinFragments(markerConditions, " AND ")
		return final, final.clause != ""
	}

	switch c.Modifier {
	case models.CriterionModifierIsNull, models.CriterionModifierNotNull:
		var notClause string
		if c.Modifier == models.CriterionModifierNotNull {
			notClause = "NOT"
		}
		// Join marker tags to check presence/absence
		f.addLeftJoin("scene_markers_tags", "", "scene_markers.id = scene_markers_tags.scene_marker_id")
		f.addWhere(fmt.Sprintf("scene_markers_tags.tag_id IS %s NULL", notClause))
		return

	case models.CriterionModifierEquals:
		// Check if GroupsExtended or GroupsExtendedExclude is provided (with performer attributes)
		if len(c.GroupsExtended) > 0 || len(c.GroupsExtendedExclude) > 0 {
			// Group identical configurations to enforce uniqueness:
			// If there are 5 identical groups (e.g., 5 groups with just "facial" tag),
			// we need to find 5 DISTINCT markers matching that configuration.

			// Helper to create a canonical key for a group configuration
			type groupConfig struct {
				tagIDs                     []string
				depth                      int
				performerMode              string
				topPerformerIDs            []string
				topAnyCount                int // Minimum number of ANY top performers required
				topEthnicities             []string
				topCountries               []string
				topRating                  string                                  // serialized IntCriterionInput
				topUnnamedPerformers       []models.UnnamedPerformerCriterionInput // Unnamed performers for top role
				bottomPerformerIDs         []string
				bottomAnyCount             int // Minimum number of ANY bottom performers required
				bottomEthnicities          []string
				bottomCountries            []string
				bottomRating               string
				bottomUnnamedPerformers    []models.UnnamedPerformerCriterionInput // Unnamed performers for bottom role
				bothRolesPerformerIDs      []string
				bothRolesEthnicities       []string
				bothRolesCountries         []string
				bothRolesRating            string
				bothRolesUnnamedPerformers []models.UnnamedPerformerCriterionInput // Unnamed performers for both roles
				excludeTagIDs              []string
				excludeTagIDsOnMarker      []string
			}

			serializeRating := func(r *models.IntCriterionInput) string {
				if r == nil {
					return ""
				}
				v2 := ""
				if r.Value2 != nil {
					v2 = fmt.Sprintf("%d", *r.Value2)
				}
				return fmt.Sprintf("%s:%d:%s", r.Modifier, r.Value, v2)
			}

			serializeRatingCriteria := func(r *models.RatingCriteriaFilterInput) string {
				if r == nil {
					return ""
				}

				var parts []string
				for _, c := range r.Criteria {
					if c == nil || c.Value == nil || c.Key == "" {
						continue
					}
					v2 := ""
					if c.Value.Value2 != nil {
						v2 = fmt.Sprintf("%g", *c.Value.Value2)
					}
					parts = append(parts, fmt.Sprintf("c:%s:%s:%g:%s", c.Key, c.Value.Modifier, c.Value.Value, v2))
				}
				for _, c := range r.Bonuses {
					if c == nil || c.Key == "" {
						continue
					}
					parts = append(parts, fmt.Sprintf("b:%s:%t", c.Key, c.Value))
				}
				for _, c := range r.Penalties {
					if c == nil || c.Key == "" {
						continue
					}
					parts = append(parts, fmt.Sprintf("p:%s:%t", c.Key, c.Value))
				}
				sort.Strings(parts)
				return strings.Join(parts, ",")
			}

			// Serialize unnamed performers to a canonical string for grouping
			serializeUnnamedPerformers := func(ups []models.UnnamedPerformerCriterionInput) string {
				if len(ups) == 0 {
					return ""
				}
				var parts []string
				for _, up := range ups {
					id := ""
					if up.ID != nil {
						id = *up.ID
					}
					eth := strings.Join(up.Ethnicities, ",")
					ctr := strings.Join(up.Countries, ",")
					rat := ""
					if up.Rating != nil {
						v2 := ""
						if up.Rating.Value2 != nil {
							v2 = fmt.Sprintf("%d", *up.Rating.Value2)
						}
						rat = fmt.Sprintf("%s:%d:%s", up.Rating.Modifier, up.Rating.Value, v2)
					}
					ratCriteria := serializeRatingCriteria(up.RatingCriteria)
					parts = append(parts, fmt.Sprintf("{id=%s,eth=[%s],ctr=[%s],rat=%s,ratc=%s}", id, eth, ctr, rat, ratCriteria))
				}
				return strings.Join(parts, ";")
			}

			makeGroupKey := func(g models.SceneMarkerTagGroupInput) groupConfig {
				cfg := groupConfig{
					tagIDs:                append([]string(nil), g.TagIDs...),
					excludeTagIDs:         append([]string(nil), g.ExcludeTagIDs...),
					excludeTagIDsOnMarker: append([]string(nil), g.ExcludeTagIDsOnMarker...),
					performerMode:         "OR", // default
				}
				if g.Depth != nil {
					cfg.depth = *g.Depth
				}
				if g.PerformerMode != nil {
					cfg.performerMode = *g.PerformerMode
				}

				// Top performer fields (use new fields, fall back to deprecated)
				cfg.topPerformerIDs = append([]string(nil), g.TopPerformerIDs...)
				if g.TopAnyCount != nil {
					cfg.topAnyCount = *g.TopAnyCount
				}
				cfg.topEthnicities = append([]string(nil), g.TopEthnicities...)
				cfg.topCountries = append([]string(nil), g.TopCountries...)
				cfg.topRating = serializeRating(g.TopRating)
				if len(cfg.topEthnicities) == 0 && len(g.PerformerEthnicities) > 0 {
					cfg.topEthnicities = append([]string(nil), g.PerformerEthnicities...)
				}
				if len(cfg.topCountries) == 0 && len(g.PerformerCountries) > 0 {
					cfg.topCountries = append([]string(nil), g.PerformerCountries...)
				}
				if cfg.topRating == "" && g.PerformerRating != nil {
					cfg.topRating = serializeRating(g.PerformerRating)
				}

				// Bottom performer fields (use new fields, fall back to deprecated)
				cfg.bottomPerformerIDs = append([]string(nil), g.BottomPerformerIDs...)
				if g.BottomAnyCount != nil {
					cfg.bottomAnyCount = *g.BottomAnyCount
				}
				cfg.bottomEthnicities = append([]string(nil), g.BottomEthnicities...)
				cfg.bottomCountries = append([]string(nil), g.BottomCountries...)
				cfg.bottomRating = serializeRating(g.BottomRating)
				if len(cfg.bottomEthnicities) == 0 && len(g.PerformerEthnicities) > 0 {
					cfg.bottomEthnicities = append([]string(nil), g.PerformerEthnicities...)
				}
				if len(cfg.bottomCountries) == 0 && len(g.PerformerCountries) > 0 {
					cfg.bottomCountries = append([]string(nil), g.PerformerCountries...)
				}
				if cfg.bottomRating == "" && g.PerformerRating != nil {
					cfg.bottomRating = serializeRating(g.PerformerRating)
				}

				// Both roles performer fields
				cfg.bothRolesPerformerIDs = append([]string(nil), g.BothRolesPerformerIDs...)
				cfg.bothRolesEthnicities = append([]string(nil), g.BothRolesEthnicities...)
				cfg.bothRolesCountries = append([]string(nil), g.BothRolesCountries...)
				cfg.bothRolesRating = serializeRating(g.BothRolesRating)
				// Unnamed performers for both roles
				if len(g.BothRolesUnnamedPerformers) > 0 {
					cfg.bothRolesUnnamedPerformers = make([]models.UnnamedPerformerCriterionInput, len(g.BothRolesUnnamedPerformers))
					copy(cfg.bothRolesUnnamedPerformers, g.BothRolesUnnamedPerformers)
				}
				// Unnamed performers for top/bottom roles
				if len(g.TopUnnamedPerformers) > 0 {
					cfg.topUnnamedPerformers = make([]models.UnnamedPerformerCriterionInput, len(g.TopUnnamedPerformers))
					copy(cfg.topUnnamedPerformers, g.TopUnnamedPerformers)
				}
				if len(g.BottomUnnamedPerformers) > 0 {
					cfg.bottomUnnamedPerformers = make([]models.UnnamedPerformerCriterionInput, len(g.BottomUnnamedPerformers))
					copy(cfg.bottomUnnamedPerformers, g.BottomUnnamedPerformers)
				}

				// Sort all slices for canonical ordering
				sort.Strings(cfg.tagIDs)
				sort.Strings(cfg.excludeTagIDs)
				sort.Strings(cfg.excludeTagIDsOnMarker)
				sort.Strings(cfg.topPerformerIDs)
				sort.Strings(cfg.topEthnicities)
				sort.Strings(cfg.topCountries)
				sort.Strings(cfg.bottomPerformerIDs)
				sort.Strings(cfg.bottomEthnicities)
				sort.Strings(cfg.bottomCountries)
				sort.Strings(cfg.bothRolesPerformerIDs)
				sort.Strings(cfg.bothRolesEthnicities)
				sort.Strings(cfg.bothRolesCountries)

				return cfg
			}

			// Group configurations by canonical key
			type groupEntry struct {
				config        groupConfig
				originalGroup models.SceneMarkerTagGroupInput
			}
			configCounts := make(map[string]int)
			configGroups := make(map[string]groupEntry)

			for _, g := range c.GroupsExtended {
				cfg := makeGroupKey(g)
				// Serialize config to string key for grouping
				keyParts := []string{
					strings.Join(cfg.tagIDs, ","),
					fmt.Sprintf("d%d", cfg.depth),
					cfg.performerMode,
					strings.Join(cfg.topPerformerIDs, ","),
					fmt.Sprintf("tac%d", cfg.topAnyCount),
					strings.Join(cfg.topEthnicities, ","),
					strings.Join(cfg.topCountries, ","),
					cfg.topRating,
					serializeUnnamedPerformers(cfg.topUnnamedPerformers),
					strings.Join(cfg.bottomPerformerIDs, ","),
					fmt.Sprintf("bac%d", cfg.bottomAnyCount),
					strings.Join(cfg.bottomEthnicities, ","),
					strings.Join(cfg.bottomCountries, ","),
					cfg.bottomRating,
					serializeUnnamedPerformers(cfg.bottomUnnamedPerformers),
					strings.Join(cfg.bothRolesPerformerIDs, ","),
					strings.Join(cfg.bothRolesEthnicities, ","),
					strings.Join(cfg.bothRolesCountries, ","),
					cfg.bothRolesRating,
					serializeUnnamedPerformers(cfg.bothRolesUnnamedPerformers),
					strings.Join(cfg.excludeTagIDs, ","),
					strings.Join(cfg.excludeTagIDsOnMarker, ","),
				}
				key := strings.Join(keyParts, "|")
				configCounts[key]++
				if _, exists := configGroups[key]; !exists {
					configGroups[key] = groupEntry{config: cfg, originalGroup: g}
				}
			}

			// Secondary grouping: when multiple configs differ ONLY by unnamed performer IDs
			// (but have the same tag IDs and performer characteristics), they're functionally
			// equivalent and should be merged to require that many DISTINCT markers.
			//
			// This handles cases like:
			// - Group A: top=unnamed-A(Black), bottom=unnamed-B(Black)
			// - Group B: top=unnamed-B(Black), bottom=unnamed-A(Black)
			// Both produce the same SQL condition (Black top + Black bottom), so a single
			// marker would match both. We need to sum their multiplicities.

			// Create a key that ignores unnamed performer IDs, only keeping characteristics
			serializeUnnamedPerformersNoID := func(ups []models.UnnamedPerformerCriterionInput) string {
				if len(ups) == 0 {
					return ""
				}
				var parts []string
				for _, up := range ups {
					eth := strings.Join(up.Ethnicities, ",")
					ctr := strings.Join(up.Countries, ",")
					rat := ""
					if up.Rating != nil {
						v2 := ""
						if up.Rating.Value2 != nil {
							v2 = fmt.Sprintf("%d", *up.Rating.Value2)
						}
						rat = fmt.Sprintf("%s:%d:%s", up.Rating.Modifier, up.Rating.Value, v2)
					}
					ratCriteria := serializeRatingCriteria(up.RatingCriteria)
					parts = append(parts, fmt.Sprintf("{eth=[%s],ctr=[%s],rat=%s,ratc=%s}", eth, ctr, rat, ratCriteria))
				}
				// Sort to ensure order doesn't matter
				sort.Strings(parts)
				return strings.Join(parts, ";")
			}

			makeCharacteristicsKey := func(cfg groupConfig) string {
				keyParts := []string{
					strings.Join(cfg.tagIDs, ","),
					fmt.Sprintf("d%d", cfg.depth),
					cfg.performerMode,
					strings.Join(cfg.topPerformerIDs, ","),
					fmt.Sprintf("tac%d", cfg.topAnyCount),
					strings.Join(cfg.topEthnicities, ","),
					strings.Join(cfg.topCountries, ","),
					cfg.topRating,
					serializeUnnamedPerformersNoID(cfg.topUnnamedPerformers),
					strings.Join(cfg.bottomPerformerIDs, ","),
					fmt.Sprintf("bac%d", cfg.bottomAnyCount),
					strings.Join(cfg.bottomEthnicities, ","),
					strings.Join(cfg.bottomCountries, ","),
					cfg.bottomRating,
					serializeUnnamedPerformersNoID(cfg.bottomUnnamedPerformers),
					strings.Join(cfg.bothRolesPerformerIDs, ","),
					strings.Join(cfg.bothRolesEthnicities, ","),
					strings.Join(cfg.bothRolesCountries, ","),
					cfg.bothRolesRating,
					serializeUnnamedPerformersNoID(cfg.bothRolesUnnamedPerformers),
					strings.Join(cfg.excludeTagIDs, ","),
					strings.Join(cfg.excludeTagIDsOnMarker, ","),
				}
				return strings.Join(keyParts, "|")
			}

			// Check if we need to merge groups based on characteristics
			charKeyTotals := make(map[string]int)
			charKeyConfigs := make(map[string][]string) // maps char key to list of original keys
			for key := range configCounts {
				cfg := configGroups[key].config
				charKey := makeCharacteristicsKey(cfg)
				charKeyTotals[charKey] += configCounts[key]
				charKeyConfigs[charKey] = append(charKeyConfigs[charKey], key)
			}

			// If any char key has multiple original keys, we need to merge them
			for charKey, originalKeys := range charKeyConfigs {
				if len(originalKeys) > 1 {
					// These configs are functionally equivalent - pick one and set its multiplicity
					// to the sum, then remove the others
					totalMultiplicity := charKeyTotals[charKey]
					keepKey := originalKeys[0]
					configCounts[keepKey] = totalMultiplicity
					for i := 1; i < len(originalKeys); i++ {
						delete(configCounts, originalKeys[i])
						delete(configGroups, originalKeys[i])
					}
				}
			}

			// Now generate queries for each unique configuration
			for key, multiplicity := range configCounts {
				entry := configGroups[key]
				g := entry.originalGroup
				cfg := entry.config

				tagIDs := g.TagIDs

				// Determine performer mode
				performerModeAnd := strings.EqualFold(cfg.performerMode, "AND")

				// Build the WHERE clause for matching a single marker
				var matchConditions []string
				var matchArgs []any

				if markerCondition, ok := buildSceneMarkerGroupCondition(g, "sm"); ok {
					matchConditions = append(matchConditions, markerCondition.clause)
					matchArgs = append(matchArgs, markerCondition.args...)
				}
				if f.getError() != nil {
					return
				}

				// Handle exclude-only groups (no include tags/performers, only excludes)
				if len(matchConditions) == 0 && len(cfg.excludeTagIDs) > 0 {
					// Check performer_mode to determine AND vs OR semantics
					if performerModeAnd {
						// AND mode: exclude only if scene has markers with ALL exclude tags (require each tag on distinct markers)
						// For each exclude tag, require at least one marker with that tag
						// Then use AND to combine (scene must have all of them to be excluded)
						excludeConditions := make([]string, len(cfg.excludeTagIDs))
						var excludeArgs []any
						for i, tid := range cfg.excludeTagIDs {
							excludeConditions[i] = utils.StrFormat(`EXISTS (
SELECT 1 FROM scene_markers sm_excl`+fmt.Sprintf("%d", i)+`
WHERE sm_excl`+fmt.Sprintf("%d", i)+`.scene_id = {primaryTable}.id
  AND (
    sm_excl`+fmt.Sprintf("%d", i)+`.primary_tag_id = ?
    OR EXISTS (
      SELECT 1 FROM scene_markers_tags smt_excl`+fmt.Sprintf("%d", i)+`
      WHERE smt_excl`+fmt.Sprintf("%d", i)+`.scene_marker_id = sm_excl`+fmt.Sprintf("%d", i)+`.id AND smt_excl`+fmt.Sprintf("%d", i)+`.tag_id = ?
    )
  )
)`, utils.StrFormatMap{"primaryTable": h.primaryTable})
							excludeArgs = append(excludeArgs, tid, tid)
						}
						// NOT (all exist) means exclude scenes that have ALL these tags
						excludeSubq := "NOT (" + strings.Join(excludeConditions, " AND ") + ")"
						f.addWhere(excludeSubq, excludeArgs...)
					} else {
						// OR mode: exclude if scene has marker with ANY of these tags
						excludePh := getInBinding(len(cfg.excludeTagIDs))
						excludeSubq := utils.StrFormat(`NOT EXISTS (
SELECT 1 FROM scene_markers sm_excl
WHERE sm_excl.scene_id = {primaryTable}.id
  AND (
    sm_excl.primary_tag_id IN `+excludePh+`
    OR EXISTS (
      SELECT 1 FROM scene_markers_tags smt_excl
      WHERE smt_excl.scene_marker_id = sm_excl.id AND smt_excl.tag_id IN `+excludePh+`
    )
  )
)`, utils.StrFormatMap{"primaryTable": h.primaryTable})
						var excludeArgs []any
						for _, tid := range cfg.excludeTagIDs {
							excludeArgs = append(excludeArgs, tid)
						}
						for _, tid := range cfg.excludeTagIDs {
							excludeArgs = append(excludeArgs, tid)
						}
						f.addWhere(excludeSubq, excludeArgs...)
					}
					continue
				}

				if len(matchConditions) == 0 {
					// Empty group with no excludes, skip
					continue
				}

				// Special case: when multiplicity > 1 and there's exactly one unnamed performer,
				// we need to ensure the SAME performer appears in all matching markers.
				// This handles cases like "Performer A in 3 orgasm markers" where A should be
				// the same person in all 3, not different people.
				totalUnnamedCount := len(cfg.topUnnamedPerformers) + len(cfg.bottomUnnamedPerformers) + len(cfg.bothRolesUnnamedPerformers)
				hasOnlyOneUnnamedPerformer := totalUnnamedCount == 1
				hasNoNamedPerformers := len(cfg.topPerformerIDs) == 0 && len(cfg.bottomPerformerIDs) == 0 && len(cfg.bothRolesPerformerIDs) == 0

				if multiplicity > 1 && hasOnlyOneUnnamedPerformer && hasNoNamedPerformers {
					// Determine which role and get the unnamed performer conditions
					var role string
					var unnamedPerformer models.UnnamedPerformerCriterionInput
					if len(cfg.topUnnamedPerformers) == 1 {
						role = "top"
						unnamedPerformer = cfg.topUnnamedPerformers[0]
					} else if len(cfg.bottomUnnamedPerformers) == 1 {
						role = "bottom"
						unnamedPerformer = cfg.bottomUnnamedPerformers[0]
					} else {
						role = "" // both_roles - no specific role filter
						unnamedPerformer = cfg.bothRolesUnnamedPerformers[0]
					}

					// Build performer characteristic conditions
					var perfCondParts []string
					var perfCondArgs []any
					if len(unnamedPerformer.Ethnicities) > 0 {
						expanded := expandEthnicities(unnamedPerformer.Ethnicities)
						ph := getInBinding(len(expanded))
						perfCondParts = append(perfCondParts, "p_check.ethnicity IN "+ph)
						for _, e := range expanded {
							perfCondArgs = append(perfCondArgs, e)
						}
					}
					if len(unnamedPerformer.Countries) > 0 {
						ph := getInBinding(len(unnamedPerformer.Countries))
						perfCondParts = append(perfCondParts, "p_check.country IN "+ph)
						for _, c := range unnamedPerformer.Countries {
							perfCondArgs = append(perfCondArgs, c)
						}
					}
					if unnamedPerformer.Rating != nil {
						w, wargs := getIntWhereClause("p_check.rating", unnamedPerformer.Rating.Modifier, unnamedPerformer.Rating.Value, unnamedPerformer.Rating.Value2)
						perfCondParts = append(perfCondParts, w)
						perfCondArgs = append(perfCondArgs, wargs...)
					}
					if ratingCriteriaFragment := buildPerformerRatingCriteriaClause("p_check", unnamedPerformer.RatingCriteria); ratingCriteriaFragment.clause != "" {
						perfCondParts = append(perfCondParts, ratingCriteriaFragment.clause)
						perfCondArgs = append(perfCondArgs, ratingCriteriaFragment.args...)
					}

					perfCondClause := "1=1"
					if len(perfCondParts) > 0 {
						perfCondClause = strings.Join(perfCondParts, " AND ")
					}

					// Build tag condition for the markers
					var tagCondClause string
					var tagCondArgs []any
					if len(tagIDs) > 0 {
						tagPh := getInBinding(len(tagIDs))
						tagCondClause = fmt.Sprintf(`(sm_check.primary_tag_id IN %s OR EXISTS (
							SELECT 1 FROM scene_markers_tags smt_check 
							WHERE smt_check.scene_marker_id = sm_check.id AND smt_check.tag_id IN %s
						))`, tagPh, tagPh)
						for _, tid := range tagIDs {
							tagCondArgs = append(tagCondArgs, tid)
						}
						// Add twice for both IN clauses
						for _, tid := range tagIDs {
							tagCondArgs = append(tagCondArgs, tid)
						}
					} else {
						tagCondClause = "1=1"
					}

					// Marker-level exclude tags: marker must NOT have any of these tags
					var markerExcludeClause string
					var markerExcludeArgs []any
					if len(cfg.excludeTagIDsOnMarker) > 0 {
						exclPh := getInBinding(len(cfg.excludeTagIDsOnMarker))
						markerExcludeClause = fmt.Sprintf(`NOT (
							sm_check.primary_tag_id IN %s
							OR EXISTS (
								SELECT 1 FROM scene_markers_tags smt_excl
								WHERE smt_excl.scene_marker_id = sm_check.id AND smt_excl.tag_id IN %s
							)
						)`, exclPh, exclPh)
						for _, tid := range cfg.excludeTagIDsOnMarker {
							markerExcludeArgs = append(markerExcludeArgs, tid)
						}
						for _, tid := range cfg.excludeTagIDsOnMarker {
							markerExcludeArgs = append(markerExcludeArgs, tid)
						}
					} else {
						markerExcludeClause = "1=1"
					}

					// Build role condition
					roleCondClause := "1=1"
					if role != "" {
						roleCondClause = fmt.Sprintf("smp_check.role = '%s'", role)
					}

					// Query: find a performer matching characteristics who appears in >= multiplicity markers with the tag
					// Optimized: Instead of scanning ALL performers, we query markers on this scene first,
					// then group by performer to find one with enough matching markers.
					// This is O(markers in scene) instead of O(all performers in database).
					subq := utils.StrFormat(`EXISTS (
SELECT 1 
FROM scene_markers sm_check
JOIN scene_marker_performers smp_check ON smp_check.scene_marker_id = sm_check.id
JOIN performers p_check ON p_check.id = smp_check.performer_id
WHERE sm_check.scene_id = {primaryTable}.id
  AND `+roleCondClause+`
  AND `+tagCondClause+`
	AND `+markerExcludeClause+`
  AND `+perfCondClause+`
GROUP BY smp_check.performer_id
HAVING COUNT(DISTINCT sm_check.id) >= ?
)`, utils.StrFormatMap{"primaryTable": h.primaryTable})

					var allArgs []any
					allArgs = append(allArgs, tagCondArgs...)
					allArgs = append(allArgs, markerExcludeArgs...)
					allArgs = append(allArgs, perfCondArgs...)
					allArgs = append(allArgs, multiplicity)
					f.addWhere(subq, allArgs...)

					// Handle exclude_tag_ids for this special case too
					if len(cfg.excludeTagIDs) > 0 {
						excludePh := getInBinding(len(cfg.excludeTagIDs))
						excludeSubq := utils.StrFormat(`NOT EXISTS (
SELECT 1 FROM scene_markers sm_excl
WHERE sm_excl.scene_id = {primaryTable}.id
  AND (
    sm_excl.primary_tag_id IN `+excludePh+`
    OR EXISTS (
      SELECT 1 FROM scene_markers_tags smt_excl
      WHERE smt_excl.scene_marker_id = sm_excl.id AND smt_excl.tag_id IN `+excludePh+`
    )
  )
)`, utils.StrFormatMap{"primaryTable": h.primaryTable})
						var excludeArgs []any
						for _, tid := range cfg.excludeTagIDs {
							excludeArgs = append(excludeArgs, tid)
						}
						for _, tid := range cfg.excludeTagIDs {
							excludeArgs = append(excludeArgs, tid)
						}
						f.addWhere(excludeSubq, excludeArgs...)
					}
					continue // Skip the normal processing
				}

				// Build the COUNT(DISTINCT sm.id) query
				whereClause := strings.Join(matchConditions, " AND ")
				subq := utils.StrFormat(`(
SELECT COUNT(DISTINCT sm.id)
FROM scene_markers sm
WHERE sm.scene_id = {primaryTable}.id
  AND `+whereClause+`
) >= ?`, utils.StrFormatMap{"primaryTable": h.primaryTable})

				matchArgs = append(matchArgs, multiplicity)
				f.addWhere(subq, matchArgs...)

				// Handle exclude_tag_ids (for groups that also have include conditions)
				if len(cfg.excludeTagIDs) > 0 {
					excludePh := getInBinding(len(cfg.excludeTagIDs))
					excludeSubq := utils.StrFormat(`NOT EXISTS (
SELECT 1 FROM scene_markers sm_excl
WHERE sm_excl.scene_id = {primaryTable}.id
  AND (
    sm_excl.primary_tag_id IN `+excludePh+`
    OR EXISTS (
      SELECT 1 FROM scene_markers_tags smt_excl
      WHERE smt_excl.scene_marker_id = sm_excl.id AND smt_excl.tag_id IN `+excludePh+`
    )
  )
)`, utils.StrFormatMap{"primaryTable": h.primaryTable})
					var excludeArgs []any
					for _, tid := range cfg.excludeTagIDs {
						excludeArgs = append(excludeArgs, tid)
					}
					for _, tid := range cfg.excludeTagIDs {
						excludeArgs = append(excludeArgs, tid)
					}
					f.addWhere(excludeSubq, excludeArgs...)
				}
			}

			// Process GroupsExtendedExclude - exclude scenes with markers matching these full criteria.
			if len(c.GroupsExtendedExclude) > 0 {
				var existsConditions []string
				var existsArgs []any

				for i, eg := range c.GroupsExtendedExclude {
					markerAlias := fmt.Sprintf("sm_ex_%d", i)
					markerCondition, ok := buildSceneMarkerGroupCondition(eg, markerAlias)
					if f.getError() != nil {
						return
					}
					if !ok {
						continue
					}

					existsConditions = append(existsConditions, utils.StrFormat(`EXISTS (
SELECT 1 FROM scene_markers `+markerAlias+`
WHERE `+markerAlias+`.scene_id = {primaryTable}.id
  AND `+markerCondition.clause+`
)`, utils.StrFormatMap{"primaryTable": h.primaryTable}))
					existsArgs = append(existsArgs, markerCondition.args...)
				}

				if len(existsConditions) > 0 {
					joiner := " OR "
					if c.ExcludeModifier != nil && *c.ExcludeModifier == models.CriterionModifierIncludesAll {
						joiner = " AND "
					}
					f.addWhere("NOT ("+strings.Join(existsConditions, joiner)+")", existsArgs...)
				}
			}

			return
		}

		// Treat Value as a single group if Groups not provided
		groups := c.Groups
		if len(groups) == 0 && len(c.Value) > 0 {
			groups = [][]string{c.Value}
		}

		if len(groups) == 0 {
			// nothing to enforce
			return
		}

		// Group identical tag-sets and require sufficient distinct markers for each set
		type groupKey struct{ s string }
		counts := make(map[groupKey]int)
		orderedGroups := make(map[groupKey][]string)
		for _, g := range groups {
			if len(g) == 0 {
				continue
			}
			// build order-independent key
			vals := append([]string(nil), g...)
			sort.Strings(vals)
			key := groupKey{s: strings.Join(vals, ",")}
			counts[key]++
			// store canonical ordered group once
			if _, ok := orderedGroups[key]; !ok {
				orderedGroups[key] = vals
			}
		}

		for k, multiplicity := range counts {
			g := orderedGroups[k]
			if len(g) == 0 {
				continue
			}
			ph := getInBinding(len(g))
			// Require at least <multiplicity> distinct markers matching the tag-set
			subq := utils.StrFormat(`(
SELECT COUNT(DISTINCT sm.id)
FROM scene_markers sm
WHERE sm.scene_id = {primaryTable}.id
	AND (
		SELECT COUNT(DISTINCT tag_id) FROM (
			SELECT sm.primary_tag_id AS tag_id
			UNION ALL
			SELECT mt2.tag_id AS tag_id FROM scene_markers_tags mt2 WHERE mt2.scene_marker_id = sm.id
		) tags_per_marker
		WHERE tag_id IN `+ph+`
	) = `+fmt.Sprintf("%d", len(g))+`
) >= ?`, utils.StrFormatMap{"primaryTable": h.primaryTable})

			args := make([]any, 0, len(g)+1)
			for _, v := range g {
				args = append(args, v)
			}
			args = append(args, multiplicity)
			f.addWhere(subq, args...)
		}
		return

	case models.CriterionModifierNotEquals:
		// Treat Value as a single group if Groups not provided
		groups := c.Groups
		if len(groups) == 0 && len(c.Value) > 0 {
			groups = [][]string{c.Value}
		}

		if len(groups) == 0 {
			// nothing to enforce
			return
		}

		// Deduplicate identical groups (order-insensitive)
		type groupKey struct{ s string }
		unique := make(map[groupKey][]string)
		for _, g := range groups {
			if len(g) == 0 {
				continue
			}
			vals := append([]string(nil), g...)
			sort.Strings(vals)
			key := groupKey{s: strings.Join(vals, ",")}
			if _, ok := unique[key]; !ok {
				unique[key] = vals
			}
		}

		// For each unique group, assert there does NOT exist a marker that contains all tags in that group
		for _, g := range unique {
			ph := getInBinding(len(g))
			subq := utils.StrFormat(`NOT EXISTS (
SELECT 1
FROM scene_markers sm
WHERE sm.scene_id = {primaryTable}.id
  AND (
    SELECT COUNT(DISTINCT tag_id) FROM (
      SELECT sm.primary_tag_id AS tag_id
      UNION ALL
      SELECT mt2.tag_id AS tag_id FROM scene_markers_tags mt2 WHERE mt2.scene_marker_id = sm.id
    ) tags_per_marker
    WHERE tag_id IN `+ph+`
  ) = `+fmt.Sprintf("%d", len(g))+`
)`, utils.StrFormatMap{"primaryTable": h.primaryTable})

			args := make([]any, 0, len(g))
			for _, v := range g {
				args = append(args, v)
			}
			f.addWhere(subq, args...)
		}
		return

	case models.CriterionModifierIncludesAll:
		// Each tag in Value must be present on at least one marker in the scene
		if len(c.Value) == 0 {
			return
		}
		for _, v := range c.Value {
			clause := utils.StrFormat(`EXISTS (
SELECT 1 FROM scene_markers sm
LEFT JOIN scene_markers_tags mt ON mt.scene_marker_id = sm.id
WHERE sm.scene_id = {primaryTable}.id AND (sm.primary_tag_id = ? OR mt.tag_id = ?)
)`, utils.StrFormatMap{"primaryTable": h.primaryTable})
			f.addWhere(clause, v, v)
		}
		return

	case models.CriterionModifierIncludes:
		if len(c.Value) == 0 {
			return
		}
		ph := getInBinding(len(c.Value))
		clause := utils.StrFormat(`EXISTS (
SELECT 1 FROM scene_markers sm
LEFT JOIN scene_markers_tags mt ON mt.scene_marker_id = sm.id
WHERE sm.scene_id = {primaryTable}.id AND (sm.primary_tag_id IN `+ph+` OR mt.tag_id IN `+ph+`)
)`, utils.StrFormatMap{"primaryTable": h.primaryTable})
		args := make([]any, 0, len(c.Value)*2)
		for _, v := range c.Value {
			args = append(args, v)
		}
		for _, v := range c.Value {
			args = append(args, v)
		}
		f.addWhere(clause, args...)
		return

	default:
		// Unsupported modifiers: no-op
		return
	}
}
