package sqlite

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/stashapp/stash/pkg/models"
)

type sceneMarkerFilterHandler struct {
	sceneMarkerFilter *models.SceneMarkerFilterType
}

func (qb *sceneMarkerFilterHandler) validate() error {
	return nil
}

func (qb *sceneMarkerFilterHandler) handle(ctx context.Context, f *filterBuilder) {
	sceneMarkerFilter := qb.sceneMarkerFilter
	if sceneMarkerFilter == nil {
		return
	}

	if err := qb.validate(); err != nil {
		f.setError(err)
		return
	}

	f.handleCriterion(ctx, qb.criterionHandler())
}

func (qb *sceneMarkerFilterHandler) joinScenes(f *filterBuilder) {
	sceneMarkerRepository.scenes.innerJoin(f, "", "scene_markers.scene_id")
}

func (qb *sceneMarkerFilterHandler) criterionHandler() criterionHandler {
	sceneMarkerFilter := qb.sceneMarkerFilter
	return compoundHandler{
		qb.tagIDCriterionHandler(sceneMarkerFilter.TagID),
		qb.tagsCriterionHandler(sceneMarkerFilter.Tags),
		qb.sceneTagsCriterionHandler(sceneMarkerFilter.SceneTags),
		qb.performerSceneTagsWithAttrsCriterionHandler(sceneMarkerFilter.PerformerSceneTagsWithAttrs),
		qb.performersCriterionHandler(sceneMarkerFilter.Performers),
		// Performer ethnicity filter mirrors scenes semantics on the marker's scene
		criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
			if sceneMarkerFilter.PerformerEthnicity != nil {
				pe := sceneMarkerFilter.PerformerEthnicity
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
		}),
		// Performer country filter mirrors scenes semantics but applies to the marker's scene
		criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
			if sceneMarkerFilter.PerformerCountry != nil {
				pc := sceneMarkerFilter.PerformerCountry
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
		}),
		// Filter by performer rating of linked performers on the marker's scene
		criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
			if sceneMarkerFilter.PerformerRating != nil {
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
		}),
		qb.scenesCriterionHandler(sceneMarkerFilter.Scenes),
		floatCriterionHandler(sceneMarkerFilter.Duration, "COALESCE(scene_markers.end_seconds - scene_markers.seconds, NULL)", nil),
		&timestampCriterionHandler{sceneMarkerFilter.CreatedAt, "scene_markers.created_at", nil},
		&timestampCriterionHandler{sceneMarkerFilter.UpdatedAt, "scene_markers.updated_at", nil},
		&dateCriterionHandler{sceneMarkerFilter.SceneDate, "scenes.date", qb.joinScenes},
		&timestampCriterionHandler{sceneMarkerFilter.SceneCreatedAt, "scenes.created_at", qb.joinScenes},
		&timestampCriterionHandler{sceneMarkerFilter.SceneUpdatedAt, "scenes.updated_at", qb.joinScenes},

		&relatedFilterHandler{
			relatedIDCol:   "scenes.id",
			relatedRepo:    sceneRepository.repository,
			relatedHandler: &sceneFilterHandler{sceneMarkerFilter.SceneFilter},
			joinFn: func(f *filterBuilder) {
				qb.joinScenes(f)
			},
		},
	}
}

// performerSceneTagsWithAttrsCriterionHandler for markers: mirrors the scene handler but applies to the marker's scene_id.
func (qb *sceneMarkerFilterHandler) performerSceneTagsWithAttrsCriterionHandler(input *models.PerformerSceneTagsWithAttrsCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if input == nil || len(input.Groups) == 0 {
			return
		}

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

		matchAny := input.MatchAny != nil && *input.MatchAny

		if matchAny {
			// OR semantics: each group is independent, so we still use EXISTS
			groupClauses := make([]string, 0, len(input.Groups))
			allArgs := make([]interface{}, 0)
			for _, g := range input.Groups {
				if len(g.TagIDs) == 0 {
					continue
				}

				where := []string{}
				args := []interface{}{}

				if g.PerformerCountry != nil && strings.TrimSpace(*g.PerformerCountry) != "" {
					where = append(where, "p_group.country = ?")
					args = append(args, strings.TrimSpace(*g.PerformerCountry))
				}

				if g.PerformerEthnicity != nil && strings.TrimSpace(*g.PerformerEthnicity) != "" {
					exp := expandEthnicity(*g.PerformerEthnicity)
					if len(exp) > 0 {
						ph := strings.Repeat("?,", len(exp))
						ph = ph[:len(ph)-1]
						where = append(where, fmt.Sprintf("p_group.ethnicity IN (%s)", ph))
						for _, v := range exp {
							args = append(args, v)
						}
					}
				}

				if g.PerformerRating != nil {
					w, wargs := getIntWhereClause("p_group.rating", g.PerformerRating.Modifier, g.PerformerRating.Value, g.PerformerRating.Value2)
					where = append(where, w)
					args = append(args, wargs...)
				}

				tagPlaceholders := strings.Repeat("?,", len(g.TagIDs))
				tagPlaceholders = tagPlaceholders[:len(tagPlaceholders)-1]
				for _, tid := range g.TagIDs {
					args = append(args, tid)
				}

				attrsClause := "1=1"
				if len(where) > 0 {
					attrsClause = strings.Join(where, " AND ")
				}

				clause := fmt.Sprintf(
					"EXISTS (SELECT 1 FROM performer_scene_tags scene_pst_group JOIN performers p_group ON p_group.id = scene_pst_group.performer_id WHERE scene_pst_group.scene_id = scene_markers.scene_id AND %s AND scene_pst_group.tag_id IN (%s) GROUP BY p_group.id HAVING COUNT(DISTINCT scene_pst_group.tag_id) = %d)",
					attrsClause, tagPlaceholders, len(g.TagIDs),
				)
				groupClauses = append(groupClauses, clause)
				allArgs = append(allArgs, args...)
			}

			// OR across groups in a single WHERE
			grouped := make([]string, len(groupClauses))
			for i, c := range groupClauses {
				grouped[i] = fmt.Sprintf("(%s)", c)
			}
			f.addWhere(strings.Join(grouped, " OR "), allArgs...)
		} else {
			// AND semantics with distinct performers: group identical criteria
			// and require sufficient distinct performers for each unique criteria set
			type groupSignature struct {
				tagIDsKey      string
				country        string
				ethnicity      string
				ratingModifier models.CriterionModifier
				ratingValue    int
				ratingValue2   *int
			}

			groupCounts := make(map[groupSignature]int)
			groupDetails := make(map[groupSignature]*models.PerformerSceneTagGroupInput)

			for _, g := range input.Groups {
				if len(g.TagIDs) == 0 {
					continue
				}

				// Build a unique signature for this group's criteria
				tagIDs := append([]string(nil), g.TagIDs...)
				sort.Strings(tagIDs)
				tagKey := strings.Join(tagIDs, ",")

				sig := groupSignature{
					tagIDsKey: tagKey,
				}
				if g.PerformerCountry != nil {
					sig.country = strings.TrimSpace(*g.PerformerCountry)
				}
				if g.PerformerEthnicity != nil {
					sig.ethnicity = strings.TrimSpace(*g.PerformerEthnicity)
				}
				if g.PerformerRating != nil {
					sig.ratingModifier = g.PerformerRating.Modifier
					sig.ratingValue = g.PerformerRating.Value
					sig.ratingValue2 = g.PerformerRating.Value2
				}

				groupCounts[sig]++
				if _, ok := groupDetails[sig]; !ok {
					groupDetails[sig] = &g
				}
			}

			// For each unique group signature, require at least <count> distinct performers
			for sig, multiplicity := range groupCounts {
				g := groupDetails[sig]
				where := []string{}
				args := []interface{}{}

				if sig.country != "" {
					where = append(where, "p_group.country = ?")
					args = append(args, sig.country)
				}

				if sig.ethnicity != "" {
					exp := expandEthnicity(sig.ethnicity)
					if len(exp) > 0 {
						ph := strings.Repeat("?,", len(exp))
						ph = ph[:len(ph)-1]
						where = append(where, fmt.Sprintf("p_group.ethnicity IN (%s)", ph))
						for _, v := range exp {
							args = append(args, v)
						}
					}
				}

				if g.PerformerRating != nil {
					w, wargs := getIntWhereClause("p_group.rating", g.PerformerRating.Modifier, g.PerformerRating.Value, g.PerformerRating.Value2)
					where = append(where, w)
					args = append(args, wargs...)
				}

				tagPlaceholders := strings.Repeat("?,", len(g.TagIDs))
				tagPlaceholders = tagPlaceholders[:len(tagPlaceholders)-1]
				for _, tid := range g.TagIDs {
					args = append(args, tid)
				}

				attrsClause := "1=1"
				if len(where) > 0 {
					attrsClause = strings.Join(where, " AND ")
				}

				// Require at least <multiplicity> distinct performers matching the criteria
				// Subquery finds performers who have ALL tags in the group, then counts them
				clause := fmt.Sprintf(
					`(
SELECT COUNT(*)
FROM (
  SELECT p_group.id
  FROM performer_scene_tags scene_pst_group
  JOIN performers p_group ON p_group.id = scene_pst_group.performer_id
  WHERE scene_pst_group.scene_id = scene_markers.scene_id
    AND %s
    AND scene_pst_group.tag_id IN (%s)
  GROUP BY p_group.id
  HAVING COUNT(DISTINCT scene_pst_group.tag_id) = %d
)
) >= ?`,
					attrsClause, tagPlaceholders, len(g.TagIDs),
				)
				args = append(args, multiplicity)
				f.addWhere(clause, args...)
			}
		}
	}
}

func (qb *sceneMarkerFilterHandler) tagIDCriterionHandler(tagID *string) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if tagID != nil {
			f.addLeftJoin("scene_markers_tags", "", "scene_markers_tags.scene_marker_id = scene_markers.id")

			f.addWhere("(scene_markers.primary_tag_id = ? OR scene_markers_tags.tag_id = ?)", *tagID, *tagID)
		}
	}
}

func (qb *sceneMarkerFilterHandler) tagsCriterionHandler(criterion *models.HierarchicalMultiCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if criterion != nil {
			tags := criterion.CombineExcludes()

			if tags.Modifier == models.CriterionModifierIsNull || tags.Modifier == models.CriterionModifierNotNull {
				var notClause string
				if tags.Modifier == models.CriterionModifierNotNull {
					notClause = "NOT"
				}

				f.addLeftJoin("scene_markers_tags", "", "scene_markers.id = scene_markers_tags.scene_marker_id")

				f.addWhere(fmt.Sprintf("%s scene_markers_tags.tag_id IS NULL", notClause))
				return
			}

			if tags.Modifier == models.CriterionModifierEquals && tags.Depth != nil && *tags.Depth != 0 {
				f.setError(fmt.Errorf("depth is not supported for equals modifier for marker tag filtering"))
				return
			}

			if len(tags.Value) == 0 && len(tags.Excludes) == 0 {
				return
			}

			if len(tags.Value) > 0 {
				valuesClause, err := getHierarchicalValues(ctx, tags.Value, tagTable, "tags_relations", "parent_id", "child_id", tags.Depth)
				if err != nil {
					f.setError(err)
					return
				}

				f.addWith(`marker_tags AS (
	SELECT mt.scene_marker_id, t.column1 AS root_tag_id FROM scene_markers_tags mt
	INNER JOIN (` + valuesClause + `) t ON t.column2 = mt.tag_id
	UNION
	SELECT m.id, t.column1 FROM scene_markers m
	INNER JOIN (` + valuesClause + `) t ON t.column2 = m.primary_tag_id
	)`)

				f.addLeftJoin("marker_tags", "", "marker_tags.scene_marker_id = scene_markers.id")

				switch tags.Modifier {
				case models.CriterionModifierEquals:
					// includes only the provided ids
					f.addWhere("marker_tags.root_tag_id IS NOT NULL")
					tagsLen := len(tags.Value)
					f.addHaving(fmt.Sprintf("count(distinct marker_tags.root_tag_id) IS %d", tagsLen))
					// decrement by one to account for primary tag id
					f.addWhere("(SELECT COUNT(*) FROM scene_markers_tags s WHERE s.scene_marker_id = scene_markers.id) = ?", tagsLen-1)
				case models.CriterionModifierNotEquals:
					f.setError(fmt.Errorf("not equals modifier is not supported for scene marker tags"))
				default:
					addHierarchicalConditionClauses(f, tags, "marker_tags", "root_tag_id")
				}
			}

			if len(criterion.Excludes) > 0 {
				valuesClause, err := getHierarchicalValues(ctx, tags.Excludes, tagTable, "tags_relations", "parent_id", "child_id", tags.Depth)
				if err != nil {
					f.setError(err)
					return
				}

				clause := "scene_markers.id NOT IN (SELECT scene_markers_tags.scene_marker_id FROM scene_markers_tags WHERE scene_markers_tags.tag_id IN (SELECT column2 FROM (%s)))"
				f.addWhere(fmt.Sprintf(clause, valuesClause))

				f.addWhere(fmt.Sprintf("scene_markers.primary_tag_id NOT IN (SELECT column2 FROM (%s))", valuesClause))
			}
		}
	}
}

func (qb *sceneMarkerFilterHandler) sceneTagsCriterionHandler(tags *models.HierarchicalMultiCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if tags != nil {
			f.addLeftJoin("scenes_tags", "", "scene_markers.scene_id = scenes_tags.scene_id")

			h := joinedHierarchicalMultiCriterionHandlerBuilder{
				primaryTable: "scene_markers",
				primaryKey:   sceneIDColumn,
				foreignTable: tagTable,
				foreignFK:    tagIDColumn,

				relationsTable: "tags_relations",
				joinTable:      "scenes_tags",
				joinAs:         "marker_scenes_tags",
				primaryFK:      sceneIDColumn,
			}

			h.handler(tags).handle(ctx, f)
		}
	}
}

func (qb *sceneMarkerFilterHandler) performersCriterionHandler(performers *models.MultiCriterionInput) criterionHandlerFunc {
	h := joinedMultiCriterionHandlerBuilder{
		primaryTable: sceneTable,
		joinTable:    performersScenesTable,
		joinAs:       "performers_join",
		primaryFK:    sceneIDColumn,
		foreignFK:    performerIDColumn,

		addJoinTable: func(f *filterBuilder) {
			f.addLeftJoin(performersScenesTable, "performers_join", "performers_join.scene_id = scene_markers.scene_id")
		},
	}

	handler := h.handler(performers)
	return func(ctx context.Context, f *filterBuilder) {
		if performers == nil {
			return
		}

		// Make sure scenes is included, otherwise excludes filter fails
		qb.joinScenes(f)
		handler(ctx, f)
	}
}

func (qb *sceneMarkerFilterHandler) scenesCriterionHandler(scenes *models.MultiCriterionInput) criterionHandlerFunc {
	addJoinsFunc := func(f *filterBuilder) {
		f.addLeftJoin(sceneTable, "markers_scenes", "markers_scenes.id = scene_markers.scene_id")
	}
	h := multiCriterionHandlerBuilder{
		primaryTable: sceneMarkerTable,
		foreignTable: "markers_scenes",
		joinTable:    "",
		primaryFK:    sceneIDColumn,
		foreignFK:    sceneIDColumn,
		addJoinsFunc: addJoinsFunc,
	}
	return h.handler(scenes)
}
