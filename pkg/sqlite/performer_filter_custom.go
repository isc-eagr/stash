package sqlite

// CUSTOM: Custom criterion handlers for performer filters.

import (
	"context"
	"fmt"
	"strings"

	"github.com/stashapp/stash/pkg/models"
)

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
// The any_non_sex_bottomed/topped fields handle the OR case for lenient stat links.
func (qb *performerFilterHandler) partnersCriterionHandler(partners *models.PerformerPartnersFilterInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if partners == nil {
			return
		}

		tags := GetRoleTagIDs()

		// addNonSexRoleMetric counts distinct partners across BOTH oral and facial tags combined
		// (OR logic — used for lenient top/bottom stat links via any_non_sex_bottomed/topped).
		addNonSexRoleMetric := func(role string, criterion *models.IntCriterionInput) {
			if criterion == nil {
				return
			}
			oppositeRole := "bottom"
			if role == "bottom" {
				oppositeRole = "top"
			}
			var tagConditions []string
			if tags.OralTagID != 0 {
				tagConditions = append(tagConditions, tagHierarchyCondition("sm", tags.OralTagID))
			}
			if tags.FacialTagID != 0 {
				tagConditions = append(tagConditions, tagHierarchyCondition("sm", tags.FacialTagID))
			}
			if len(tagConditions) == 0 {
				return
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
				AND (%s)
			), 0)`, role, oppositeRole, strings.Join(tagConditions, " OR "))
			clause, args := getIntCriterionWhereClause(lhs, *criterion)
			f.addWhere(clause, args...)
		}

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
			func() (string, []interface{}) { return makeRoleClause(tags.FacialTagID, "bottom", partners.FacialBottomed) },
		)

		// Unique row
		applyRowMetrics(
			partners.UniqueOperator,
			func() (string, []interface{}) { return makeUniqueClause(tags.SexTagID, partners.SexUnique) },
			func() (string, []interface{}) { return makeUniqueClause(tags.OralTagID, partners.OralUnique) },
			func() (string, []interface{}) { return makeUniqueClause(tags.FacialTagID, partners.FacialUnique) },
		)

		// Backend-only OR-combined fields (not exposed in UI, used by CustomStats)
		addNonSexRoleMetric("bottom", partners.AnyNonSexBottomed)
		addNonSexRoleMetric("top", partners.AnyNonSexTopped)
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

// Filters performers by scene marker tags.
// This matches performers that have at least one scene marker with all the selected tags.
func (qb *performerFilterHandler) markerTagsCriterionHandler(tags *models.HierarchicalMultiCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if tags == nil {
			return
		}

		criterion := *tags

		// Handle null/not-null modifiers
		if criterion.Modifier == models.CriterionModifierIsNull || criterion.Modifier == models.CriterionModifierNotNull {
			var notClause string
			if criterion.Modifier == models.CriterionModifierNotNull {
				notClause = "NOT"
			}
			// Check if performer has any scene markers with tags
			f.addWhere(fmt.Sprintf(`%s EXISTS (
				SELECT 1 FROM performers_scenes ps
				JOIN scenes s ON s.id = ps.scene_id
				JOIN scene_markers sm ON sm.scene_id = s.id
				JOIN scene_markers_tags smt ON smt.scene_marker_id = sm.id
				WHERE ps.performer_id = performers.id
			)`, notClause))
			return
		}

		// Combine excludes if excludes modifier is selected
		if criterion.Modifier == models.CriterionModifierExcludes {
			criterion.Modifier = models.CriterionModifierIncludesAll
			criterion.Excludes = append(criterion.Excludes, criterion.Value...)
			criterion.Value = nil
		}

		if len(criterion.Value) == 0 && len(criterion.Excludes) == 0 {
			return
		}

		// Get hierarchical tag values
		if len(criterion.Value) > 0 {
			valuesClause, err := getHierarchicalValues(ctx, criterion.Value, tagTable, "tags_relations", "parent_id", "child_id", criterion.Depth)
			if err != nil {
				f.setError(err)
				return
			}

			switch criterion.Modifier {
			case models.CriterionModifierIncludes:
				// At least one marker with any of the tags
				f.addWhere(fmt.Sprintf(`EXISTS (
					SELECT 1 FROM performers_scenes ps
					JOIN scenes s ON s.id = ps.scene_id
					JOIN scene_markers sm ON sm.scene_id = s.id
					JOIN scene_markers_tags smt ON smt.scene_marker_id = sm.id
					WHERE ps.performer_id = performers.id
					AND smt.tag_id IN (SELECT column2 FROM (%s))
				)`, valuesClause))

			case models.CriterionModifierIncludesAll:
				// At least one marker with all the tags
				f.addWhere(fmt.Sprintf(`EXISTS (
					SELECT 1 FROM performers_scenes ps
					JOIN scenes s ON s.id = ps.scene_id
					JOIN scene_markers sm ON sm.scene_id = s.id
					WHERE ps.performer_id = performers.id
					AND (
						SELECT COUNT(DISTINCT smt.tag_id)
						FROM scene_markers_tags smt
						WHERE smt.scene_marker_id = sm.id
						AND smt.tag_id IN (SELECT column2 FROM (%s))
					) = %d
				)`, valuesClause, len(criterion.Value)))

			case models.CriterionModifierEquals:
				// At least one marker with exactly the specified tags
				f.addWhere(fmt.Sprintf(`EXISTS (
					SELECT 1 FROM performers_scenes ps
					JOIN scenes s ON s.id = ps.scene_id
					JOIN scene_markers sm ON sm.scene_id = s.id
					WHERE ps.performer_id = performers.id
					AND (
						SELECT COUNT(DISTINCT smt.tag_id)
						FROM scene_markers_tags smt
						WHERE smt.scene_marker_id = sm.id
						AND smt.tag_id IN (SELECT column2 FROM (%s))
					) = %d
					AND (
						SELECT COUNT(*)
						FROM scene_markers_tags smt2
						WHERE smt2.scene_marker_id = sm.id
					) = %d
				)`, valuesClause, len(criterion.Value), len(criterion.Value)))
			}
		}

		// Handle excludes
		if len(criterion.Excludes) > 0 {
			valuesClause, err := getHierarchicalValues(ctx, criterion.Excludes, tagTable, "tags_relations", "parent_id", "child_id", criterion.Depth)
			if err != nil {
				f.setError(err)
				return
			}

			// Exclude performers that have any marker with any of the excluded tags
			f.addWhere(fmt.Sprintf(`NOT EXISTS (
				SELECT 1 FROM performers_scenes ps
				JOIN scenes s ON s.id = ps.scene_id
				JOIN scene_markers sm ON sm.scene_id = s.id
				JOIN scene_markers_tags smt ON smt.scene_marker_id = sm.id
				WHERE ps.performer_id = performers.id
				AND smt.tag_id IN (SELECT column2 FROM (%s))
			)`, valuesClause))
		}
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
					tagClause := fmt.Sprintf(`(
						sm.primary_tag_id IN %s
						OR EXISTS (
							SELECT 1 FROM scene_markers_tags smt 
							WHERE smt.scene_marker_id = sm.id 
							AND smt.tag_id IN %s
						)
					)`, ph, ph)
					clauses = append(clauses, tagClause)
					// Add tag IDs twice (once for primary_tag_id, once for scene_markers_tags)
					for _, tid := range cond.TagIDs {
						args = append(args, tid)
					}
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
					tagClause := fmt.Sprintf(`(
						sm.primary_tag_id IN (SELECT column2 FROM (%s))
						OR EXISTS (
							SELECT 1 FROM scene_markers_tags smt 
							WHERE smt.scene_marker_id = sm.id 
							AND smt.tag_id IN (SELECT column2 FROM (%s))
						)
					)`, valuesClause, valuesClause)
					clauses = append(clauses, tagClause)
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

// performerMarkerTagsCriterionHandler filters performers by their participation in markers with specific tags
func (qb *performerFilterHandler) performerMarkerTagsCriterionHandler(input *models.PerformerMarkerTagsCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if input == nil || len(input.TagIds) == 0 {
			return
		}

		// Determine role for this performer
		role := "any"
		if input.Role != nil && *input.Role != "" {
			role = strings.ToLower(*input.Role)
		}

		var roleClause string
		if role == "top" {
			roleClause = "AND smp.role = 'top'"
		} else if role == "bottom" {
			roleClause = "AND smp.role = 'bottom'"
		}
		// "any" role means no role constraint

		ph := getInBinding(len(input.TagIds))

		var sql string
		args := make([]interface{}, 0, len(input.TagIds)*2)

		switch input.Modifier {
		case models.CriterionModifierIncludes, models.CriterionModifierIncludesAll:
			// Performer must be in markers that have ALL specified tags
			sql = fmt.Sprintf(`EXISTS (
				SELECT 1 FROM scene_marker_performers smp
				JOIN scene_markers sm ON sm.id = smp.scene_marker_id
				WHERE smp.performer_id = performers.id %s
				AND (
					sm.primary_tag_id IN %s
					OR EXISTS (
						SELECT 1 FROM scene_markers_tags smt 
						WHERE smt.scene_marker_id = sm.id 
						AND smt.tag_id IN %s
					)
				)
			)`, roleClause, ph, ph)

			// Add tag IDs twice
			for _, tid := range input.TagIds {
				args = append(args, tid)
			}
			for _, tid := range input.TagIds {
				args = append(args, tid)
			}

		case models.CriterionModifierExcludes:
			// Performer must NOT be in any markers with these tags
			sql = fmt.Sprintf(`NOT EXISTS (
				SELECT 1 FROM scene_marker_performers smp
				JOIN scene_markers sm ON sm.id = smp.scene_marker_id
				WHERE smp.performer_id = performers.id %s
				AND (
					sm.primary_tag_id IN %s
					OR EXISTS (
						SELECT 1 FROM scene_markers_tags smt 
						WHERE smt.scene_marker_id = sm.id 
						AND smt.tag_id IN %s
					)
				)
			)`, roleClause, ph, ph)

			for _, tid := range input.TagIds {
				args = append(args, tid)
			}
			for _, tid := range input.TagIds {
				args = append(args, tid)
			}
		}

		if sql != "" {
			f.addWhere(sql, args...)
		}
	}
}

// performerMarkerPartnersCriterionHandler filters performers by attributes of their marker partners
func (qb *performerFilterHandler) performerMarkerPartnersCriterionHandler(input *models.PerformerMarkerPartnersCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if input == nil {
			return
		}

		// Check if we have any actual filter criteria
		hasFilters := len(input.PartnerPerformerIds) > 0 ||
			len(input.PartnerEthnicities) > 0 ||
			len(input.PartnerCountries) > 0 ||
			input.PartnerRating != nil

		if !hasFilters {
			return
		}

		// Helper to expand ethnicity selections (same as in performerMarkersCriterionHandler)
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

		// Determine role for the partner
		partnerRole := "any"
		if input.PartnerRole != nil && *input.PartnerRole != "" {
			partnerRole = strings.ToLower(*input.PartnerRole)
		}

		var partnerClauses []string
		var args []interface{}

		// Filter by specific partner performer IDs
		if len(input.PartnerPerformerIds) > 0 {
			ph := getInBinding(len(input.PartnerPerformerIds))
			partnerClauses = append(partnerClauses, fmt.Sprintf("partner.id IN %s", ph))
			for _, pid := range input.PartnerPerformerIds {
				args = append(args, pid)
			}
		}

		// Filter by partner ethnicity
		if len(input.PartnerEthnicities) > 0 {
			expanded := expandEthnicities(input.PartnerEthnicities)
			ph := getInBinding(len(expanded))
			partnerClauses = append(partnerClauses, fmt.Sprintf("partner.ethnicity IN %s", ph))
			for _, e := range expanded {
				args = append(args, e)
			}
		}

		// Filter by partner country
		if len(input.PartnerCountries) > 0 {
			ph := getInBinding(len(input.PartnerCountries))
			partnerClauses = append(partnerClauses, fmt.Sprintf("partner.country IN %s", ph))
			for _, c := range input.PartnerCountries {
				args = append(args, c)
			}
		}

		// Filter by partner rating
		if input.PartnerRating != nil {
			w, wargs := getIntWhereClause("partner.rating", input.PartnerRating.Modifier, input.PartnerRating.Value, input.PartnerRating.Value2)
			partnerClauses = append(partnerClauses, w)
			args = append(args, wargs...)
		}

		// Partner role clause
		var partnerRoleClause string
		if partnerRole == "top" {
			partnerRoleClause = "AND smp_partner.role = 'top'"
		} else if partnerRole == "bottom" {
			partnerRoleClause = "AND smp_partner.role = 'bottom'"
		}

		// Tag filtering clause (if tags specified, only look at markers with these tags)
		var tagClause string
		if len(input.TagIds) > 0 {
			ph := getInBinding(len(input.TagIds))
			tagClause = fmt.Sprintf(` AND (
				sm.primary_tag_id IN %s
				OR EXISTS (
					SELECT 1 FROM scene_markers_tags smt 
					WHERE smt.scene_marker_id = sm.id 
					AND smt.tag_id IN %s
				)
			)`, ph, ph)
			// Add tag IDs twice (once for primary_tag_id, once for scene_markers_tags)
			for _, tid := range input.TagIds {
				args = append(args, tid)
			}
			for _, tid := range input.TagIds {
				args = append(args, tid)
			}
		}

		whereClause := ""
		if len(partnerClauses) > 0 {
			whereClause = " AND " + strings.Join(partnerClauses, " AND ")
		}

		var sql string
		switch input.Modifier {
		case models.CriterionModifierIncludes:
			// Performer must have at least one marker with a partner matching these criteria
			sql = fmt.Sprintf(`EXISTS (
				SELECT 1 FROM scene_marker_performers smp
				JOIN scene_markers sm ON sm.id = smp.scene_marker_id
				WHERE smp.performer_id = performers.id
				%s
				AND EXISTS (
					SELECT 1 FROM scene_marker_performers smp_partner
					JOIN performers partner ON partner.id = smp_partner.performer_id
					WHERE smp_partner.scene_marker_id = sm.id
					AND smp_partner.performer_id != performers.id
					%s
					%s
				)
			)`, tagClause, partnerRoleClause, whereClause)

		case models.CriterionModifierExcludes:
			// Performer must NOT have any markers with partners matching these criteria
			sql = fmt.Sprintf(`NOT EXISTS (
				SELECT 1 FROM scene_marker_performers smp
				JOIN scene_markers sm ON sm.id = smp.scene_marker_id
				WHERE smp.performer_id = performers.id
				%s
				AND EXISTS (
					SELECT 1 FROM scene_marker_performers smp_partner
					JOIN performers partner ON partner.id = smp_partner.performer_id
					WHERE smp_partner.scene_marker_id = sm.id
					AND smp_partner.performer_id != performers.id
					%s
					%s
				)
			)`, tagClause, partnerRoleClause, whereClause)
		}

		if sql != "" {
			f.addWhere(sql, args...)
		}
	}
}
