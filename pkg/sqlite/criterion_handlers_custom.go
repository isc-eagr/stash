package sqlite

// CUSTOM: Custom criterion handlers for scene marker tags, custom filters, scene types,
// performer markers, ethnicity, country, etc.

import (
	"context"
	"fmt"
	"sort"
	"strconv"
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
					parts = append(parts, fmt.Sprintf("{id=%s,eth=[%s],ctr=[%s],rat=%s}", id, eth, ctr, rat))
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
					parts = append(parts, fmt.Sprintf("{eth=[%s],ctr=[%s],rat=%s}", eth, ctr, rat))
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

				// CUSTOM: begin - depth expansion is done per-tag in the Tags condition block below
				tagIDs := g.TagIDs
				depthUsed := len(tagIDs) > 0 && g.Depth != nil && *g.Depth != 0

				originalTagCount := len(g.TagIDs)
				// CUSTOM: end

				// Determine performer mode
				performerModeAnd := strings.EqualFold(cfg.performerMode, "AND")

				// Helper to build role-specific condition
				type roleCondition struct {
					clause string
					args   []any
				}

				// buildRoleCondition builds a condition for a performer role
				// tableAlias: the alias for scene_marker_performers table (e.g., "smp", "smp_g", "smp_r")
				// role: the role to match ("top", "bottom"), or empty string to skip role check
				buildRoleCondition := func(tableAlias string, role string, performerIDs []string, ethnicities []string, countries []string, ratingStr string) *roleCondition {
					var clauses []string
					var args []any

					var baseClauses []string
					if role != "" {
						baseClauses = append(baseClauses, fmt.Sprintf("%s.role = '%s'", tableAlias, role))
					}

					if len(performerIDs) > 0 {
						ph := getInBinding(len(performerIDs))
						baseClauses = append(baseClauses, fmt.Sprintf("%s.performer_id IN %s", tableAlias, ph))
						for _, pid := range performerIDs {
							args = append(args, pid)
						}
					}

					if len(ethnicities) > 0 {
						expanded := expandEthnicities(ethnicities)
						ph := getInBinding(len(expanded))
						baseClauses = append(baseClauses, fmt.Sprintf("p.ethnicity IN %s", ph))
						for _, e := range expanded {
							args = append(args, e)
						}
					}

					if len(countries) > 0 {
						ph := getInBinding(len(countries))
						baseClauses = append(baseClauses, fmt.Sprintf("p.country IN %s", ph))
						for _, c := range countries {
							args = append(args, c)
						}
					}

					if ratingStr != "" {
						// Deserialize rating (format: "modifier:value:value2")
						parts := strings.Split(ratingStr, ":")
						if len(parts) >= 2 {
							modifier := models.CriterionModifier(parts[0])
							value, _ := strconv.Atoi(parts[1])
							var value2 *int
							if len(parts) == 3 && parts[2] != "" {
								v2, _ := strconv.Atoi(parts[2])
								value2 = &v2
							}
							w, wargs := getIntWhereClause("p.rating", modifier, value, value2)
							baseClauses = append(baseClauses, w)
							args = append(args, wargs...)
						}
					}

					clauses = append(clauses, "("+strings.Join(baseClauses, " AND ")+")")

					return &roleCondition{
						clause: strings.Join(clauses, " AND "),
						args:   args,
					}
				}

				// Build role conditions
				hasTopCriteria := len(cfg.topPerformerIDs) > 0 || cfg.topAnyCount > 0 || len(cfg.topEthnicities) > 0 || len(cfg.topCountries) > 0 || cfg.topRating != ""
				var topCond *roleCondition
				if hasTopCriteria && len(cfg.topPerformerIDs) > 0 {
					// Specific performer IDs specified
					topCond = buildRoleCondition("smp", "top", cfg.topPerformerIDs, cfg.topEthnicities, cfg.topCountries, cfg.topRating)
				} else if hasTopCriteria && (len(cfg.topEthnicities) > 0 || len(cfg.topCountries) > 0 || cfg.topRating != "") {
					// Ethnicity/country/rating criteria without specific IDs
					topCond = buildRoleCondition("smp", "top", nil, cfg.topEthnicities, cfg.topCountries, cfg.topRating)
				}

				hasBottomCriteria := len(cfg.bottomPerformerIDs) > 0 || cfg.bottomAnyCount > 0 || len(cfg.bottomEthnicities) > 0 || len(cfg.bottomCountries) > 0 || cfg.bottomRating != ""
				var bottomCond *roleCondition
				if hasBottomCriteria && len(cfg.bottomPerformerIDs) > 0 {
					// Specific performer IDs specified
					bottomCond = buildRoleCondition("smp", "bottom", cfg.bottomPerformerIDs, cfg.bottomEthnicities, cfg.bottomCountries, cfg.bottomRating)
				} else if hasBottomCriteria && (len(cfg.bottomEthnicities) > 0 || len(cfg.bottomCountries) > 0 || cfg.bottomRating != "") {
					// Ethnicity/country/rating criteria without specific IDs
					bottomCond = buildRoleCondition("smp", "bottom", nil, cfg.bottomEthnicities, cfg.bottomCountries, cfg.bottomRating)
				}

				hasBothRolesCriteria := len(cfg.bothRolesPerformerIDs) > 0 || len(cfg.bothRolesEthnicities) > 0 || len(cfg.bothRolesCountries) > 0 || cfg.bothRolesRating != ""
				hasBothRolesUnnamedCriteria := len(cfg.bothRolesUnnamedPerformers) > 0

				// Build the WHERE clause for matching a single marker
				var matchConditions []string
				var matchArgs []any

				// CUSTOM: begin - Tags condition with per-tag depth expansion
				// When depth != 0, expand each original tag independently so the marker must
				// have at least one tag from EACH family (AND across families). Without depth,
				// the marker must have ALL the exact original tags.
				if len(tagIDs) > 0 {
					if depthUsed {
						for _, originalTagID := range g.TagIDs {
							valuesClause, err := getHierarchicalValues(ctx, []string{originalTagID}, tagTable, "tags_relations", "parent_id", "child_id", g.Depth)
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
								matchConditions = append(matchConditions, `(
    sm.primary_tag_id IN `+ph+`
    OR EXISTS (
        SELECT 1 FROM scene_markers_tags mt2 WHERE mt2.scene_marker_id = sm.id AND mt2.tag_id IN `+ph+`
    )
)`)
								for _, tid := range expandedIDs {
									matchArgs = append(matchArgs, tid)
								}
								for _, tid := range expandedIDs {
									matchArgs = append(matchArgs, tid)
								}
							}
						}
					} else {
						// Exact tag match: all original tags must be present on this marker
						tagPh := getInBinding(len(tagIDs))
						matchConditions = append(matchConditions, `(
    SELECT COUNT(DISTINCT tag_id) FROM (
      SELECT sm.primary_tag_id AS tag_id
      UNION ALL
      SELECT mt2.tag_id AS tag_id FROM scene_markers_tags mt2 WHERE mt2.scene_marker_id = sm.id
    ) tags_per_marker
    WHERE tag_id IN `+tagPh+`
  ) = `+fmt.Sprintf("%d", originalTagCount))
						for _, tid := range tagIDs {
							matchArgs = append(matchArgs, tid)
						}
					}
				}
				// CUSTOM: end

				// Marker-level exclude tags: marker must NOT have any of these tags
				if len(cfg.excludeTagIDsOnMarker) > 0 {
					exclPh := getInBinding(len(cfg.excludeTagIDsOnMarker))
					matchConditions = append(matchConditions, `NOT (
		sm.primary_tag_id IN `+exclPh+`
		OR EXISTS (
			SELECT 1 FROM scene_markers_tags mt_excl
			WHERE mt_excl.scene_marker_id = sm.id AND mt_excl.tag_id IN `+exclPh+`
		)
	)`)
					for _, tid := range cfg.excludeTagIDsOnMarker {
						matchArgs = append(matchArgs, tid)
					}
					for _, tid := range cfg.excludeTagIDsOnMarker {
						matchArgs = append(matchArgs, tid)
					}
				}

				// Performer conditions
				if hasBothRolesCriteria {
					// Both roles: performer must be in BOTH top and bottom
					// Build conditions with correct table aliases - smp_g for top EXISTS, smp_r for bottom EXISTS
					// Skip role param since we specify role directly in WHERE clause
					bothRolesCondTop := buildRoleCondition("smp_g", "", cfg.bothRolesPerformerIDs, cfg.bothRolesEthnicities, cfg.bothRolesCountries, cfg.bothRolesRating)
					bothRolesCondBottom := buildRoleCondition("smp_r", "", cfg.bothRolesPerformerIDs, cfg.bothRolesEthnicities, cfg.bothRolesCountries, cfg.bothRolesRating)
					matchConditions = append(matchConditions, `EXISTS (
    SELECT 1 FROM scene_marker_performers smp_g
    JOIN performers p ON p.id = smp_g.performer_id
    WHERE smp_g.scene_marker_id = sm.id AND smp_g.role = 'top' AND `+bothRolesCondTop.clause+`
  ) AND EXISTS (
    SELECT 1 FROM scene_marker_performers smp_r
    JOIN performers p ON p.id = smp_r.performer_id
    WHERE smp_r.scene_marker_id = sm.id AND smp_r.role = 'bottom' AND `+bothRolesCondBottom.clause+`
  )`)
					matchArgs = append(matchArgs, bothRolesCondTop.args...)
					matchArgs = append(matchArgs, bothRolesCondBottom.args...)
				}

				// Handle unnamed performers for both_roles
				// Each unnamed performer slot represents a performer that must be in BOTH top and bottom
				if hasBothRolesUnnamedCriteria {
					for i, up := range cfg.bothRolesUnnamedPerformers {
						// Build performer criteria condition (ethnicity, country, rating)
						var upConds []string
						var upArgs []any

						if len(up.Ethnicities) > 0 {
							expanded := expandEthnicities(up.Ethnicities)
							ph := getInBinding(len(expanded))
							upConds = append(upConds, "p_br.ethnicity IN "+ph)
							for _, e := range expanded {
								upArgs = append(upArgs, e)
							}
						}
						if len(up.Countries) > 0 {
							ph := getInBinding(len(up.Countries))
							upConds = append(upConds, "p_br.country IN "+ph)
							for _, c := range up.Countries {
								upArgs = append(upArgs, c)
							}
						}
						if up.Rating != nil {
							w, wargs := getIntWhereClause("p_br.rating", up.Rating.Modifier, up.Rating.Value, up.Rating.Value2)
							upConds = append(upConds, w)
							upArgs = append(upArgs, wargs...)
						}

						// If no additional criteria, just require any performer in both roles
						upCondClause := "1=1"
						if len(upConds) > 0 {
							upCondClause = strings.Join(upConds, " AND ")
						}

						// Generate unique table aliases for this unnamed performer slot
						alias := fmt.Sprintf("smp_bru%d", i)

						// Find a performer P that:
						// 1. Is in this marker as TOP
						// 2. Is in this marker as BOTTOM
						// 3. Matches the criteria (if any)
						matchConditions = append(matchConditions, fmt.Sprintf(`EXISTS (
    SELECT 1 FROM scene_marker_performers %s
    JOIN performers p_br ON p_br.id = %s.performer_id
    WHERE %s.scene_marker_id = sm.id
      AND EXISTS (SELECT 1 FROM scene_marker_performers WHERE scene_marker_id = sm.id AND performer_id = %s.performer_id AND role = 'top')
      AND EXISTS (SELECT 1 FROM scene_marker_performers WHERE scene_marker_id = sm.id AND performer_id = %s.performer_id AND role = 'bottom')
      AND %s
  )`, alias, alias, alias, alias, alias, upCondClause))
						matchArgs = append(matchArgs, upArgs...)
					}
				}

				// Handle separate top/bottom unnamed performers
				// These are unnamed performer slots that are NOT in both_roles
				hasTopUnnamedCriteria := len(cfg.topUnnamedPerformers) > 0
				hasBottomUnnamedCriteria := len(cfg.bottomUnnamedPerformers) > 0

				if hasTopUnnamedCriteria || hasBottomUnnamedCriteria {
					// Build a helper to create condition for unnamed performer
					buildUnnamedCondition := func(up models.UnnamedPerformerCriterionInput, performerAlias string) (string, []any) {
						var conds []string
						var args []any

						if len(up.Ethnicities) > 0 {
							expanded := expandEthnicities(up.Ethnicities)
							ph := getInBinding(len(expanded))
							conds = append(conds, performerAlias+".ethnicity IN "+ph)
							for _, e := range expanded {
								args = append(args, e)
							}
						}
						if len(up.Countries) > 0 {
							ph := getInBinding(len(up.Countries))
							conds = append(conds, performerAlias+".country IN "+ph)
							for _, c := range up.Countries {
								args = append(args, c)
							}
						}
						if up.Rating != nil {
							w, wargs := getIntWhereClause(performerAlias+".rating", up.Rating.Modifier, up.Rating.Value, up.Rating.Value2)
							conds = append(conds, w)
							args = append(args, wargs...)
						}

						if len(conds) == 0 {
							return "1=1", nil
						}
						return strings.Join(conds, " AND "), args
					}

					// Collect all performer aliases we'll use to ensure distinctness
					var topAliases []string
					var bottomAliases []string

					// Process top unnamed performers
					for i, up := range cfg.topUnnamedPerformers {
						alias := fmt.Sprintf("smp_tu%d", i)
						topAliases = append(topAliases, alias)

						cond, args := buildUnnamedCondition(up, "p_tu")
						matchConditions = append(matchConditions, fmt.Sprintf(`EXISTS (
    SELECT 1 FROM scene_marker_performers %s
    JOIN performers p_tu ON p_tu.id = %s.performer_id
    WHERE %s.scene_marker_id = sm.id AND %s.role = 'top' AND %s
  )`, alias, alias, alias, alias, cond))
						matchArgs = append(matchArgs, args...)
					}

					// Process bottom unnamed performers
					for i, up := range cfg.bottomUnnamedPerformers {
						alias := fmt.Sprintf("smp_bu%d", i)
						bottomAliases = append(bottomAliases, alias)

						cond, args := buildUnnamedCondition(up, "p_bu")
						matchConditions = append(matchConditions, fmt.Sprintf(`EXISTS (
    SELECT 1 FROM scene_marker_performers %s
    JOIN performers p_bu ON p_bu.id = %s.performer_id
    WHERE %s.scene_marker_id = sm.id AND %s.role = 'bottom' AND %s
  )`, alias, alias, alias, alias, cond))
						matchArgs = append(matchArgs, args...)
					}
				}

				// Ensure distinctness: count unique unnamed performer IDs per role
				// If we have multiple unnamed performers with the same role (e.g., 2 tops),
				// we need to ensure the marker has that many distinct performers in that role
				uniqueTopUnnamedIds := make(map[string]bool)
				for _, up := range cfg.topUnnamedPerformers {
					if up.ID != nil && *up.ID != "" {
						uniqueTopUnnamedIds[*up.ID] = true
					}
				}
				uniqueBottomUnnamedIds := make(map[string]bool)
				for _, up := range cfg.bottomUnnamedPerformers {
					if up.ID != nil && *up.ID != "" {
						uniqueBottomUnnamedIds[*up.ID] = true
					}
				}
				uniqueBothRolesUnnamedIds := make(map[string]bool)
				for _, up := range cfg.bothRolesUnnamedPerformers {
					if up.ID != nil && *up.ID != "" {
						uniqueBothRolesUnnamedIds[*up.ID] = true
					}
				}

				// If we have multiple unique unnamed top performers, ensure the marker has enough distinct top performers
				if len(uniqueTopUnnamedIds) > 1 && performerModeAnd {
					matchConditions = append(matchConditions, fmt.Sprintf(`(
    SELECT COUNT(DISTINCT smp_dist.performer_id) FROM scene_marker_performers smp_dist
    WHERE smp_dist.scene_marker_id = sm.id AND smp_dist.role = 'top'
  ) >= %d`, len(uniqueTopUnnamedIds)))
				}

				// If we have multiple unique unnamed bottom performers, ensure the marker has enough distinct bottom performers
				if len(uniqueBottomUnnamedIds) > 1 && performerModeAnd {
					matchConditions = append(matchConditions, fmt.Sprintf(`(
    SELECT COUNT(DISTINCT smp_dist.performer_id) FROM scene_marker_performers smp_dist
    WHERE smp_dist.scene_marker_id = sm.id AND smp_dist.role = 'bottom'
  ) >= %d`, len(uniqueBottomUnnamedIds)))
				}

				// For both_roles unnamed performers, they can be in either role, so count total distinct performers
				if len(uniqueBothRolesUnnamedIds) > 1 && performerModeAnd {
					matchConditions = append(matchConditions, fmt.Sprintf(`(
    SELECT COUNT(DISTINCT smp_dist.performer_id) FROM scene_marker_performers smp_dist
    WHERE smp_dist.scene_marker_id = sm.id
  ) >= %d`, len(uniqueBothRolesUnnamedIds)))
				}

				// Cross-role distinctness: if we have different unnamed performer IDs in top vs bottom,
				// the actual performers must be different people.
				// E.g., Performer A as top and Performer B as bottom means top_performer_id != bottom_performer_id
				if performerModeAnd && len(uniqueTopUnnamedIds) > 0 && len(uniqueBottomUnnamedIds) > 0 {
					// Check if there are IDs that are ONLY in top (not in bottom) and vice versa
					topOnlyIds := make(map[string]bool)
					for id := range uniqueTopUnnamedIds {
						if !uniqueBottomUnnamedIds[id] {
							topOnlyIds[id] = true
						}
					}
					bottomOnlyIds := make(map[string]bool)
					for id := range uniqueBottomUnnamedIds {
						if !uniqueTopUnnamedIds[id] {
							bottomOnlyIds[id] = true
						}
					}

					// If there are exclusive IDs on both sides, performers must be different
					if len(topOnlyIds) > 0 && len(bottomOnlyIds) > 0 {
						// At minimum, require that at least one top performer != at least one bottom performer
						matchConditions = append(matchConditions, `EXISTS (
    SELECT 1 FROM scene_marker_performers smp_t
    JOIN scene_marker_performers smp_b ON smp_b.scene_marker_id = smp_t.scene_marker_id
    WHERE smp_t.scene_marker_id = sm.id 
      AND smp_t.role = 'top' 
      AND smp_b.role = 'bottom'
      AND smp_t.performer_id != smp_b.performer_id
  )`)
					}
				}

				if !hasBothRolesCriteria && !hasBothRolesUnnamedCriteria && !hasTopUnnamedCriteria && !hasBottomUnnamedCriteria && topCond != nil && bottomCond != nil {
					if performerModeAnd {
						// AND: both top and bottom must exist
						matchConditions = append(matchConditions, `EXISTS (
    SELECT 1 FROM scene_marker_performers smp
    JOIN performers p ON p.id = smp.performer_id
    WHERE smp.scene_marker_id = sm.id AND `+topCond.clause+`
  ) AND EXISTS (
    SELECT 1 FROM scene_marker_performers smp
    JOIN performers p ON p.id = smp.performer_id
    WHERE smp.scene_marker_id = sm.id AND `+bottomCond.clause+`
  )`)
						matchArgs = append(matchArgs, topCond.args...)
						matchArgs = append(matchArgs, bottomCond.args...)
					} else {
						// OR: either top or bottom
						combinedClause := fmt.Sprintf("(%s OR %s)", topCond.clause, bottomCond.clause)
						matchConditions = append(matchConditions, `EXISTS (
    SELECT 1 FROM scene_marker_performers smp
    JOIN performers p ON p.id = smp.performer_id
    WHERE smp.scene_marker_id = sm.id AND `+combinedClause+`
  )`)
						matchArgs = append(matchArgs, topCond.args...)
						matchArgs = append(matchArgs, bottomCond.args...)
					}
				} else if topCond != nil {
					matchConditions = append(matchConditions, `EXISTS (
    SELECT 1 FROM scene_marker_performers smp
    JOIN performers p ON p.id = smp.performer_id
    WHERE smp.scene_marker_id = sm.id AND `+topCond.clause+`
  )`)
					matchArgs = append(matchArgs, topCond.args...)
				} else if bottomCond != nil {
					matchConditions = append(matchConditions, `EXISTS (
    SELECT 1 FROM scene_marker_performers smp
    JOIN performers p ON p.id = smp.performer_id
    WHERE smp.scene_marker_id = sm.id AND `+bottomCond.clause+`
  )`)
					matchArgs = append(matchArgs, bottomCond.args...)
				}

				// Handle "any" count conditions (require at least N distinct performers in a role)
				// These are applied in addition to or instead of specific performer ID checks
				if cfg.topAnyCount > 0 && topCond == nil {
					// Only any count specified for tops, no specific performers
					matchConditions = append(matchConditions, fmt.Sprintf(`(
    SELECT COUNT(DISTINCT smp.performer_id) FROM scene_marker_performers smp
    WHERE smp.scene_marker_id = sm.id AND smp.role = 'top'
  ) >= %d`, cfg.topAnyCount))
				} else if cfg.topAnyCount > 0 && topCond != nil {
					// Both specific performers and any count - the any count acts as a minimum
					// Already have the specific performer condition, add the count condition
					matchConditions = append(matchConditions, fmt.Sprintf(`(
    SELECT COUNT(DISTINCT smp.performer_id) FROM scene_marker_performers smp
    WHERE smp.scene_marker_id = sm.id AND smp.role = 'top'
  ) >= %d`, cfg.topAnyCount))
				}

				if cfg.bottomAnyCount > 0 && bottomCond == nil {
					// Only any count specified for bottoms, no specific performers
					matchConditions = append(matchConditions, fmt.Sprintf(`(
    SELECT COUNT(DISTINCT smp.performer_id) FROM scene_marker_performers smp
    WHERE smp.scene_marker_id = sm.id AND smp.role = 'bottom'
  ) >= %d`, cfg.bottomAnyCount))
				} else if cfg.bottomAnyCount > 0 && bottomCond != nil {
					// Both specific performers and any count - the any count acts as a minimum
					matchConditions = append(matchConditions, fmt.Sprintf(`(
    SELECT COUNT(DISTINCT smp.performer_id) FROM scene_marker_performers smp
    WHERE smp.scene_marker_id = sm.id AND smp.role = 'bottom'
  ) >= %d`, cfg.bottomAnyCount))
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

			// Process GroupsExtendedExclude - exclude scenes with markers matching these full criteria
			if len(c.GroupsExtendedExclude) > 0 {
				// Determine AND vs OR semantics for exclude groups from ExcludeModifier
				// Default to AND mode: scene is excluded if ANY exclude group matches
				// Only use OR mode if explicitly set to INCLUDES_ALL (exclude only if ALL groups match)
				excludeAndMode := c.ExcludeModifier == nil || *c.ExcludeModifier != models.CriterionModifierIncludesAll

				var excludeGroupConditions []string
				var excludeGroupArgs []any

				for _, eg := range c.GroupsExtendedExclude {
					// Build a NOT EXISTS clause for this exclude group
					var egConditions []string
					var egArgs []any

					// Tag condition
					if len(eg.TagIDs) > 0 {
						tagPh := getInBinding(len(eg.TagIDs))
						egConditions = append(egConditions, `(
      SELECT COUNT(DISTINCT tag_id) FROM (
        SELECT sm_ex.primary_tag_id AS tag_id
        UNION ALL
        SELECT smt_ex.tag_id FROM scene_markers_tags smt_ex WHERE smt_ex.scene_marker_id = sm_ex.id
      ) tags_ex
      WHERE tag_id IN `+tagPh+`
    ) = `+fmt.Sprintf("%d", len(eg.TagIDs)))
						for _, tid := range eg.TagIDs {
							egArgs = append(egArgs, tid)
						}
					}

					// Performer conditions for exclude groups
					hasBothRolesExclude := len(eg.BothRolesPerformerIDs) > 0
					hasTopExclude := len(eg.TopPerformerIDs) > 0
					hasBottomExclude := len(eg.BottomPerformerIDs) > 0

					// Check for unnamed performers with same ID in both top and bottom (both_roles pattern)
					// This means "same performer in both roles" without specifying which performer
					topUnnamedIDs := make(map[string]models.UnnamedPerformerCriterionInput)
					for _, up := range eg.TopUnnamedPerformers {
						if up.ID != nil && *up.ID != "" {
							topUnnamedIDs[*up.ID] = up
						}
					}
					bottomUnnamedIDs := make(map[string]models.UnnamedPerformerCriterionInput)
					for _, up := range eg.BottomUnnamedPerformers {
						if up.ID != nil && *up.ID != "" {
							bottomUnnamedIDs[*up.ID] = up
						}
					}

					// Find unnamed performers that appear in BOTH top and bottom (both_roles pattern)
					var bothRolesUnnamedMatches []models.UnnamedPerformerCriterionInput
					for id, up := range topUnnamedIDs {
						if _, exists := bottomUnnamedIDs[id]; exists {
							bothRolesUnnamedMatches = append(bothRolesUnnamedMatches, up)
						}
					}

					hasBothRolesUnnamedExclude := len(bothRolesUnnamedMatches) > 0 || len(eg.BothRolesUnnamedPerformers) > 0

					if hasBothRolesExclude {
						// Both roles: performer must be in BOTH top and bottom within same marker
						brPh := getInBinding(len(eg.BothRolesPerformerIDs))
						egConditions = append(egConditions, `EXISTS (
      SELECT 1 FROM scene_marker_performers smp_ex_t
      WHERE smp_ex_t.scene_marker_id = sm_ex.id AND smp_ex_t.role = 'top' AND smp_ex_t.performer_id IN `+brPh+`
    ) AND EXISTS (
      SELECT 1 FROM scene_marker_performers smp_ex_b
      WHERE smp_ex_b.scene_marker_id = sm_ex.id AND smp_ex_b.role = 'bottom' AND smp_ex_b.performer_id IN `+brPh+`
    )`)
						for _, pid := range eg.BothRolesPerformerIDs {
							egArgs = append(egArgs, pid)
						}
						for _, pid := range eg.BothRolesPerformerIDs {
							egArgs = append(egArgs, pid)
						}
					}

					// Handle unnamed performers in both_roles pattern (same performer in top AND bottom)
					if hasBothRolesUnnamedExclude {
						// For each unnamed performer that should be in both roles,
						// find if there's a performer matching the criteria who is both top AND bottom
						allBothRolesUnnamed := append(bothRolesUnnamedMatches, eg.BothRolesUnnamedPerformers...)
						for _, up := range allBothRolesUnnamed {
							// Build performer characteristic conditions
							var perfCondParts []string
							var perfCondArgs []any
							if len(up.Ethnicities) > 0 {
								expanded := expandEthnicities(up.Ethnicities)
								ph := getInBinding(len(expanded))
								perfCondParts = append(perfCondParts, "p_ex.ethnicity IN "+ph)
								for _, e := range expanded {
									perfCondArgs = append(perfCondArgs, e)
								}
							}
							if len(up.Countries) > 0 {
								ph := getInBinding(len(up.Countries))
								perfCondParts = append(perfCondParts, "p_ex.country IN "+ph)
								for _, c := range up.Countries {
									perfCondArgs = append(perfCondArgs, c)
								}
							}
							if up.Rating != nil {
								w, wargs := getIntWhereClause("p_ex.rating", up.Rating.Modifier, up.Rating.Value, up.Rating.Value2)
								perfCondParts = append(perfCondParts, w)
								perfCondArgs = append(perfCondArgs, wargs...)
							}

							perfCondClause := "1=1"
							if len(perfCondParts) > 0 {
								perfCondClause = strings.Join(perfCondParts, " AND ")
							}

							// This checks: is there a performer matching criteria who is BOTH top and bottom in this marker?
							egConditions = append(egConditions, `EXISTS (
      SELECT 1 FROM performers p_ex
      WHERE `+perfCondClause+`
        AND EXISTS (
          SELECT 1 FROM scene_marker_performers smp_ex_t
          WHERE smp_ex_t.scene_marker_id = sm_ex.id 
            AND smp_ex_t.role = 'top' 
            AND smp_ex_t.performer_id = p_ex.id
        )
        AND EXISTS (
          SELECT 1 FROM scene_marker_performers smp_ex_b
          WHERE smp_ex_b.scene_marker_id = sm_ex.id 
            AND smp_ex_b.role = 'bottom' 
            AND smp_ex_b.performer_id = p_ex.id
        )
    )`)
							egArgs = append(egArgs, perfCondArgs...)
						}
					}

					if !hasBothRolesExclude && !hasBothRolesUnnamedExclude {
						// Separate top/bottom criteria (AND mode between top and bottom)
						if hasTopExclude {
							topPh := getInBinding(len(eg.TopPerformerIDs))
							egConditions = append(egConditions, `EXISTS (
      SELECT 1 FROM scene_marker_performers smp_ex
      WHERE smp_ex.scene_marker_id = sm_ex.id AND smp_ex.role = 'top' AND smp_ex.performer_id IN `+topPh+`
    )`)
							for _, pid := range eg.TopPerformerIDs {
								egArgs = append(egArgs, pid)
							}
						}
						if hasBottomExclude {
							bottomPh := getInBinding(len(eg.BottomPerformerIDs))
							egConditions = append(egConditions, `EXISTS (
      SELECT 1 FROM scene_marker_performers smp_ex
      WHERE smp_ex.scene_marker_id = sm_ex.id AND smp_ex.role = 'bottom' AND smp_ex.performer_id IN `+bottomPh+`
    )`)
							for _, pid := range eg.BottomPerformerIDs {
								egArgs = append(egArgs, pid)
							}
						}

						// Handle unnamed performers with different IDs in top vs bottom
						// This means "exclude if top and bottom are DIFFERENT performers"
						// First, find top-only and bottom-only unnamed IDs
						topOnlyUnnamedIds := make(map[string]models.UnnamedPerformerCriterionInput)
						for _, up := range eg.TopUnnamedPerformers {
							if up.ID != nil && *up.ID != "" {
								if _, inBottom := bottomUnnamedIDs[*up.ID]; !inBottom {
									topOnlyUnnamedIds[*up.ID] = up
								}
							}
						}
						bottomOnlyUnnamedIds := make(map[string]models.UnnamedPerformerCriterionInput)
						for _, up := range eg.BottomUnnamedPerformers {
							if up.ID != nil && *up.ID != "" {
								if _, inTop := topUnnamedIDs[*up.ID]; !inTop {
									bottomOnlyUnnamedIds[*up.ID] = up
								}
							}
						}

						// If we have exclusive IDs on both sides, add condition for DIFFERENT performers
						if len(topOnlyUnnamedIds) > 0 && len(bottomOnlyUnnamedIds) > 0 {
							// Build performer conditions for top and bottom
							// For simplicity, combine all criteria for top performers and all for bottom
							var topConds []string
							var topCondArgs []any
							for _, up := range topOnlyUnnamedIds {
								var parts []string
								if len(up.Ethnicities) > 0 {
									expanded := expandEthnicities(up.Ethnicities)
									ph := getInBinding(len(expanded))
									parts = append(parts, "p_ex_t.ethnicity IN "+ph)
									for _, e := range expanded {
										topCondArgs = append(topCondArgs, e)
									}
								}
								if len(up.Countries) > 0 {
									ph := getInBinding(len(up.Countries))
									parts = append(parts, "p_ex_t.country IN "+ph)
									for _, c := range up.Countries {
										topCondArgs = append(topCondArgs, c)
									}
								}
								if up.Rating != nil {
									w, wargs := getIntWhereClause("p_ex_t.rating", up.Rating.Modifier, up.Rating.Value, up.Rating.Value2)
									parts = append(parts, w)
									topCondArgs = append(topCondArgs, wargs...)
								}
								if len(parts) > 0 {
									topConds = append(topConds, "("+strings.Join(parts, " AND ")+")")
								}
							}

							var bottomConds []string
							var bottomCondArgs []any
							for _, up := range bottomOnlyUnnamedIds {
								var parts []string
								if len(up.Ethnicities) > 0 {
									expanded := expandEthnicities(up.Ethnicities)
									ph := getInBinding(len(expanded))
									parts = append(parts, "p_ex_b.ethnicity IN "+ph)
									for _, e := range expanded {
										bottomCondArgs = append(bottomCondArgs, e)
									}
								}
								if len(up.Countries) > 0 {
									ph := getInBinding(len(up.Countries))
									parts = append(parts, "p_ex_b.country IN "+ph)
									for _, c := range up.Countries {
										bottomCondArgs = append(bottomCondArgs, c)
									}
								}
								if up.Rating != nil {
									w, wargs := getIntWhereClause("p_ex_b.rating", up.Rating.Modifier, up.Rating.Value, up.Rating.Value2)
									parts = append(parts, w)
									bottomCondArgs = append(bottomCondArgs, wargs...)
								}
								if len(parts) > 0 {
									bottomConds = append(bottomConds, "("+strings.Join(parts, " AND ")+")")
								}
							}

							// Build the condition: exists a top and bottom who are DIFFERENT
							topCondClause := "1=1"
							if len(topConds) > 0 {
								topCondClause = strings.Join(topConds, " OR ")
							}
							bottomCondClause := "1=1"
							if len(bottomConds) > 0 {
								bottomCondClause = strings.Join(bottomConds, " OR ")
							}

							egConditions = append(egConditions, `EXISTS (
      SELECT 1 FROM scene_marker_performers smp_ex_t
      JOIN performers p_ex_t ON p_ex_t.id = smp_ex_t.performer_id
      JOIN scene_marker_performers smp_ex_b ON smp_ex_b.scene_marker_id = smp_ex_t.scene_marker_id
      JOIN performers p_ex_b ON p_ex_b.id = smp_ex_b.performer_id
      WHERE smp_ex_t.scene_marker_id = sm_ex.id
        AND smp_ex_t.role = 'top'
        AND smp_ex_b.role = 'bottom'
        AND smp_ex_t.performer_id != smp_ex_b.performer_id
        AND (`+topCondClause+`)
        AND (`+bottomCondClause+`)
    )`)
							egArgs = append(egArgs, topCondArgs...)
							egArgs = append(egArgs, bottomCondArgs...)
						}
					}

					if len(egConditions) > 0 {
						// Combine all conditions with AND - marker must match ALL criteria to be excluded
						notExistsClause := utils.StrFormat(`NOT EXISTS (
  SELECT 1 FROM scene_markers sm_ex
  WHERE sm_ex.scene_id = {primaryTable}.id
    AND `+strings.Join(egConditions, `
    AND `)+`
)`, utils.StrFormatMap{"primaryTable": h.primaryTable})
						excludeGroupConditions = append(excludeGroupConditions, notExistsClause)
						excludeGroupArgs = append(excludeGroupArgs, egArgs...)
					}
				}

				// Combine exclude groups based on modifier
				if len(excludeGroupConditions) > 0 {
					if excludeAndMode {
						// AND mode: all exclude groups must NOT exist (each NOT EXISTS must pass)
						for i, cond := range excludeGroupConditions {
							// Calculate args for this condition by counting placeholders
							numPlaceholders := strings.Count(cond, "?")
							f.addWhere(cond, excludeGroupArgs[:numPlaceholders]...)
							if i < len(excludeGroupConditions)-1 {
								excludeGroupArgs = excludeGroupArgs[numPlaceholders:]
							}
						}
					} else {
						// OR mode: at least one exclude group must NOT exist
						// This is: NOT(EXISTS(g1) AND EXISTS(g2) AND ...) = NOT EXISTS g1 OR NOT EXISTS g2
						// For OR mode, we combine with OR
						combinedExclude := "(" + strings.Join(excludeGroupConditions, " OR ") + ")"
						f.addWhere(combinedExclude, excludeGroupArgs...)
					}
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
