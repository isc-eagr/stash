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

		effectiveDateExpr := EffectiveSceneDateSQLCustom(sceneTable)

		clause, args := getDateCriterionWhereClause(effectiveDateExpr, *effectiveDate)
		f.addWhere(clause, args...)
	}
}

// EffectiveSceneDateSQLCustom keeps undated scene families NULL while returning
// the earliest actual scene or release date. Alias must be a trusted SQL name.
func EffectiveSceneDateSQLCustom(sceneAlias string) string {
	releaseDate := fmt.Sprintf("(SELECT MIN(date) FROM %s WHERE scene_id = %s.id)", sceneReleaseTable, sceneAlias)
	return fmt.Sprintf("CASE WHEN %s.date IS NULL THEN %s WHEN %s IS NULL THEN %s.date ELSE MIN(%s.date, %s) END",
		sceneAlias, releaseDate, releaseDate, sceneAlias, sceneAlias, releaseDate)
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

		var tagID *string
		switch customFilters.Type {
		case "versatile_scenes":
			tagID = customFilters.SexTagID
		case "circular_oral":
			tagID = customFilters.OralTagID
		default:
			return
		}
		if tagID == nil || *tagID == "" {
			return
		}
		matches, scopeArgs := sceneMarkerTagFamilyForFilterCustom(f)
		var matchSQL string
		if customFilters.Type == "versatile_scenes" {
			// Aggregate each person's qualifying roles once, then require every
			// scene performer to have both. Extra marker-only performers don't count.
			matchSQL = `WITH matching_markers AS MATERIALIZED (` + matches + `),
 both_roles AS MATERIALIZED (
   SELECT sm.scene_id, mp.performer_id
   FROM matching_markers sm JOIN scene_marker_performers mp ON mp.scene_marker_id = sm.id
   WHERE mp.role IN ('top', 'bottom')
   GROUP BY sm.scene_id, mp.performer_id HAVING COUNT(DISTINCT mp.role) = 2
 )
 SELECT ps.scene_id FROM performers_scenes ps
 LEFT JOIN both_roles b ON b.scene_id = ps.scene_id AND b.performer_id = ps.performer_id
 WHERE ps.scene_id IN (SELECT scene_id FROM both_roles)
 GROUP BY ps.scene_id
 HAVING COUNT(DISTINCT ps.performer_id) > 0
   AND COUNT(DISTINCT ps.performer_id) = COUNT(DISTINCT b.performer_id)`
		} else {
			// All assigned marker performers must have both roles on that marker.
			matchSQL = `SELECT sm.scene_id FROM (` + matches + `) sm
 JOIN scene_marker_performers mp ON mp.scene_marker_id = sm.id
 GROUP BY sm.id
 HAVING COUNT(DISTINCT mp.performer_id) > 0
   AND COUNT(DISTINCT mp.performer_id) = COUNT(DISTINCT CASE WHEN mp.role = 'top' THEN mp.performer_id END)
   AND COUNT(DISTINCT mp.performer_id) = COUNT(DISTINCT CASE WHEN mp.role = 'bottom' THEN mp.performer_id END)`
		}
		f.addWhere("scenes.id IN ("+matchSQL+")", append([]interface{}{*tagID}, scopeArgs...)...)
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

		matches, scopeArgs := sceneMarkerTagFamilyForFilterCustom(f)
		var args []interface{}
		existsMarkerForTag := func(tagID string) string {
			args = append(args, tagID)
			args = append(args, scopeArgs...)
			return "scenes.id IN (SELECT scene_id FROM (" + matches + ") WHERE scene_id IS NOT NULL)"
		}
		notExistsMarkerForTag := func(tagID string) string {
			return "NOT (" + existsMarkerForTag(tagID) + ")"
		}

		var conditions []string

		for _, t := range sceneType.Types {
			switch t {
			case "sex":
				if sexTagID == "" {
					continue
				}
				conditions = append(conditions, existsMarkerForTag(sexTagID))

			case "oral":
				if oralTagID == "" {
					continue
				}
				conditions = append(conditions, existsMarkerForTag(oralTagID))
				// Exclude scenes with sex markers
				if sexTagID != "" {
					conditions = append(conditions, notExistsMarkerForTag(sexTagID))
				}

			case "solo":
				if soloTagID == "" {
					continue
				}
				conditions = append(conditions, existsMarkerForTag(soloTagID))
				// Exclude scenes with sex markers
				if sexTagID != "" {
					conditions = append(conditions, notExistsMarkerForTag(sexTagID))
				}
				// Exclude scenes with oral markers
				if oralTagID != "" {
					conditions = append(conditions, notExistsMarkerForTag(oralTagID))
				}

			case "facial":
				if facialTagID == "" {
					continue
				}
				conditions = append(conditions, existsMarkerForTag(facialTagID))
			}
		}

		if len(conditions) == 0 {
			return
		}

		// Join all conditions with AND
		f.addWhere(strings.Join(conditions, " AND "), args...)
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
				// A scene-ID set avoids row multiplication and keeps this
				// branch from excluding performerless scenes in a sibling OR branch.
				clause, args := getIntCriterionWhereClause("p.rating", *pr)
				f.addWhere("scenes.id IN (SELECT ps.scene_id FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE "+clause+")", args...)
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
			case models.CriterionModifierGreaterThanEquals:
				f.addWhere("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scenes.id AND (p.rating IS NULL OR p.rating < ?))", pr.Value)
				f.addWhere(existsPerformer)
			case models.CriterionModifierLessThanEquals:
				f.addWhere("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scenes.id AND (p.rating IS NULL OR p.rating > ?))", pr.Value)
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
