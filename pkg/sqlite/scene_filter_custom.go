package sqlite

// CUSTOM: Custom criterion handlers for scene filters.

import (
	"context"
	"fmt"
	"strings"

	"github.com/stashapp/stash/pkg/models"
)

func (qb *sceneFilterHandler) releaseCountCriterionHandler(releaseCount *models.IntCriterionInput) criterionHandlerFunc {
	h := countCriterionHandlerBuilder{
		primaryTable: sceneTable,
		joinTable:    sceneReleaseTable,
		primaryFK:    sceneIDColumn,
	}

	return h.handler(releaseCount)
}

func (qb *sceneFilterHandler) effectiveDateCriterionHandler(effectiveDate *models.DateCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if effectiveDate == nil {
			return
		}

		// Compute effective_date as the minimum of scene.date and all release dates
		// Using a subquery: COALESCE(MIN(scene.date, (SELECT MIN(date) FROM scene_releases WHERE scene_id = scenes.id)), scene.date, (SELECT MIN(date) FROM scene_releases WHERE scene_id = scenes.id))
		effectiveDateExpr := fmt.Sprintf(`COALESCE(
			MIN(COALESCE(%s.date, '9999-12-31'), COALESCE((SELECT MIN(date) FROM %s WHERE scene_id = %s.id), '9999-12-31')),
			%s.date,
			(SELECT MIN(date) FROM %s WHERE scene_id = %s.id)
		)`, sceneTable, sceneReleaseTable, sceneTable, sceneTable, sceneReleaseTable, sceneTable)

		clause, args := getDateCriterionWhereClause(effectiveDateExpr, *effectiveDate)
		f.addWhere(clause, args...)
	}
}

func (qb *sceneFilterHandler) hasMarkerPerformersCriterionHandler(hasMarkerPerformers *string) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if hasMarkerPerformers == nil || *hasMarkerPerformers == "" {
			return
		}

		if *hasMarkerPerformers == "true" {
			// Scene has at least one marker with at least one performer assigned
			f.addWhere("EXISTS (SELECT 1 FROM scene_markers sm JOIN scene_marker_performers smp ON smp.scene_marker_id = sm.id WHERE sm.scene_id = scenes.id)")
		} else {
			// Scene has no markers with performers (either no markers or markers have no performers)
			f.addWhere("NOT EXISTS (SELECT 1 FROM scene_markers sm JOIN scene_marker_performers smp ON smp.scene_marker_id = sm.id WHERE sm.scene_id = scenes.id)")
		}
	}
}

// customFiltersCriterionHandler applies predefined complex filters for scenes.
// Options:
// - 'versatile_scenes': Scenes where ALL performers have at least one sexTagId marker as top AND at least one as bottom
// - 'circular_oral': Scenes with a marker tagged with oralTagId (or subtag) where all performers are both tops and bottoms
// Note: All tag checks include both primary_tag_id and secondary tags (scene_markers_tags)
func (qb *sceneFilterHandler) customFiltersCriterionHandler(customFilters *models.CustomSceneFilterInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if customFilters == nil || customFilters.Type == "" {
			return
		}

		switch customFilters.Type {
		case "versatile_scenes":
			// Use sexTagId if provided, otherwise return early
			if customFilters.SexTagID == nil || *customFilters.SexTagID == "" {
				return
			}
			sexTagID := *customFilters.SexTagID

			f.addWhere(fmt.Sprintf(`
				-- Get all performers in this scene
				(SELECT COUNT(DISTINCT ps.performer_id) FROM performers_scenes ps WHERE ps.scene_id = scenes.id) > 0
				AND
				-- Count performers who have BOTH a top and a bottom marker for sexTagId
				(SELECT COUNT(DISTINCT ps.performer_id)
				 FROM performers_scenes ps
				 WHERE ps.scene_id = scenes.id) =
				(SELECT COUNT(DISTINCT ps.performer_id)
				 FROM performers_scenes ps
				 WHERE ps.scene_id = scenes.id
				   AND EXISTS (
					 WITH RECURSIVE sex_tags_top(id) AS (
					   SELECT id FROM tags WHERE id = %s
					   UNION ALL
					   SELECT tr.child_id FROM tags_relations tr JOIN sex_tags_top st ON tr.parent_id = st.id
					 )
					 SELECT 1 FROM scene_markers sm
					 JOIN scene_marker_performers smp ON smp.scene_marker_id = sm.id
					 WHERE sm.scene_id = scenes.id
					   AND smp.performer_id = ps.performer_id
					   AND smp.role = 'top'
					   AND (sm.primary_tag_id IN (SELECT id FROM sex_tags_top)
					        OR EXISTS (SELECT 1 FROM scene_markers_tags smt WHERE smt.scene_marker_id = sm.id AND smt.tag_id IN (SELECT id FROM sex_tags_top)))
				   )
				   AND EXISTS (
					 WITH RECURSIVE sex_tags_bottom(id) AS (
					   SELECT id FROM tags WHERE id = %s
					   UNION ALL
					   SELECT tr.child_id FROM tags_relations tr JOIN sex_tags_bottom st ON tr.parent_id = st.id
					 )
					 SELECT 1 FROM scene_markers sm2
					 JOIN scene_marker_performers smp2 ON smp2.scene_marker_id = sm2.id
					 WHERE sm2.scene_id = scenes.id
					   AND smp2.performer_id = ps.performer_id
					   AND smp2.role = 'bottom'
					   AND (sm2.primary_tag_id IN (SELECT id FROM sex_tags_bottom)
					        OR EXISTS (SELECT 1 FROM scene_markers_tags smt2 WHERE smt2.scene_marker_id = sm2.id AND smt2.tag_id IN (SELECT id FROM sex_tags_bottom)))
				   )
				)
			`, sexTagID, sexTagID))

		case "circular_oral":
			// Use oralTagId if provided, otherwise return early
			if customFilters.OralTagID == nil || *customFilters.OralTagID == "" {
				return
			}
			oralTagID := *customFilters.OralTagID

			// Scenes with a marker tagged with oralTagId (or subtag) where ALL performers are both tops and bottoms
			f.addWhere(fmt.Sprintf(`EXISTS (
				WITH RECURSIVE oral_tags(id) AS (
					SELECT id FROM tags WHERE id = %s
					UNION ALL
					SELECT tr.child_id FROM tags_relations tr JOIN oral_tags ot ON tr.parent_id = ot.id
				)
				SELECT 1
				FROM scene_markers sm
				WHERE sm.scene_id = scenes.id
				  AND (sm.primary_tag_id IN (SELECT id FROM oral_tags)
				       OR EXISTS (SELECT 1 FROM scene_markers_tags smt WHERE smt.scene_marker_id = sm.id AND smt.tag_id IN (SELECT id FROM oral_tags)))
				  -- Marker must have at least one performer
				  AND EXISTS (SELECT 1 FROM scene_marker_performers smp WHERE smp.scene_marker_id = sm.id)
				  -- All performers on this marker must be both top AND bottom
				  AND NOT EXISTS (
					SELECT 1 FROM scene_marker_performers smp 
					WHERE smp.scene_marker_id = sm.id
					AND smp.performer_id NOT IN (
						SELECT smp2.performer_id 
						FROM scene_marker_performers smp2 
						WHERE smp2.scene_marker_id = sm.id AND smp2.role = 'top'
					)
				  )
				  AND NOT EXISTS (
					SELECT 1 FROM scene_marker_performers smp 
					WHERE smp.scene_marker_id = sm.id
					AND smp.performer_id NOT IN (
						SELECT smp2.performer_id 
						FROM scene_marker_performers smp2 
						WHERE smp2.scene_marker_id = sm.id AND smp2.role = 'bottom'
					)
				  )
			)`, oralTagID))
		}
	}
}

// sceneTypeCriterionHandler filters scenes by type based on marker tags.
// Types:
// - 'sex': Scene has at least one marker matching sexTagId (or subtag/secondary)
// - 'oral': Scene has at least one marker matching oralTagId, and zero markers matching sexTagId
// - 'solo': Scene has at least one marker matching soloTagId, and zero matching sexTagId or oralTagId
// - 'facial': Scene has at least one marker matching facialTagId
// Multiple types are ANDed together.
func (qb *sceneFilterHandler) sceneTypeCriterionHandler(sceneType *models.SceneTypeFilterInput) criterionHandlerFunc {
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

		// Helper: generate EXISTS clause with CTE for a tag family match
		existsMarkerForTag := func(cteName, tagID string) string {
			return fmt.Sprintf(`EXISTS (
				WITH RECURSIVE %s(id) AS (
					SELECT id FROM tags WHERE id = %s
					UNION ALL
					SELECT tr.child_id FROM tags_relations tr JOIN %s tf ON tr.parent_id = tf.id
				)
				SELECT 1 FROM scene_markers sm
				WHERE sm.scene_id = scenes.id
				  AND (sm.primary_tag_id IN (SELECT id FROM %s)
				       OR EXISTS (SELECT 1 FROM scene_markers_tags smt WHERE smt.scene_marker_id = sm.id AND smt.tag_id IN (SELECT id FROM %s)))
			)`, cteName, tagID, cteName, cteName, cteName)
		}

		// Helper: generate NOT EXISTS clause with CTE for a tag family match
		notExistsMarkerForTag := func(cteName, tagID string) string {
			return fmt.Sprintf(`NOT EXISTS (
				WITH RECURSIVE %s(id) AS (
					SELECT id FROM tags WHERE id = %s
					UNION ALL
					SELECT tr.child_id FROM tags_relations tr JOIN %s tf ON tr.parent_id = tf.id
				)
				SELECT 1 FROM scene_markers sm
				WHERE sm.scene_id = scenes.id
				  AND (sm.primary_tag_id IN (SELECT id FROM %s)
				       OR EXISTS (SELECT 1 FROM scene_markers_tags smt WHERE smt.scene_marker_id = sm.id AND smt.tag_id IN (SELECT id FROM %s)))
			)`, cteName, tagID, cteName, cteName, cteName)
		}

		var conditions []string

		for _, t := range sceneType.Types {
			switch t {
			case "sex":
				if sexTagID == "" {
					continue
				}
				conditions = append(conditions, existsMarkerForTag("sex_tags_st", sexTagID))

			case "oral":
				if oralTagID == "" {
					continue
				}
				conditions = append(conditions, existsMarkerForTag("oral_tags_st", oralTagID))
				// Exclude scenes with sex markers
				if sexTagID != "" {
					conditions = append(conditions, notExistsMarkerForTag("sex_excl_oral_st", sexTagID))
				}

			case "solo":
				if soloTagID == "" {
					continue
				}
				conditions = append(conditions, existsMarkerForTag("solo_tags_st", soloTagID))
				// Exclude scenes with sex markers
				if sexTagID != "" {
					conditions = append(conditions, notExistsMarkerForTag("sex_excl_solo_st", sexTagID))
				}
				// Exclude scenes with oral markers
				if oralTagID != "" {
					conditions = append(conditions, notExistsMarkerForTag("oral_excl_solo_st", oralTagID))
				}

			case "facial":
				if facialTagID == "" {
					continue
				}
				conditions = append(conditions, existsMarkerForTag("facial_tags_st", facialTagID))
			}
		}

		if len(conditions) == 0 {
			return
		}

		// Join all conditions with AND
		f.addWhere(strings.Join(conditions, " AND "))
	}
}

func (qb *sceneFilterHandler) performerEthnicityCriterionHandler(pe *models.StringCriterionInput) criterionHandlerFunc {
	return criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
		if pe != nil {
			if !pe.Modifier.IsValid() {
				return
			}

			// split comma-separated list
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

			// Expand ethnicity selections to include special cases:
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

			// Build allowed set (unique) for IN(...) clauses
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

			existsPerformer := "EXISTS (SELECT 1 FROM performers_scenes ps WHERE ps.scene_id = scenes.id)"

			switch pe.Modifier {
			case models.CriterionModifierIncludes:
				clause := fmt.Sprintf("EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scenes.id AND p.ethnicity IN (%s))", placeholders)
				f.addWhere(clause, args...)
				f.addWhere(existsPerformer)
			case models.CriterionModifierIncludesAll:
				// ensure at least one performer per each selected value (considering expansions)
				for _, s := range selected {
					group := expandForFilter(s)
					ph := strings.Repeat("?,", len(group))
					ph = ph[:len(ph)-1]
					gargs := make([]interface{}, len(group))
					for i, v := range group {
						gargs[i] = v
					}
					f.addWhere(fmt.Sprintf("EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scenes.id AND p.ethnicity IN (%s))", ph), gargs...)
				}
			case models.CriterionModifierEquals:
				// all performers must be in the allowed set (expanded), exclude null/empty
				clause := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scenes.id AND (p.ethnicity IS NULL OR TRIM(p.ethnicity) = '' OR p.ethnicity NOT IN (%s)))", placeholders)
				f.addWhere(clause, args...)
				f.addWhere(existsPerformer)
				// ensure at least one performer per each selected value (considering expansions)
				for _, s := range selected {
					group := expandForFilter(s)
					ph := strings.Repeat("?,", len(group))
					ph = ph[:len(ph)-1]
					gargs := make([]interface{}, len(group))
					for i, v := range group {
						gargs[i] = v
					}
					f.addWhere(fmt.Sprintf("EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scenes.id AND p.ethnicity IN (%s))", ph), gargs...)
				}
			case models.CriterionModifierNotEquals:
				// no performer may match any of the allowed (expanded) set
				clause := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scenes.id AND p.ethnicity IN (%s))", placeholders)
				f.addWhere(clause, args...)
				f.addWhere(existsPerformer)
			default:
				clause := fmt.Sprintf("EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scenes.id AND p.ethnicity IN (%s))", placeholders)
				f.addWhere(clause, args...)
				f.addWhere(existsPerformer)
			}
		}
	})
}

func (qb *sceneFilterHandler) performerCountryCriterionHandler(pc *models.StringCriterionInput) criterionHandlerFunc {
	return criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
		if pc != nil {
			if !pc.Modifier.IsValid() {
				return
			}

			// split comma-separated country list into slice and build placeholders
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

			// require at least one performer on scene
			existsPerformer := "EXISTS (SELECT 1 FROM performers_scenes ps WHERE ps.scene_id = scenes.id)"

			switch pc.Modifier {
			case models.CriterionModifierIncludes:
				// scene has at least one performer whose country is in the set
				clause := fmt.Sprintf("EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scenes.id AND p.country IN (%s))", placeholders)
				f.addWhere(clause, args...)
				f.addWhere(existsPerformer)
			case models.CriterionModifierIncludesAll:
				// each selected country must have at least one performer
				for _, c := range countries {
					f.addWhere("EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scenes.id AND p.country = ?)", c)
				}
			case models.CriterionModifierEquals:
				// all performers must be in the set and at least one per value
				clause := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scenes.id AND (p.country IS NULL OR TRIM(p.country) = '' OR p.country NOT IN (%s)))", placeholders)
				f.addWhere(clause, args...)
				f.addWhere(existsPerformer)
				for _, c := range countries {
					f.addWhere("EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scenes.id AND p.country = ?)", c)
				}
			case models.CriterionModifierNotEquals:
				// no performer may be in the set; performers without country are allowed
				clause := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scenes.id AND p.country IN (%s))", placeholders)
				f.addWhere(clause, args...)
				f.addWhere(existsPerformer)
			default:
				// fallback: treat as includes
				clause := fmt.Sprintf("EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scenes.id AND p.country IN (%s))", placeholders)
				f.addWhere(clause, args...)
				f.addWhere(existsPerformer)
			}
		}
	})
}

func (qb *sceneFilterHandler) performerRatingCriterionHandler(pr *models.IntCriterionInput, ratingAll *bool) criterionHandlerFunc {
	return criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
		if pr != nil {
			// default to ALL performers must satisfy unless explicitly overridden
			modeAll := true
			if ratingAll != nil {
				modeAll = *ratingAll
			}

			if !modeAll {
				// ANY performer must satisfy: simple join + numeric comparison
				f.addInnerJoin("performers_scenes", "", "scenes.id = performers_scenes.scene_id")
				f.addInnerJoin("performers", "", "performers_scenes.performer_id = performers.id")
				intCriterionHandler(pr, "performers.rating", nil)(ctx, f)
				return
			}

			// ALL performers must satisfy: ensure no violating performer exists and at least one performer exists
			existsPerformer := "EXISTS (SELECT 1 FROM performers_scenes ps WHERE ps.scene_id = scenes.id)"
			switch pr.Modifier {
			case models.CriterionModifierEquals:
				f.addWhere("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scenes.id AND (p.rating IS NULL OR p.rating != ?))", pr.Value)
				f.addWhere(existsPerformer)
			case models.CriterionModifierNotEquals:
				f.addWhere("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scenes.id AND p.rating = ?)", pr.Value)
				f.addWhere(existsPerformer)
			case models.CriterionModifierGreaterThan:
				f.addWhere("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scenes.id AND (p.rating IS NULL OR p.rating <= ?))", pr.Value)
				f.addWhere(existsPerformer)
			case models.CriterionModifierLessThan:
				f.addWhere("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scenes.id AND (p.rating IS NULL OR p.rating >= ?))", pr.Value)
				f.addWhere(existsPerformer)
			case models.CriterionModifierBetween:
				f.addWhere("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scenes.id AND (p.rating IS NULL OR p.rating < ? OR p.rating > ?))", pr.Value, pr.Value2)
				f.addWhere(existsPerformer)
			case models.CriterionModifierNotBetween:
				f.addWhere("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scenes.id AND (p.rating IS NULL OR (p.rating >= ? AND p.rating <= ?)))", pr.Value, pr.Value2)
				f.addWhere(existsPerformer)
			case models.CriterionModifierNotNull:
				f.addWhere("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scenes.id AND p.rating IS NULL)")
				f.addWhere(existsPerformer)
			case models.CriterionModifierIsNull:
				f.addWhere("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scenes.id AND p.rating IS NOT NULL)")
				f.addWhere(existsPerformer)
			default:
				f.addInnerJoin("performers_scenes", "", "scenes.id = performers_scenes.scene_id")
				f.addInnerJoin("performers", "", "performers_scenes.performer_id = performers.id")
				intCriterionHandler(pr, "performers.rating", nil)(ctx, f)
			}
		}
	})
}
