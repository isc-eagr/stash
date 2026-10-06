package sqlite

// CUSTOM: Custom criterion handlers for performer filters.

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/stashapp/stash/pkg/models"
)

const performerUnknownSelectionCustom = "__unknown__"

// insightPerformerIDsCriterionHandlerCustom restores the exact vato set saved
// by a Playground tier drilldown. One JSON parameter avoids SQLite's bind limit.
func insightPerformerIDsCriterionHandlerCustom(ids []string) criterionHandlerFunc {
	return func(_ context.Context, f *filterBuilder) {
		if ids == nil {
			return
		}
		encoded, _ := json.Marshal(ids)
		f.addWhere("performers.id IN (SELECT CAST(value AS INTEGER) FROM json_each(?))", string(encoded))
	}
}

func expandPerformerEthnicitySelectionsCustom(value string) []string {
	var ret []string
	seen := make(map[string]struct{})

	appendValue := func(value string) {
		if _, found := seen[value]; found {
			return
		}
		seen[value] = struct{}{}
		ret = append(ret, value)
	}

	for _, value := range strings.Split(value, ",") {
		value = strings.TrimSpace(value)
		if value == "" || value == performerUnknownSelectionCustom {
			continue
		}

		appendValue(value)
		if strings.EqualFold(value, "Black") {
			appendValue("Mixed")
			appendValue("Afrolatino")
		}
		if strings.EqualFold(value, "White") {
			appendValue("Mixed")
		}
		if strings.EqualFold(value, "Latino") {
			appendValue("Afrolatino")
		}
	}

	return ret
}

func expandPerformerCountrySelectionsCustom(value string) []string {
	var ret []string
	seen := make(map[string]struct{})
	for _, value := range strings.Split(value, ",") {
		value = strings.TrimSpace(value)
		if value == "" || value == performerUnknownSelectionCustom {
			continue
		}
		if _, found := seen[value]; found {
			continue
		}
		seen[value] = struct{}{}
		ret = append(ret, value)
	}
	return ret
}

func hasPerformerUnknownSelectionCustom(value string) bool {
	for _, value := range strings.Split(value, ",") {
		if strings.TrimSpace(value) == performerUnknownSelectionCustom {
			return true
		}
	}
	return false
}

func addPerformerSelectionClauseCustom(
	f *filterBuilder,
	column string,
	values []string,
	includeUnknown bool,
	modifier models.CriterionModifier,
) {
	if len(values) == 0 && !includeUnknown {
		return
	}

	unknownClause := "(" + column + " IS NULL OR TRIM(" + column + ") = '')"
	operator := " IN "
	negate := modifier == models.CriterionModifierNotEquals || modifier == models.CriterionModifierExcludes
	if negate {
		operator = " NOT IN "
	}

	if !includeUnknown {
		args := make([]interface{}, len(values))
		for i, value := range values {
			args[i] = value
		}
		f.addWhere(column+operator+getInBinding(len(values)), args...)
		return
	}

	var clause string
	args := make([]interface{}, len(values))
	for i, value := range values {
		args[i] = value
	}
	if len(values) == 0 {
		clause = unknownClause
	} else {
		clause = "(" + unknownClause + " OR " + column + " IN " + getInBinding(len(values)) + ")"
	}
	if negate {
		clause = "NOT " + clause
	}
	f.addWhere(clause, args...)
}

// performerEthnicityCriterionHandlerCustom handles the comma-separated values
// emitted by the database-backed ethnicity selector on the performer list.
func performerEthnicityCriterionHandlerCustom(criterion *models.StringCriterionInput, column string) criterionHandlerFunc {
	if criterion == nil {
		return func(context.Context, *filterBuilder) {}
	}

	switch criterion.Modifier {
	case models.CriterionModifierEquals,
		models.CriterionModifierNotEquals,
		models.CriterionModifierIncludes,
		models.CriterionModifierExcludes:
		// handled below
	default:
		return stringCriterionHandler(criterion, column)
	}

	return func(_ context.Context, f *filterBuilder) {
		values := expandPerformerEthnicitySelectionsCustom(criterion.Value)
		addPerformerSelectionClauseCustom(
			f,
			column,
			values,
			hasPerformerUnknownSelectionCustom(criterion.Value),
			criterion.Modifier,
		)
	}
}

// performerCountryCriterionHandlerCustom accepts comma-separated country values
// emitted by Vato Tiers drilldowns, including the explicit Unknown selection.
func performerCountryCriterionHandlerCustom(criterion *models.StringCriterionInput, column string) criterionHandlerFunc {
	if criterion == nil {
		return func(context.Context, *filterBuilder) {}
	}

	switch criterion.Modifier {
	case models.CriterionModifierEquals,
		models.CriterionModifierNotEquals,
		models.CriterionModifierIncludes,
		models.CriterionModifierExcludes:
		// handled below
	default:
		return stringCriterionHandler(criterion, column)
	}

	return func(_ context.Context, f *filterBuilder) {
		addPerformerSelectionClauseCustom(
			f,
			column,
			expandPerformerCountrySelectionsCustom(criterion.Value),
			hasPerformerUnknownSelectionCustom(criterion.Value),
			criterion.Modifier,
		)
	}
}

func (qb *performerFilterHandler) profileImageCountCriterionHandler(count *models.IntCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if count == nil {
			return
		}

		lhs := "(" +
			"(CASE WHEN performers.image_blob IS NULL THEN 0 ELSE 1 END)" +
			" + " +
			"(SELECT COUNT(*) FROM performer_images pi WHERE pi.performer_id = performers.id)" +
			")"

		clause, args := getIntCriterionWhereClause(lhs, *count)
		f.addWhere(clause, args...)
	}
}

// Filters performers by whether they have any scene marker where they are top/bottom
func (qb *performerFilterHandler) hasMarkersCriterionHandler(hasMarkers *string) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if hasMarkers == nil || *hasMarkers == "" {
			return
		}

		const existsClause = "EXISTS (SELECT 1 FROM scene_marker_performers smp WHERE smp.performer_id = performers.id AND smp.role IN ('top','bottom'))"
		if *hasMarkers == "true" {
			f.addWhere(existsClause)
		} else {
			f.addWhere("NOT " + existsClause)
		}
	}
}

// customFiltersCriterionHandler applies predefined complex filters for performers.
// Options:
// - 'strict_tops': Performers with zero sexTagId/oralTagId/facialTagId markers as bottom, but at least one sexTagId as top
// - 'lenient_tops': Performers with at least one sexTagId as top, zero sexTagId as bottom, and at least one oralTagId or facialTagId as bottom
// - 'strict_bottoms': Performers with zero sexTagId/oralTagId/facialTagId markers as top, but at least one sexTagId as bottom
// - 'lenient_bottoms': Performers with at least one sexTagId as bottom, zero sexTagId as top, and at least one oralTagId or facialTagId as top
// Note: All tag checks include both primary_tag_id and secondary tags (scene_markers_tags)
// partnersCriterionHandler filters performers by partner counts across role/category combinations.
// Each non-nil metric generates an independent WHERE clause using a COALESCE subquery.
func (qb *performerFilterHandler) partnersCriterionHandler(partners *models.PerformerPartnersFilterInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if partners == nil {
			return
		}

		tags := GetRoleTagIDs()

		// applyRowMetrics applies a group of metrics using a row-level operator (AND/OR).
		// Each metric generates a WHERE clause string. For AND (default), each clause is added
		// individually via f.addWhere. For OR, all clauses are joined with OR in a single group.
		applyRowMetrics := func(operator *string, clauses ...func() (string, []interface{})) {
			useOR := operator != nil && *operator == "OR"
			type clauseResult struct {
				sql  string
				args []interface{}
			}
			var results []clauseResult
			for _, fn := range clauses {
				sql, args := fn()
				if sql != "" {
					results = append(results, clauseResult{sql, args})
				}
			}
			if len(results) == 0 {
				return
			}
			if !useOR || len(results) == 1 {
				for _, r := range results {
					f.addWhere(r.sql, r.args...)
				}
				return
			}
			// OR: combine all clauses into a single (A OR B OR C) group
			parts := make([]string, len(results))
			var allArgs []interface{}
			for i, r := range results {
				parts[i] = "(" + r.sql + ")"
				allArgs = append(allArgs, r.args...)
			}
			f.addWhere("("+strings.Join(parts, " OR ")+")", allArgs...)
		}

		// makeRoleClause returns (sql, args) for a role-based partner count metric.
		makeRoleClause := func(tagID int, role string, criterion *models.IntCriterionInput) (string, []interface{}) {
			if criterion == nil || tagID == 0 {
				return "", nil
			}
			oppositeRole := "bottom"
			if role == "bottom" {
				oppositeRole = "top"
			}
			lhs := fmt.Sprintf(`COALESCE((
				SELECT COUNT(DISTINCT smp2.performer_id)
				FROM scene_marker_performers smp1
				JOIN scene_markers sm ON smp1.scene_marker_id = sm.id
				JOIN scene_marker_performers smp2 ON smp2.scene_marker_id = smp1.scene_marker_id
				WHERE smp1.performer_id = performers.id
				AND smp1.role = '%s'
				AND smp2.role = '%s'
				AND smp2.performer_id != performers.id
				AND %s
			), 0)`, role, oppositeRole, tagHierarchyCondition("sm", tagID))
			return getIntCriterionWhereClause(lhs, *criterion)
		}

		// makeUniqueClause returns (sql, args) for a unique-partner count metric.
		makeUniqueClause := func(tagID int, criterion *models.IntCriterionInput) (string, []interface{}) {
			if criterion == nil || tagID == 0 {
				return "", nil
			}
			lhs := fmt.Sprintf(`COALESCE((
				SELECT COUNT(DISTINCT smp2.performer_id)
				FROM scene_marker_performers smp1
				JOIN scene_markers sm ON smp1.scene_marker_id = sm.id
				JOIN scene_marker_performers smp2 ON smp2.scene_marker_id = smp1.scene_marker_id
				WHERE smp1.performer_id = performers.id
				AND smp2.performer_id != performers.id
				AND ((smp1.role = 'top' AND smp2.role = 'bottom') OR (smp1.role = 'bottom' AND smp2.role = 'top'))
				AND %s
			), 0)`, tagHierarchyCondition("sm", tagID))
			return getIntCriterionWhereClause(lhs, *criterion)
		}

		// Topped row
		applyRowMetrics(
			partners.ToppedOperator,
			func() (string, []interface{}) { return makeRoleClause(tags.SexTagID, "top", partners.SexTopped) },
			func() (string, []interface{}) { return makeRoleClause(tags.OralTagID, "top", partners.OralTopped) },
			func() (string, []interface{}) { return makeRoleClause(tags.FacialTagID, "top", partners.FacialTopped) },
		)

		// Bottomed row
		applyRowMetrics(
			partners.BottomedOperator,
			func() (string, []interface{}) { return makeRoleClause(tags.SexTagID, "bottom", partners.SexBottomed) },
			func() (string, []interface{}) { return makeRoleClause(tags.OralTagID, "bottom", partners.OralBottomed) },
			func() (string, []interface{}) {
				return makeRoleClause(tags.FacialTagID, "bottom", partners.FacialBottomed)
			},
		)

		// Unique row
		applyRowMetrics(
			partners.UniqueOperator,
			func() (string, []interface{}) { return makeUniqueClause(tags.SexTagID, partners.SexUnique) },
			func() (string, []interface{}) { return makeUniqueClause(tags.OralTagID, partners.OralUnique) },
			func() (string, []interface{}) { return makeUniqueClause(tags.FacialTagID, partners.FacialUnique) },
		)
	}
}

// sceneTypeCriterionHandler filters performers by scene type based on marker-level participation.
// For each selected type, the performer must have at least one scene_marker_performers entry
// on a marker in a scene that qualifies as that type.
// Scene type definitions:
// - 'sex': Scene has at least one marker matching sexTagId
// - 'oral': Scene has at least one oral marker and zero sex markers
// - 'solo': Scene has at least one solo marker and zero sex/oral markers
// - 'facial': Scene has at least one facial marker
// Multiple types are ANDed: performer must participate in at least one qualifying scene for EACH type.
func (qb *performerFilterHandler) sceneTypeCriterionHandler(sceneType *models.SceneTypeFilterInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if sceneType == nil || len(sceneType.Types) == 0 {
			return
		}

		// Extract tag IDs
		sexTagID := ""
		oralTagID := ""
		soloTagID := ""
		facialTagID := ""
		if sceneType.SexTagID != nil {
			sexTagID = *sceneType.SexTagID
		}
		if sceneType.OralTagID != nil {
			oralTagID = *sceneType.OralTagID
		}
		if sceneType.SoloTagID != nil {
			soloTagID = *sceneType.SoloTagID
		}
		if sceneType.FacialTagID != nil {
			facialTagID = *sceneType.FacialTagID
		}

		var conditions []string

		for _, t := range sceneType.Types {
			switch t {
			case "sex":
				if sexTagID == "" {
					continue
				}
				// Performer has a marker in a scene that has a sex marker
				conditions = append(conditions, fmt.Sprintf(`EXISTS (
					WITH RECURSIVE pst_sex_tags(id) AS (
						SELECT id FROM tags WHERE id = %s
						UNION ALL
						SELECT tr.child_id FROM tags_relations tr JOIN pst_sex_tags tf ON tr.parent_id = tf.id
					)
					SELECT 1 FROM scene_marker_performers smp_st
					JOIN scene_markers sm_inner ON sm_inner.id = smp_st.scene_marker_id
					WHERE smp_st.performer_id = performers.id
					  AND EXISTS (
						SELECT 1 FROM scene_markers sm_check
						WHERE sm_check.scene_id = sm_inner.scene_id
						  AND (sm_check.primary_tag_id IN (SELECT id FROM pst_sex_tags)
						       OR EXISTS (SELECT 1 FROM scene_markers_tags smt_check WHERE smt_check.scene_marker_id = sm_check.id AND smt_check.tag_id IN (SELECT id FROM pst_sex_tags)))
					  )
				)`, sexTagID))

			case "oral":
				if oralTagID == "" {
					continue
				}
				// Build the scene-qualifies condition: has oral, no sex
				var sexExclusionCTE, sexExclusionCheck string
				if sexTagID != "" {
					sexExclusionCTE = fmt.Sprintf(`, pst_sex_excl_oral(id) AS (
						SELECT id FROM tags WHERE id = %s
						UNION ALL
						SELECT tr.child_id FROM tags_relations tr JOIN pst_sex_excl_oral tf ON tr.parent_id = tf.id
					)`, sexTagID)
					sexExclusionCheck = ` AND NOT EXISTS (
						SELECT 1 FROM scene_markers sm_excl2
						WHERE sm_excl2.scene_id = sm_inner.scene_id
						  AND (sm_excl2.primary_tag_id IN (SELECT id FROM pst_sex_excl_oral)
						       OR EXISTS (SELECT 1 FROM scene_markers_tags smt_excl2 WHERE smt_excl2.scene_marker_id = sm_excl2.id AND smt_excl2.tag_id IN (SELECT id FROM pst_sex_excl_oral)))
					)`
				}
				conditions = append(conditions, fmt.Sprintf(`EXISTS (
					WITH RECURSIVE pst_oral_tags(id) AS (
						SELECT id FROM tags WHERE id = %s
						UNION ALL
						SELECT tr.child_id FROM tags_relations tr JOIN pst_oral_tags tf ON tr.parent_id = tf.id
					)%s
					SELECT 1 FROM scene_marker_performers smp_st
					JOIN scene_markers sm_inner ON sm_inner.id = smp_st.scene_marker_id
					WHERE smp_st.performer_id = performers.id
					  AND EXISTS (
						SELECT 1 FROM scene_markers sm_check
						WHERE sm_check.scene_id = sm_inner.scene_id
						  AND (sm_check.primary_tag_id IN (SELECT id FROM pst_oral_tags)
						       OR EXISTS (SELECT 1 FROM scene_markers_tags smt_check WHERE smt_check.scene_marker_id = sm_check.id AND smt_check.tag_id IN (SELECT id FROM pst_oral_tags)))
					  )%s
				)`, oralTagID, sexExclusionCTE, sexExclusionCheck))

			case "solo":
				if soloTagID == "" {
					continue
				}
				// Build exclusion CTEs and conditions
				var exclusionCTEs, exclusions string
				if sexTagID != "" {
					exclusionCTEs += fmt.Sprintf(`, pst_sex_excl_solo(id) AS (
						SELECT id FROM tags WHERE id = %s
						UNION ALL
						SELECT tr.child_id FROM tags_relations tr JOIN pst_sex_excl_solo tf ON tr.parent_id = tf.id
					)`, sexTagID)
					exclusions += ` AND NOT EXISTS (
						SELECT 1 FROM scene_markers sm_excl3
						WHERE sm_excl3.scene_id = sm_inner.scene_id
						  AND (sm_excl3.primary_tag_id IN (SELECT id FROM pst_sex_excl_solo)
						       OR EXISTS (SELECT 1 FROM scene_markers_tags smt_excl3 WHERE smt_excl3.scene_marker_id = sm_excl3.id AND smt_excl3.tag_id IN (SELECT id FROM pst_sex_excl_solo)))
					)`
				}
				if oralTagID != "" {
					exclusionCTEs += fmt.Sprintf(`, pst_oral_excl_solo(id) AS (
						SELECT id FROM tags WHERE id = %s
						UNION ALL
						SELECT tr.child_id FROM tags_relations tr JOIN pst_oral_excl_solo tf ON tr.parent_id = tf.id
					)`, oralTagID)
					exclusions += ` AND NOT EXISTS (
						SELECT 1 FROM scene_markers sm_excl4
						WHERE sm_excl4.scene_id = sm_inner.scene_id
						  AND (sm_excl4.primary_tag_id IN (SELECT id FROM pst_oral_excl_solo)
						       OR EXISTS (SELECT 1 FROM scene_markers_tags smt_excl4 WHERE smt_excl4.scene_marker_id = sm_excl4.id AND smt_excl4.tag_id IN (SELECT id FROM pst_oral_excl_solo)))
					)`
				}
				conditions = append(conditions, fmt.Sprintf(`EXISTS (
					WITH RECURSIVE pst_solo_tags(id) AS (
						SELECT id FROM tags WHERE id = %s
						UNION ALL
						SELECT tr.child_id FROM tags_relations tr JOIN pst_solo_tags tf ON tr.parent_id = tf.id
					)%s
					SELECT 1 FROM scene_marker_performers smp_st
					JOIN scene_markers sm_inner ON sm_inner.id = smp_st.scene_marker_id
					WHERE smp_st.performer_id = performers.id
					  AND EXISTS (
						SELECT 1 FROM scene_markers sm_check
						WHERE sm_check.scene_id = sm_inner.scene_id
						  AND (sm_check.primary_tag_id IN (SELECT id FROM pst_solo_tags)
						       OR EXISTS (SELECT 1 FROM scene_markers_tags smt_check WHERE smt_check.scene_marker_id = sm_check.id AND smt_check.tag_id IN (SELECT id FROM pst_solo_tags)))
					  )%s
				)`, soloTagID, exclusionCTEs, exclusions))

			case "facial":
				if facialTagID == "" {
					continue
				}
				conditions = append(conditions, fmt.Sprintf(`EXISTS (
					WITH RECURSIVE pst_facial_tags(id) AS (
						SELECT id FROM tags WHERE id = %s
						UNION ALL
						SELECT tr.child_id FROM tags_relations tr JOIN pst_facial_tags tf ON tr.parent_id = tf.id
					)
					SELECT 1 FROM scene_marker_performers smp_st
					JOIN scene_markers sm_inner ON sm_inner.id = smp_st.scene_marker_id
					WHERE smp_st.performer_id = performers.id
					  AND EXISTS (
						SELECT 1 FROM scene_markers sm_check
						WHERE sm_check.scene_id = sm_inner.scene_id
						  AND (sm_check.primary_tag_id IN (SELECT id FROM pst_facial_tags)
						       OR EXISTS (SELECT 1 FROM scene_markers_tags smt_check WHERE smt_check.scene_marker_id = sm_check.id AND smt_check.tag_id IN (SELECT id FROM pst_facial_tags)))
					  )
				)`, facialTagID))
			}
		}

		if len(conditions) == 0 {
			return
		}

		// Join all conditions with AND
		f.addWhere(strings.Join(conditions, " AND "))
	}
}

// performerMarkersCriterionHandler filters performers by their scene marker participation
// with support for include/exclude conditions, roles, and partner attributes.
func (qb *performerFilterHandler) performerMarkersCriterionHandler(input *models.PerformerMarkersCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if input == nil || (len(input.Include) == 0 && len(input.Exclude) == 0) {
			return
		}

		// Helper to expand ethnicity selections
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

		// Build a condition that checks if a performer has a marker matching the given criteria
		// Returns sql, args, and an error (for hierarchical tag expansion)
		buildConditionSQL := func(cond models.PerformerMarkerConditionInput, exists bool) (string, []interface{}, error) {
			var clauses []string
			var args []interface{}

			// Marker must have at least one of the specified tags (check both primary_tag_id and scene_markers_tags)
			// Support hierarchical depth for sub-tag matching
			if len(cond.TagIDs) > 0 {
				// Check if we need hierarchical expansion
				depthVal := 0
				if cond.Depth != nil {
					depthVal = *cond.Depth
				}

				if depthVal == 0 {
					// Simple case: exact tag match only
					ph := getInBinding(len(cond.TagIDs))
					clauses = append(clauses, sceneMarkerDirectHasTagInClauseCustom("sm", ph))
					for _, tid := range cond.TagIDs {
						args = append(args, tid)
					}
				} else {
					// Hierarchical case: expand tags to include sub-tags
					valuesClause, err := getHierarchicalValues(ctx, cond.TagIDs, tagTable, "tags_relations", "parent_id", "child_id", cond.Depth)
					if err != nil {
						return "", nil, err
					}

					// Use the expanded tag values (column2 contains the actual tag id to match)
					clauses = append(clauses, sceneMarkerDirectHasTagInClauseCustom("sm", fmt.Sprintf("(SELECT column2 FROM (%s))", valuesClause)))
				}
			}

			// Determine role for this performer
			role := "any"
			if cond.Role != nil && *cond.Role != "" {
				role = strings.ToLower(*cond.Role)
			}

			// Build the performer role condition
			// smp = scene_marker_performers for this performer
			if role == "top" {
				clauses = append(clauses, "smp.role = 'top'")
			} else if role == "bottom" {
				clauses = append(clauses, "smp.role = 'bottom'")
			}
			// "any" role means no role constraint

			// Self attributes - filter by the performer's own attributes
			if len(cond.SelfEthnicities) > 0 {
				expanded := expandEthnicities(cond.SelfEthnicities)
				ph := getInBinding(len(expanded))
				clauses = append(clauses, fmt.Sprintf("performers.ethnicity IN %s", ph))
				for _, e := range expanded {
					args = append(args, e)
				}
			}

			if len(cond.SelfCountries) > 0 {
				ph := getInBinding(len(cond.SelfCountries))
				clauses = append(clauses, fmt.Sprintf("performers.country IN %s", ph))
				for _, c := range cond.SelfCountries {
					args = append(args, c)
				}
			}

			if cond.SelfRating != nil {
				w, wargs := getIntWhereClause("performers.rating", cond.SelfRating.Modifier, cond.SelfRating.Value, cond.SelfRating.Value2)
				clauses = append(clauses, w)
				args = append(args, wargs...)
			}

			// Determine partner role constraint
			partnerRole := "any"
			if cond.PartnerRole != nil && *cond.PartnerRole != "" {
				partnerRole = strings.ToLower(*cond.PartnerRole)
			}

			// Partner attributes - check the OTHER performer on this marker
			hasPartnerCondition := len(cond.PartnerPerformerIDs) > 0 || len(cond.PartnerEthnicities) > 0 || len(cond.PartnerCountries) > 0 || cond.PartnerRating != nil || partnerRole != "any"
			if hasPartnerCondition {
				var partnerClauses []string

				// Filter by specific partner performer IDs
				if len(cond.PartnerPerformerIDs) > 0 {
					ph := getInBinding(len(cond.PartnerPerformerIDs))
					partnerClauses = append(partnerClauses, fmt.Sprintf("partner.id IN %s", ph))
					for _, pid := range cond.PartnerPerformerIDs {
						args = append(args, pid)
					}
				}

				// Partner role clause
				if partnerRole == "top" {
					partnerClauses = append(partnerClauses, "smp_partner.role = 'top'")
				} else if partnerRole == "bottom" {
					partnerClauses = append(partnerClauses, "smp_partner.role = 'bottom'")
				}

				if len(cond.PartnerEthnicities) > 0 {
					expanded := expandEthnicities(cond.PartnerEthnicities)
					ph := getInBinding(len(expanded))
					partnerClauses = append(partnerClauses, fmt.Sprintf("partner.ethnicity IN %s", ph))
					for _, e := range expanded {
						args = append(args, e)
					}
				}

				if len(cond.PartnerCountries) > 0 {
					ph := getInBinding(len(cond.PartnerCountries))
					partnerClauses = append(partnerClauses, fmt.Sprintf("partner.country IN %s", ph))
					for _, c := range cond.PartnerCountries {
						args = append(args, c)
					}
				}

				if cond.PartnerRating != nil {
					w, wargs := getIntWhereClause("partner.rating", cond.PartnerRating.Modifier, cond.PartnerRating.Value, cond.PartnerRating.Value2)
					partnerClauses = append(partnerClauses, w)
					args = append(args, wargs...)
				}

				// Partner exists on same marker with different performer_id
				partnerExistsClause := fmt.Sprintf(`EXISTS (
					SELECT 1 FROM scene_marker_performers smp_partner
					JOIN performers partner ON partner.id = smp_partner.performer_id
					WHERE smp_partner.scene_marker_id = sm.id
					AND smp_partner.performer_id != performers.id
					AND %s
				)`, strings.Join(partnerClauses, " AND "))
				clauses = append(clauses, partnerExistsClause)
			}

			whereClause := ""
			if len(clauses) > 0 {
				whereClause = " AND " + strings.Join(clauses, " AND ")
			}

			var sql string
			if exists {
				sql = fmt.Sprintf(`EXISTS (
					SELECT 1 FROM scene_marker_performers smp
					JOIN scene_markers sm ON sm.id = smp.scene_marker_id
					WHERE smp.performer_id = performers.id%s
				)`, whereClause)
			} else {
				sql = fmt.Sprintf(`NOT EXISTS (
					SELECT 1 FROM scene_marker_performers smp
					JOIN scene_markers sm ON sm.id = smp.scene_marker_id
					WHERE smp.performer_id = performers.id%s
				)`, whereClause)
			}

			return sql, args, nil
		}

		// Process include conditions - all must match
		for _, cond := range input.Include {
			sql, args, err := buildConditionSQL(cond, true)
			if err != nil {
				f.setError(err)
				return
			}
			f.addWhere(sql, args...)
		}

		// Process exclude conditions - none should match
		for _, cond := range input.Exclude {
			sql, args, err := buildConditionSQL(cond, false)
			if err != nil {
				f.setError(err)
				return
			}
			f.addWhere(sql, args...)
		}
	}
}
