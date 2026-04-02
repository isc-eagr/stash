package sqlite

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
		// Marker length filter: uses COALESCE to treat NULL end_seconds as 20 seconds
		intCriterionHandler(sceneMarkerFilter.MarkerLength, "CAST(COALESCE(scene_markers.end_seconds - scene_markers.seconds, 20) AS INTEGER)", nil),
		// Scene performer count filter: counts performers on the marker's scene
		qb.scenePerformerCountCriterionHandler(sceneMarkerFilter.ScenePerformerCount),
		&timestampCriterionHandler{sceneMarkerFilter.CreatedAt, "scene_markers.created_at", nil},
		&timestampCriterionHandler{sceneMarkerFilter.UpdatedAt, "scene_markers.updated_at", nil},
		&dateCriterionHandler{sceneMarkerFilter.SceneDate, "scenes.date", qb.joinScenes},
		&timestampCriterionHandler{sceneMarkerFilter.SceneCreatedAt, "scenes.created_at", qb.joinScenes},
		&timestampCriterionHandler{sceneMarkerFilter.SceneUpdatedAt, "scenes.updated_at", qb.joinScenes},

		// Marker performer filters (performers assigned directly to the marker via scene_marker_performers)
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
		// Custom scene marker filters
		qb.customFiltersCriterionHandler(sceneMarkerFilter.CustomFilters),
		// Has roles filter (tops/bottoms)
		qb.hasRolesCriterionHandler(sceneMarkerFilter.HasRoles),
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
				// We need to verify that there are N distinct performers where each one
				// matches at least one of the slot criteria
				if len(g.TopUnnamedPerformers) > 1 {
					// Build a UNION of all performers matching each slot's criteria
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

					// Count distinct performers across all slots - must have at least N
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
				// and each matches its slot's criteria
				if len(g.BottomUnnamedPerformers) > 1 {
					// Build a UNION of SELECTs, one per slot, each with its criteria
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
				// and each matches its slot's criteria
				if len(g.BothRolesUnnamedPerformers) > 1 {
					// Build a UNION of SELECTs, one per slot, each with its criteria
					// Each performer must be both top AND bottom for this marker
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

						// Build the criteria clause
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
			// Ensure unnamed performers in different roles (top vs bottom) are DISTINCT performers
			// This prevents the same performer from matching both a top slot AND a bottom slot
			totalUnnamedSlots := len(g.TopUnnamedPerformers) + len(g.BottomUnnamedPerformers)
			if totalUnnamedSlots > 1 && len(g.TopUnnamedPerformers) > 0 && len(g.BottomUnnamedPerformers) > 0 {
				// Build a UNION of all top and bottom unnamed performer slots
				// Each slot contributes its criteria, and we count total distinct performers
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

				// Count distinct performers across all slots
				crossRoleCountCond := fmt.Sprintf(`(SELECT COUNT(*) FROM (%s) AS cross_role_union) >= %d`,
					strings.Join(allUnionParts, " UNION "), totalUnnamedSlots)
				performerConditions = append(performerConditions, crossRoleCountCond)
				performerArgs = append(performerArgs, allCountArgs...)
			}

			// Combine all conditions for this group
			// Tags are always AND, performers use performerMode (AND or OR)
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
					// OR mode: any performer condition can match
					perfClause := "(" + strings.Join(performerConditions, " OR ") + ")"
					allConditions = append(allConditions, perfClause)
				} else {
					// AND mode: all performer conditions must match
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
				// NOT_EQUALS: none of the groups should match
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
