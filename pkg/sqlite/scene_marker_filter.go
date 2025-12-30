package sqlite

import (
	"context"
	"fmt"
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

func (qb *sceneMarkerFilterHandler) sceneDirectorCriterionHandler(criterion *models.StringCriterionInput) criterionHandler {
	return criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
		if criterion != nil {
			qb.joinScenes(f)
			stringCriterionHandler(criterion, "scenes.director")(ctx, f)
		}
	})
}

func (qb *sceneMarkerFilterHandler) criterionHandler() criterionHandler {
	sceneMarkerFilter := qb.sceneMarkerFilter
	return compoundHandler{
		qb.tagIDCriterionHandler(sceneMarkerFilter.TagID),
		qb.tagsCriterionHandler(sceneMarkerFilter.Tags),
		qb.sceneTagsCriterionHandler(sceneMarkerFilter.SceneTags),
		qb.performersCriterionHandler(sceneMarkerFilter.Performers),
		qb.studiosCriterionHandler(sceneMarkerFilter.Studios),
		qb.sceneDirectorCriterionHandler(sceneMarkerFilter.SceneDirector),
		criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
			if sceneMarkerFilter.HasEndTime != nil {
				if *sceneMarkerFilter.HasEndTime {
					f.addWhere("scene_markers.end_seconds IS NOT NULL")
				} else {
					f.addWhere("scene_markers.end_seconds IS NULL")
				}
			}
		}),
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

		// Marker performer filters (performers assigned directly to the marker via scene_marker_performers)
		qb.markerPerformersFilterHandler(sceneMarkerFilter.MarkerPerformers),
		qb.markerPerformerEthnicityCriterionHandler(sceneMarkerFilter.MarkerPerformerEthnicity),
		qb.markerPerformerCountryCriterionHandler(sceneMarkerFilter.MarkerPerformerCountry),
		qb.markerPerformerRatingCriterionHandler(sceneMarkerFilter.MarkerPerformerRating, sceneMarkerFilter.MarkerPerformerRatingAll),
		qb.hasMarkerPerformersCriterionHandler(sceneMarkerFilter.HasMarkerPerformers),
		// Combined marker tags with performer attributes filter
		qb.markerTagsWithPerformersCriterionHandler(sceneMarkerFilter.SceneMarkerTags),

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

// markerPerformersFilterHandler filters by performers assigned directly to the marker with top/bottom role support
func (qb *sceneMarkerFilterHandler) markerPerformersFilterHandler(input *models.MarkerPerformersFilterInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if input == nil || !input.Modifier.IsValid() {
			return
		}

		hasTops := len(input.TopPerformerIDs) > 0
		hasBottoms := len(input.BottomPerformerIDs) > 0

		// Handle IS_NULL / NOT_NULL modifiers
		if input.Modifier == models.CriterionModifierIsNull {
			f.addWhere("NOT EXISTS (SELECT 1 FROM scene_marker_performers smp WHERE smp.scene_marker_id = scene_markers.id)")
			return
		}

		if input.Modifier == models.CriterionModifierNotNull {
			f.addWhere("EXISTS (SELECT 1 FROM scene_marker_performers smp WHERE smp.scene_marker_id = scene_markers.id)")
			return
		}

		if !hasTops && !hasBottoms {
			return
		}

		// Determine mode: AND (both must match) or OR (either can match)
		modeAnd := false
		if input.Mode != nil && strings.EqualFold(*input.Mode, "AND") {
			modeAnd = true
		}

		// Build conditions for each role
		buildRoleCondition := func(performerIDs []string, role string, modifier models.CriterionModifier) (string, []interface{}) {
			if len(performerIDs) == 0 {
				return "", nil
			}

			placeholders := strings.Repeat("?,", len(performerIDs))
			placeholders = placeholders[:len(placeholders)-1]
			args := make([]interface{}, len(performerIDs))
			for i, v := range performerIDs {
				args[i] = v
			}

			var clause string
			switch modifier {
			case models.CriterionModifierIncludes:
				clause = fmt.Sprintf("EXISTS (SELECT 1 FROM scene_marker_performers smp WHERE smp.scene_marker_id = scene_markers.id AND smp.role = '%s' AND smp.performer_id IN (%s))", role, placeholders)
			case models.CriterionModifierIncludesAll:
				// For IncludesAll, we need to ensure ALL specified performers exist with this role
				clauses := make([]string, len(performerIDs))
				allArgs := make([]interface{}, 0)
				for i, pid := range performerIDs {
					clauses[i] = fmt.Sprintf("EXISTS (SELECT 1 FROM scene_marker_performers smp WHERE smp.scene_marker_id = scene_markers.id AND smp.role = '%s' AND smp.performer_id = ?)", role)
					allArgs = append(allArgs, pid)
				}
				return "(" + strings.Join(clauses, " AND ") + ")", allArgs
			case models.CriterionModifierExcludes:
				clause = fmt.Sprintf("NOT EXISTS (SELECT 1 FROM scene_marker_performers smp WHERE smp.scene_marker_id = scene_markers.id AND smp.role = '%s' AND smp.performer_id IN (%s))", role, placeholders)
			default:
				clause = fmt.Sprintf("EXISTS (SELECT 1 FROM scene_marker_performers smp WHERE smp.scene_marker_id = scene_markers.id AND smp.role = '%s' AND smp.performer_id IN (%s))", role, placeholders)
			}
			return clause, args
		}

		topClause, topArgs := buildRoleCondition(input.TopPerformerIDs, "top", input.Modifier)
		bottomClause, bottomArgs := buildRoleCondition(input.BottomPerformerIDs, "bottom", input.Modifier)

		if hasTops && hasBottoms {
			// Both top and bottom specified
			allArgs := append(topArgs, bottomArgs...)
			if modeAnd {
				// AND mode: both conditions must match
				f.addWhere(topClause, topArgs...)
				f.addWhere(bottomClause, bottomArgs...)
			} else {
				// OR mode: either condition can match
				combined := fmt.Sprintf("(%s OR %s)", topClause, bottomClause)
				f.addWhere(combined, allArgs...)
			}
		} else if hasTops {
			f.addWhere(topClause, topArgs...)
		} else if hasBottoms {
			f.addWhere(bottomClause, bottomArgs...)
		}
	}
}

// markerPerformerEthnicityCriterionHandler filters by ethnicity of performers assigned directly to the marker
func (qb *sceneMarkerFilterHandler) markerPerformerEthnicityCriterionHandler(pe *models.StringCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if pe == nil || !pe.Modifier.IsValid() {
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

		// Expand ethnicity selections
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

		existsMarkerPerformer := "EXISTS (SELECT 1 FROM scene_marker_performers smp WHERE smp.scene_marker_id = scene_markers.id)"

		switch pe.Modifier {
		case models.CriterionModifierIncludes:
			clause := fmt.Sprintf("EXISTS (SELECT 1 FROM scene_marker_performers smp JOIN performers p ON p.id = smp.performer_id WHERE smp.scene_marker_id = scene_markers.id AND p.ethnicity IN (%s))", placeholders)
			f.addWhere(clause, args...)
			f.addWhere(existsMarkerPerformer)
		case models.CriterionModifierIncludesAll:
			for _, s := range selected {
				group := expandForFilter(s)
				ph := strings.Repeat("?,", len(group))
				ph = ph[:len(ph)-1]
				gargs := make([]interface{}, len(group))
				for i, v := range group {
					gargs[i] = v
				}
				f.addWhere(fmt.Sprintf("EXISTS (SELECT 1 FROM scene_marker_performers smp JOIN performers p ON p.id = smp.performer_id WHERE smp.scene_marker_id = scene_markers.id AND p.ethnicity IN (%s))", ph), gargs...)
			}
		case models.CriterionModifierEquals:
			clause := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM scene_marker_performers smp JOIN performers p ON p.id = smp.performer_id WHERE smp.scene_marker_id = scene_markers.id AND (p.ethnicity IS NULL OR TRIM(p.ethnicity) = '' OR p.ethnicity NOT IN (%s)))", placeholders)
			f.addWhere(clause, args...)
			f.addWhere(existsMarkerPerformer)
			for _, s := range selected {
				group := expandForFilter(s)
				ph := strings.Repeat("?,", len(group))
				ph = ph[:len(ph)-1]
				gargs := make([]interface{}, len(group))
				for i, v := range group {
					gargs[i] = v
				}
				f.addWhere(fmt.Sprintf("EXISTS (SELECT 1 FROM scene_marker_performers smp JOIN performers p ON p.id = smp.performer_id WHERE smp.scene_marker_id = scene_markers.id AND p.ethnicity IN (%s))", ph), gargs...)
			}
		case models.CriterionModifierNotEquals:
			clause := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM scene_marker_performers smp JOIN performers p ON p.id = smp.performer_id WHERE smp.scene_marker_id = scene_markers.id AND p.ethnicity IN (%s))", placeholders)
			f.addWhere(clause, args...)
			f.addWhere(existsMarkerPerformer)
		default:
			clause := fmt.Sprintf("EXISTS (SELECT 1 FROM scene_marker_performers smp JOIN performers p ON p.id = smp.performer_id WHERE smp.scene_marker_id = scene_markers.id AND p.ethnicity IN (%s))", placeholders)
			f.addWhere(clause, args...)
			f.addWhere(existsMarkerPerformer)
		}
	}
}

// markerPerformerCountryCriterionHandler filters by country of performers assigned directly to the marker
func (qb *sceneMarkerFilterHandler) markerPerformerCountryCriterionHandler(pc *models.StringCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if pc == nil || !pc.Modifier.IsValid() {
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

		existsMarkerPerformer := "EXISTS (SELECT 1 FROM scene_marker_performers smp WHERE smp.scene_marker_id = scene_markers.id)"

		switch pc.Modifier {
		case models.CriterionModifierIncludes:
			clause := fmt.Sprintf("EXISTS (SELECT 1 FROM scene_marker_performers smp JOIN performers p ON p.id = smp.performer_id WHERE smp.scene_marker_id = scene_markers.id AND p.country IN (%s))", placeholders)
			f.addWhere(clause, args...)
			f.addWhere(existsMarkerPerformer)
		case models.CriterionModifierIncludesAll:
			for _, c := range countries {
				f.addWhere("EXISTS (SELECT 1 FROM scene_marker_performers smp JOIN performers p ON p.id = smp.performer_id WHERE smp.scene_marker_id = scene_markers.id AND p.country = ?)", c)
			}
		case models.CriterionModifierEquals:
			clause := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM scene_marker_performers smp JOIN performers p ON p.id = smp.performer_id WHERE smp.scene_marker_id = scene_markers.id AND (p.country IS NULL OR TRIM(p.country) = '' OR p.country NOT IN (%s)))", placeholders)
			f.addWhere(clause, args...)
			f.addWhere(existsMarkerPerformer)
			for _, c := range countries {
				f.addWhere("EXISTS (SELECT 1 FROM scene_marker_performers smp JOIN performers p ON p.id = smp.performer_id WHERE smp.scene_marker_id = scene_markers.id AND p.country = ?)", c)
			}
		case models.CriterionModifierNotEquals:
			clause := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM scene_marker_performers smp JOIN performers p ON p.id = smp.performer_id WHERE smp.scene_marker_id = scene_markers.id AND p.country IN (%s))", placeholders)
			f.addWhere(clause, args...)
			f.addWhere(existsMarkerPerformer)
		default:
			clause := fmt.Sprintf("EXISTS (SELECT 1 FROM scene_marker_performers smp JOIN performers p ON p.id = smp.performer_id WHERE smp.scene_marker_id = scene_markers.id AND p.country IN (%s))", placeholders)
			f.addWhere(clause, args...)
			f.addWhere(existsMarkerPerformer)
		}
	}
}

// markerPerformerRatingCriterionHandler filters by rating of performers assigned directly to the marker
func (qb *sceneMarkerFilterHandler) markerPerformerRatingCriterionHandler(pr *models.IntCriterionInput, ratingAll *bool) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if pr == nil {
			return
		}

		// default to ALL performers must satisfy unless explicitly overridden
		modeAll := true
		if ratingAll != nil {
			modeAll = *ratingAll
		}

		existsMarkerPerformer := "EXISTS (SELECT 1 FROM scene_marker_performers smp WHERE smp.scene_marker_id = scene_markers.id)"

		if !modeAll {
			// ANY performer must satisfy: simple join + numeric comparison
			f.addInnerJoin("scene_marker_performers", "", "scene_marker_performers.scene_marker_id = scene_markers.id")
			f.addInnerJoin("performers", "marker_perf", "scene_marker_performers.performer_id = marker_perf.id")
			intCriterionHandler(pr, "marker_perf.rating", nil)(ctx, f)
			return
		}

		// ALL performers must satisfy: ensure no violating performer exists and at least one performer exists
		switch pr.Modifier {
		case models.CriterionModifierEquals:
			f.addWhere("NOT EXISTS (SELECT 1 FROM scene_marker_performers smp JOIN performers p ON p.id = smp.performer_id WHERE smp.scene_marker_id = scene_markers.id AND (p.rating IS NULL OR p.rating != ?))", pr.Value)
			f.addWhere(existsMarkerPerformer)
		case models.CriterionModifierNotEquals:
			f.addWhere("NOT EXISTS (SELECT 1 FROM scene_marker_performers smp JOIN performers p ON p.id = smp.performer_id WHERE smp.scene_marker_id = scene_markers.id AND p.rating = ?)", pr.Value)
			f.addWhere(existsMarkerPerformer)
		case models.CriterionModifierGreaterThan:
			f.addWhere("NOT EXISTS (SELECT 1 FROM scene_marker_performers smp JOIN performers p ON p.id = smp.performer_id WHERE smp.scene_marker_id = scene_markers.id AND (p.rating IS NULL OR p.rating <= ?))", pr.Value)
			f.addWhere(existsMarkerPerformer)
		case models.CriterionModifierLessThan:
			f.addWhere("NOT EXISTS (SELECT 1 FROM scene_marker_performers smp JOIN performers p ON p.id = smp.performer_id WHERE smp.scene_marker_id = scene_markers.id AND (p.rating IS NULL OR p.rating >= ?))", pr.Value)
			f.addWhere(existsMarkerPerformer)
		case models.CriterionModifierBetween:
			f.addWhere("NOT EXISTS (SELECT 1 FROM scene_marker_performers smp JOIN performers p ON p.id = smp.performer_id WHERE smp.scene_marker_id = scene_markers.id AND (p.rating IS NULL OR p.rating < ? OR p.rating > ?))", pr.Value, pr.Value2)
			f.addWhere(existsMarkerPerformer)
		case models.CriterionModifierNotBetween:
			f.addWhere("NOT EXISTS (SELECT 1 FROM scene_marker_performers smp JOIN performers p ON p.id = smp.performer_id WHERE smp.scene_marker_id = scene_markers.id AND (p.rating IS NULL OR (p.rating >= ? AND p.rating <= ?)))", pr.Value, pr.Value2)
			f.addWhere(existsMarkerPerformer)
		case models.CriterionModifierNotNull:
			f.addWhere("NOT EXISTS (SELECT 1 FROM scene_marker_performers smp JOIN performers p ON p.id = smp.performer_id WHERE smp.scene_marker_id = scene_markers.id AND p.rating IS NULL)")
			f.addWhere(existsMarkerPerformer)
		case models.CriterionModifierIsNull:
			f.addWhere("NOT EXISTS (SELECT 1 FROM scene_marker_performers smp JOIN performers p ON p.id = smp.performer_id WHERE smp.scene_marker_id = scene_markers.id AND p.rating IS NOT NULL)")
			f.addWhere(existsMarkerPerformer)
		default:
			f.addInnerJoin("scene_marker_performers", "", "scene_marker_performers.scene_marker_id = scene_markers.id")
			f.addInnerJoin("performers", "marker_perf", "scene_marker_performers.performer_id = marker_perf.id")
			intCriterionHandler(pr, "marker_perf.rating", nil)(ctx, f)
		}
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

// markerTagsWithPerformersCriterionHandler filters markers by tags with performer attributes
// This is similar to joinedSceneMarkerTagsHandler but operates directly on markers
func (qb *sceneMarkerFilterHandler) markerTagsWithPerformersCriterionHandler(input *models.SceneMarkerTagsCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if input == nil {
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

		switch input.Modifier {
		case models.CriterionModifierIsNull, models.CriterionModifierNotNull:
			var notClause string
			if input.Modifier == models.CriterionModifierNotNull {
				notClause = "NOT"
			}
			// Check presence/absence of marker tags
			f.addLeftJoin("scene_markers_tags", "", "scene_markers.id = scene_markers_tags.scene_marker_id")
			f.addWhere(fmt.Sprintf("scene_markers_tags.tag_id IS %s NULL", notClause))
			return

		case models.CriterionModifierEquals, models.CriterionModifierNotEquals:
			// Handle extended groups with performer attributes
			if len(input.GroupsExtended) > 0 {
				groupClauses := make([]string, 0, len(input.GroupsExtended))
				var allArgs []interface{}

				for _, g := range input.GroupsExtended {
					var groupConditions []string
					var groupArgs []interface{}

					// Expand tag IDs if depth is specified
					tagIDs := g.TagIDs
					depthUsed := len(tagIDs) > 0 && g.Depth != nil && *g.Depth != 0
					if depthUsed {
						valuesClause, err := getHierarchicalValues(ctx, tagIDs, tagTable, "tags_relations", "parent_id", "child_id", g.Depth)
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
							tagIDs = expandedIDs
						}
					}

					// Tag matching: when depth is used, marker must have ANY of the expanded tags (OR).
					// Otherwise, marker must have all specified tags (AND).
					// Check BOTH primary_tag_id AND secondary tags in scene_markers_tags
					if len(tagIDs) > 0 {
						if depthUsed {
							// OR semantics for expanded tags - marker matches if it has ANY of the tags
							ph := getInBinding(len(tagIDs))
							tagCond := fmt.Sprintf(`(
								scene_markers.primary_tag_id IN %s
								OR EXISTS (
									SELECT 1 FROM scene_markers_tags smt 
									WHERE smt.scene_marker_id = scene_markers.id 
									AND smt.tag_id IN %s
								)
							)`, ph, ph)
							groupConditions = append(groupConditions, tagCond)
							for _, tid := range tagIDs {
								groupArgs = append(groupArgs, tid)
							}
							for _, tid := range tagIDs {
								groupArgs = append(groupArgs, tid)
							}
						} else {
							// AND semantics - marker must have ALL specified tags
							for _, tagID := range tagIDs {
								tagCond := `(
									scene_markers.primary_tag_id = ?
									OR EXISTS (
										SELECT 1 FROM scene_markers_tags smt 
										WHERE smt.scene_marker_id = scene_markers.id 
										AND smt.tag_id = ?
									)
								)`
								groupConditions = append(groupConditions, tagCond)
								groupArgs = append(groupArgs, tagID, tagID)
							}
						}
					}

					// Exclude tags: marker must NOT have any of these tags (primary OR secondary)
					if len(g.ExcludeTagIDs) > 0 {
						ph := getInBinding(len(g.ExcludeTagIDs))
						excludeCond := fmt.Sprintf(`(
							scene_markers.primary_tag_id NOT IN %s
							AND NOT EXISTS (
								SELECT 1 FROM scene_markers_tags smt 
								WHERE smt.scene_marker_id = scene_markers.id 
								AND smt.tag_id IN %s
							)
						)`, ph, ph)
						groupConditions = append(groupConditions, excludeCond)
						// Add args twice - once for primary_tag_id check, once for secondary tags check
						for _, tid := range g.ExcludeTagIDs {
							groupArgs = append(groupArgs, tid)
						}
						for _, tid := range g.ExcludeTagIDs {
							groupArgs = append(groupArgs, tid)
						}
					}

					// Determine performer mode: AND or OR
					performerModeAnd := false
					if g.PerformerMode != nil && strings.EqualFold(*g.PerformerMode, "AND") {
						performerModeAnd = true
					}

					// Build role-specific conditions
					type roleCondition struct {
						clause string
						args   []interface{}
					}

					buildRoleCondition := func(role string, performerIDs []string, ethnicities []string, countries []string, rating *models.IntCriterionInput) *roleCondition {
						var clauses []string
						var args []interface{}

						// Base role condition
						baseClauses := []string{fmt.Sprintf("smp.role = '%s'", role)}

						if len(performerIDs) > 0 {
							ph := getInBinding(len(performerIDs))
							baseClauses = append(baseClauses, fmt.Sprintf("smp.performer_id IN %s", ph))
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

						if rating != nil {
							w, wargs := getIntWhereClause("p.rating", rating.Modifier, rating.Value, rating.Value2)
							baseClauses = append(baseClauses, w)
							args = append(args, wargs...)
						}

						clauses = append(clauses, "("+strings.Join(baseClauses, " AND ")+")")

						return &roleCondition{
							clause: strings.Join(clauses, " AND "),
							args:   args,
						}
					}

					var roleConditions []*roleCondition

					// Top conditions
					if len(g.TopPerformerIDs) > 0 || len(g.TopEthnicities) > 0 || len(g.TopCountries) > 0 || g.TopRating != nil {
						rc := buildRoleCondition("top", g.TopPerformerIDs, g.TopEthnicities, g.TopCountries, g.TopRating)
						if rc.clause != "" {
							roleConditions = append(roleConditions, rc)
						}
					}

					// Bottom conditions
					if len(g.BottomPerformerIDs) > 0 || len(g.BottomEthnicities) > 0 || len(g.BottomCountries) > 0 || g.BottomRating != nil {
						rc := buildRoleCondition("bottom", g.BottomPerformerIDs, g.BottomEthnicities, g.BottomCountries, g.BottomRating)
						if rc.clause != "" {
							roleConditions = append(roleConditions, rc)
						}
					}

					// Both-roles conditions
					if len(g.BothRolesPerformerIDs) > 0 || len(g.BothRolesEthnicities) > 0 || len(g.BothRolesCountries) > 0 || g.BothRolesRating != nil {
						// For "both", we need a performer who appears as BOTH top AND bottom
						// Use top role for the EXISTS check, then verify same performer also has bottom role
						var bothClauses []string
						var bothArgs []interface{}

						baseClause := "smp.role = 'top'"
						bothClauses = append(bothClauses, baseClause)

						if len(g.BothRolesPerformerIDs) > 0 {
							ph := getInBinding(len(g.BothRolesPerformerIDs))
							bothClauses = append(bothClauses, fmt.Sprintf("smp.performer_id IN %s", ph))
							for _, pid := range g.BothRolesPerformerIDs {
								bothArgs = append(bothArgs, pid)
							}
						}

						if len(g.BothRolesEthnicities) > 0 {
							expanded := expandEthnicities(g.BothRolesEthnicities)
							ph := getInBinding(len(expanded))
							bothClauses = append(bothClauses, fmt.Sprintf("p.ethnicity IN %s", ph))
							for _, e := range expanded {
								bothArgs = append(bothArgs, e)
							}
						}

						if len(g.BothRolesCountries) > 0 {
							ph := getInBinding(len(g.BothRolesCountries))
							bothClauses = append(bothClauses, fmt.Sprintf("p.country IN %s", ph))
							for _, c := range g.BothRolesCountries {
								bothArgs = append(bothArgs, c)
							}
						}

						if g.BothRolesRating != nil {
							w, wargs := getIntWhereClause("p.rating", g.BothRolesRating.Modifier, g.BothRolesRating.Value, g.BothRolesRating.Value2)
							bothClauses = append(bothClauses, w)
							bothArgs = append(bothArgs, wargs...)
						}

						// Add condition that same performer also has bottom role on this marker
						bothClauses = append(bothClauses, `EXISTS (
							SELECT 1 FROM scene_marker_performers smp2 
							WHERE smp2.scene_marker_id = scene_markers.id 
							AND smp2.performer_id = smp.performer_id 
							AND smp2.role = 'bottom'
						)`)

						roleConditions = append(roleConditions, &roleCondition{
							clause: "(" + strings.Join(bothClauses, " AND ") + ")",
							args:   bothArgs,
						})
					}

					// Build the performer EXISTS clause if we have role conditions
					if len(roleConditions) > 0 {
						var roleClauses []string
						var roleArgs []interface{}

						for _, rc := range roleConditions {
							roleClauses = append(roleClauses, rc.clause)
							roleArgs = append(roleArgs, rc.args...)
						}

						var roleWhere string
						if performerModeAnd && len(roleClauses) > 1 {
							// AND mode: each role condition must be satisfied (by possibly different performers)
							for _, rc := range roleConditions {
								existsClause := fmt.Sprintf(`EXISTS (
									SELECT 1 FROM scene_marker_performers smp 
									JOIN performers p ON p.id = smp.performer_id 
									WHERE smp.scene_marker_id = scene_markers.id 
									AND %s
								)`, rc.clause)
								groupConditions = append(groupConditions, existsClause)
								groupArgs = append(groupArgs, rc.args...)
							}
						} else {
							// OR mode: any role condition can match
							roleWhere = strings.Join(roleClauses, " OR ")
							existsClause := fmt.Sprintf(`EXISTS (
								SELECT 1 FROM scene_marker_performers smp 
								JOIN performers p ON p.id = smp.performer_id 
								WHERE smp.scene_marker_id = scene_markers.id 
								AND (%s)
							)`, roleWhere)
							groupConditions = append(groupConditions, existsClause)
							groupArgs = append(groupArgs, roleArgs...)
						}
					}

					if len(groupConditions) > 0 {
						groupClause := "(" + strings.Join(groupConditions, " AND ") + ")"
						groupClauses = append(groupClauses, groupClause)
						allArgs = append(allArgs, groupArgs...)
					}
				}

				if len(groupClauses) > 0 {
					var finalClause string
					if input.Modifier == models.CriterionModifierEquals {
						// IS: at least one group must match
						finalClause = "(" + strings.Join(groupClauses, " OR ") + ")"
					} else {
						// IS NOT: none of the groups should match
						finalClause = "NOT (" + strings.Join(groupClauses, " OR ") + ")"
					}
					f.addWhere(finalClause, allArgs...)
				}
			} else if len(input.Groups) > 0 {
				// Handle simple groups (just tag IDs)
				groupClauses := make([]string, 0, len(input.Groups))
				var allArgs []interface{}

				for _, tagGroup := range input.Groups {
					if len(tagGroup) == 0 {
						continue
					}
					// All tags in this group must be present on the marker
					var tagConditions []string
					for _, tagID := range tagGroup {
						tagCond := `EXISTS (
							SELECT 1 FROM scene_markers_tags smt 
							WHERE smt.scene_marker_id = scene_markers.id 
							AND smt.tag_id = ?
						)`
						tagConditions = append(tagConditions, tagCond)
						allArgs = append(allArgs, tagID)
					}
					groupClauses = append(groupClauses, "("+strings.Join(tagConditions, " AND ")+")")
				}

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

		case models.CriterionModifierIncludes, models.CriterionModifierIncludesAll:
			// Simple tag inclusion - marker must have any/all of these tags
			if len(input.Value) == 0 {
				return
			}

			if input.Modifier == models.CriterionModifierIncludes {
				// Any of the tags
				ph := getInBinding(len(input.Value))
				clause := fmt.Sprintf(`EXISTS (
					SELECT 1 FROM scene_markers_tags smt 
					WHERE smt.scene_marker_id = scene_markers.id 
					AND smt.tag_id IN %s
				)`, ph)
				args := make([]interface{}, len(input.Value))
				for i, v := range input.Value {
					args[i] = v
				}
				f.addWhere(clause, args...)
			} else {
				// All of the tags
				for _, tagID := range input.Value {
					clause := `EXISTS (
						SELECT 1 FROM scene_markers_tags smt 
						WHERE smt.scene_marker_id = scene_markers.id 
						AND smt.tag_id = ?
					)`
					f.addWhere(clause, tagID)
				}
			}

		case models.CriterionModifierExcludes:
			// Marker must not have any of these tags
			if len(input.Value) == 0 {
				return
			}
			ph := getInBinding(len(input.Value))
			clause := fmt.Sprintf(`NOT EXISTS (
				SELECT 1 FROM scene_markers_tags smt 
				WHERE smt.scene_marker_id = scene_markers.id 
				AND smt.tag_id IN %s
			)`, ph)
			args := make([]interface{}, len(input.Value))
			for i, v := range input.Value {
				args[i] = v
			}
			f.addWhere(clause, args...)
		}
	}
}
