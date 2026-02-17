package sqlite

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/stashapp/stash/pkg/logger"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/utils"
)

type performerFilterHandler struct {
	performerFilter *models.PerformerFilterType
}

func (qb *performerFilterHandler) validate() error {
	filter := qb.performerFilter
	if filter == nil {
		return nil
	}

	if err := validateFilterCombination(filter.OperatorFilter); err != nil {
		return err
	}

	if subFilter := filter.SubFilter(); subFilter != nil {
		sqb := &performerFilterHandler{performerFilter: subFilter}
		if err := sqb.validate(); err != nil {
			return err
		}
	}

	// if legacy height filter used, ensure only supported modifiers are used
	if filter.Height != nil {
		// treat as an int filter
		intCrit := &models.IntCriterionInput{
			Modifier: filter.Height.Modifier,
		}
		if !intCrit.ValidModifier() {
			return fmt.Errorf("invalid height modifier: %s", filter.Height.Modifier)
		}

		// ensure value is a valid number
		if _, err := strconv.Atoi(filter.Height.Value); err != nil {
			return fmt.Errorf("invalid height value: %s", filter.Height.Value)
		}
	}

	return nil
}

func (qb *performerFilterHandler) handle(ctx context.Context, f *filterBuilder) {
	filter := qb.performerFilter
	if filter == nil {
		return
	}

	if err := qb.validate(); err != nil {
		f.setError(err)
		return
	}

	sf := filter.SubFilter()
	if sf != nil {
		sub := &performerFilterHandler{sf}
		handleSubFilter(ctx, sub, f, filter.OperatorFilter)
	}

	f.handleCriterion(ctx, qb.criterionHandler())
}

func (qb *performerFilterHandler) criterionHandler() criterionHandler {
	filter := qb.performerFilter
	const tableName = performerTable
	heightCmCrit := filter.HeightCm

	return compoundHandler{
		stringCriterionHandler(filter.Name, tableName+".name"),
		stringCriterionHandler(filter.Disambiguation, tableName+".disambiguation"),
		stringCriterionHandler(filter.Details, tableName+".details"),

		boolCriterionHandler(filter.FilterFavorites, tableName+".favorite", nil),
		boolCriterionHandler(filter.IgnoreAutoTag, tableName+".ignore_auto_tag", nil),

		yearFilterCriterionHandler(filter.BirthYear, tableName+".birthdate"),
		yearFilterCriterionHandler(filter.DeathYear, tableName+".death_date"),

		qb.performerAgeFilterCriterionHandler(filter.Age),

		criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
			if gender := filter.Gender; gender != nil {
				genderCopy := *gender
				if genderCopy.Value.IsValid() && len(genderCopy.ValueList) == 0 {
					genderCopy.ValueList = []models.GenderEnum{genderCopy.Value}
				}

				v := utils.StringerSliceToStringSlice(genderCopy.ValueList)
				enumCriterionHandler(genderCopy.Modifier, v, tableName+".gender")(ctx, f)
			}
		}),

		qb.performerIsMissingCriterionHandler(filter.IsMissing),
		stringCriterionHandler(filter.Ethnicity, tableName+".ethnicity"),
		stringCriterionHandler(filter.Country, tableName+".country"),
		stringCriterionHandler(filter.EyeColor, tableName+".eye_color"),

		// special handler for legacy height filter
		criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
			if heightCmCrit == nil && filter.Height != nil {
				heightCm, _ := strconv.Atoi(filter.Height.Value) // already validated
				heightCmCrit = &models.IntCriterionInput{
					Value:    heightCm,
					Modifier: filter.Height.Modifier,
				}
			}
		}),

		intCriterionHandler(heightCmCrit, tableName+".height", nil),

		stringCriterionHandler(filter.Measurements, tableName+".measurements"),
		stringCriterionHandler(filter.FakeTits, tableName+".fake_tits"),
		floatCriterionHandler(filter.PenisLength, tableName+".penis_length", nil),

		criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
			if circumcised := filter.Circumcised; circumcised != nil {
				v := utils.StringerSliceToStringSlice(circumcised.Value)
				enumCriterionHandler(circumcised.Modifier, v, tableName+".circumcised")(ctx, f)
			}
		}),

		stringCriterionHandler(filter.CareerLength, tableName+".career_length"),
		stringCriterionHandler(filter.Tattoos, tableName+".tattoos"),
		stringCriterionHandler(filter.Piercings, tableName+".piercings"),
		intCriterionHandler(filter.Rating100, tableName+".rating", nil),
		stringCriterionHandler(filter.HairColor, tableName+".hair_color"),
		qb.urlsCriterionHandler(filter.URL),
		intCriterionHandler(filter.Weight, tableName+".weight", nil),
		criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
			if filter.StashID != nil {
				performerRepository.stashIDs.join(f, "performer_stash_ids", "performers.id")
				stringCriterionHandler(filter.StashID, "performer_stash_ids.stash_id")(ctx, f)
			}
		}),
		&stashIDCriterionHandler{
			c:                 filter.StashIDEndpoint,
			stashIDRepository: &performerRepository.stashIDs,
			stashIDTableAs:    "performer_stash_ids",
			parentIDCol:       "performers.id",
		},

		qb.aliasCriterionHandler(filter.Aliases),

		qb.tagsCriterionHandler(filter.Tags),

		qb.markerTagsCriterionHandler(filter.MarkerTags),

		qb.studiosCriterionHandler(filter.Studios),

		qb.groupsCriterionHandler(filter.Groups),

		qb.appearsWithCriterionHandler(filter.Performers),

		qb.tagCountCriterionHandler(filter.TagCount),
		qb.sceneCountCriterionHandler(filter.SceneCount),
		qb.imageCountCriterionHandler(filter.ImageCount),
		qb.profileImageCountCriterionHandler(filter.ProfileImageCount),
		qb.galleryCountCriterionHandler(filter.GalleryCount),
		qb.playCounterCriterionHandler(filter.PlayCount),
		qb.oCounterCriterionHandler(filter.OCounter),
		&dateCriterionHandler{filter.Birthdate, tableName + ".birthdate", nil},
		&dateCriterionHandler{filter.DeathDate, tableName + ".death_date", nil},
		&timestampCriterionHandler{filter.CreatedAt, tableName + ".created_at", nil},
		&timestampCriterionHandler{filter.UpdatedAt, tableName + ".updated_at", nil},

		&relatedFilterHandler{
			relatedIDCol:   "performers_scenes.scene_id",
			relatedRepo:    sceneRepository.repository,
			relatedHandler: &sceneFilterHandler{filter.ScenesFilter},
			joinFn: func(f *filterBuilder) {
				performerRepository.scenes.innerJoin(f, "", "performers.id")
			},
		},

		&relatedFilterHandler{
			relatedIDCol:   "performers_images.image_id",
			relatedRepo:    imageRepository.repository,
			relatedHandler: &imageFilterHandler{filter.ImagesFilter},
			joinFn: func(f *filterBuilder) {
				performerRepository.images.innerJoin(f, "", "performers.id")
			},
		},

		&relatedFilterHandler{
			relatedIDCol:   "performers_galleries.gallery_id",
			relatedRepo:    galleryRepository.repository,
			relatedHandler: &galleryFilterHandler{filter.GalleriesFilter},
			joinFn: func(f *filterBuilder) {
				performerRepository.galleries.innerJoin(f, "", "performers.id")
			},
		},

		&relatedFilterHandler{
			relatedIDCol:   "performer_tag.tag_id",
			relatedRepo:    tagRepository.repository,
			relatedHandler: &tagFilterHandler{filter.TagsFilter},
			joinFn: func(f *filterBuilder) {
				performerRepository.tags.innerJoin(f, "performer_tag", "performers.id")
			},
		},

		&customFieldsFilterHandler{
			table: performersCustomFieldsTable.GetTable(),
			fkCol: performerIDColumn,
			c:     filter.CustomFields,
			idCol: "performers.id",
		},

		qb.hasMarkersCriterionHandler(filter.HasMarkers),

		qb.customFiltersCriterionHandler(filter.CustomFilters),

		qb.sceneTypeCriterionHandler(filter.SceneType),

		qb.performerMarkersCriterionHandler(filter.PerformerMarkers),

		qb.performerMarkerTagsCriterionHandler(filter.PerformerMarkerTags),

		qb.performerMarkerPartnersCriterionHandler(filter.PerformerMarkerPartners),
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
func (qb *performerFilterHandler) customFiltersCriterionHandler(customFilters *models.CustomPerformerFilterInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if customFilters == nil || customFilters.Type == "" {
			return
		}

		// Get tag IDs from the input (these come from roleTagIds in the UI config)
		sexTagID := ""
		oralTagID := ""
		facialTagID := ""
		if customFilters.SexTagID != nil {
			sexTagID = *customFilters.SexTagID
		}
		if customFilters.OralTagID != nil {
			oralTagID = *customFilters.OralTagID
		}
		if customFilters.FacialTagID != nil {
			facialTagID = *customFilters.FacialTagID
		}

		// If required tag IDs are not provided, log and return
		if sexTagID == "" {
			logger.Debug("customFiltersCriterionHandler: sexTagID is required but not provided")
			return
		}

		// Helper function to create CTE for a tag and its descendants
		tagFamilyCTE := func(cteName, tagID string) string {
			return fmt.Sprintf(`WITH RECURSIVE %s(id) AS (
				SELECT id FROM tags WHERE id = %s
				UNION ALL
				SELECT tr.child_id FROM tags_relations tr JOIN %s tf ON tr.parent_id = tf.id
			)`, cteName, tagID, cteName)
		}

		// Helper to create tag match condition (primary or secondary)
		tagMatchCondition := func(cteName string) string {
			return fmt.Sprintf(`(sm.primary_tag_id IN (SELECT id FROM %s) OR EXISTS (SELECT 1 FROM scene_markers_tags smt WHERE smt.scene_marker_id = sm.id AND smt.tag_id IN (SELECT id FROM %s)))`, cteName, cteName)
		}

		sexTagsCTE := tagFamilyCTE("sex_tags", sexTagID)

		switch customFilters.Type {
		case "strict_tops":
			// Zero sexTagId/oralTagId/facialTagId as bottom, at least one sexTagId as top
			var conditions []string

			// Must have at least one sex tag as top
			conditions = append(conditions, fmt.Sprintf(`
				EXISTS (
					%s
					SELECT 1 FROM scene_marker_performers smp
					JOIN scene_markers sm ON sm.id = smp.scene_marker_id
					WHERE smp.performer_id = performers.id
					  AND smp.role = 'top'
					  AND %s
				)`, sexTagsCTE, tagMatchCondition("sex_tags")))

			// Must NOT have sex tag as bottom
			conditions = append(conditions, fmt.Sprintf(`
				NOT EXISTS (
					%s
					SELECT 1 FROM scene_marker_performers smp
					JOIN scene_markers sm ON sm.id = smp.scene_marker_id
					WHERE smp.performer_id = performers.id
					  AND smp.role = 'bottom'
					  AND %s
				)`, sexTagsCTE, tagMatchCondition("sex_tags")))

			// Must NOT have oral tag as bottom (if provided)
			if oralTagID != "" {
				oralTagsCTE := tagFamilyCTE("oral_tags", oralTagID)
				conditions = append(conditions, fmt.Sprintf(`
					NOT EXISTS (
						%s
						SELECT 1 FROM scene_marker_performers smp
						JOIN scene_markers sm ON sm.id = smp.scene_marker_id
						WHERE smp.performer_id = performers.id
						  AND smp.role = 'bottom'
						  AND %s
					)`, oralTagsCTE, tagMatchCondition("oral_tags")))
			}

			// Must NOT have facial tag as bottom (if provided)
			if facialTagID != "" {
				facialTagsCTE := tagFamilyCTE("facial_tags", facialTagID)
				conditions = append(conditions, fmt.Sprintf(`
					NOT EXISTS (
						%s
						SELECT 1 FROM scene_marker_performers smp
						JOIN scene_markers sm ON sm.id = smp.scene_marker_id
						WHERE smp.performer_id = performers.id
						  AND smp.role = 'bottom'
						  AND %s
					)`, facialTagsCTE, tagMatchCondition("facial_tags")))
			}

			f.addWhere(strings.Join(conditions, " AND "))

		case "lenient_tops":
			// At least one sexTagId as top, zero sexTagId as bottom, at least one oralTagId or facialTagId as bottom
			var conditions []string

			// Must have at least one sex tag as top
			conditions = append(conditions, fmt.Sprintf(`
				EXISTS (
					%s
					SELECT 1 FROM scene_marker_performers smp
					JOIN scene_markers sm ON sm.id = smp.scene_marker_id
					WHERE smp.performer_id = performers.id
					  AND smp.role = 'top'
					  AND %s
				)`, sexTagsCTE, tagMatchCondition("sex_tags")))

			// Must NOT have sex tag as bottom
			conditions = append(conditions, fmt.Sprintf(`
				NOT EXISTS (
					%s
					SELECT 1 FROM scene_marker_performers smp
					JOIN scene_markers sm ON sm.id = smp.scene_marker_id
					WHERE smp.performer_id = performers.id
					  AND smp.role = 'bottom'
					  AND %s
				)`, sexTagsCTE, tagMatchCondition("sex_tags")))

			// Must have at least one oral OR facial tag as bottom
			var orConditions []string
			if oralTagID != "" {
				oralTagsCTE := tagFamilyCTE("oral_tags", oralTagID)
				orConditions = append(orConditions, fmt.Sprintf(`
					EXISTS (
						%s
						SELECT 1 FROM scene_marker_performers smp
						JOIN scene_markers sm ON sm.id = smp.scene_marker_id
						WHERE smp.performer_id = performers.id
						  AND smp.role = 'bottom'
						  AND %s
					)`, oralTagsCTE, tagMatchCondition("oral_tags")))
			}
			if facialTagID != "" {
				facialTagsCTE := tagFamilyCTE("facial_tags", facialTagID)
				orConditions = append(orConditions, fmt.Sprintf(`
					EXISTS (
						%s
						SELECT 1 FROM scene_marker_performers smp
						JOIN scene_markers sm ON sm.id = smp.scene_marker_id
						WHERE smp.performer_id = performers.id
						  AND smp.role = 'bottom'
						  AND %s
					)`, facialTagsCTE, tagMatchCondition("facial_tags")))
			}
			if len(orConditions) > 0 {
				conditions = append(conditions, "("+strings.Join(orConditions, " OR ")+")")
			}

			f.addWhere(strings.Join(conditions, " AND "))

		case "strict_bottoms":
			// Zero sexTagId/oralTagId/facialTagId as top, at least one sexTagId as bottom
			var conditions []string

			// Must have at least one sex tag as bottom
			conditions = append(conditions, fmt.Sprintf(`
				EXISTS (
					%s
					SELECT 1 FROM scene_marker_performers smp
					JOIN scene_markers sm ON sm.id = smp.scene_marker_id
					WHERE smp.performer_id = performers.id
					  AND smp.role = 'bottom'
					  AND %s
				)`, sexTagsCTE, tagMatchCondition("sex_tags")))

			// Must NOT have sex tag as top
			conditions = append(conditions, fmt.Sprintf(`
				NOT EXISTS (
					%s
					SELECT 1 FROM scene_marker_performers smp
					JOIN scene_markers sm ON sm.id = smp.scene_marker_id
					WHERE smp.performer_id = performers.id
					  AND smp.role = 'top'
					  AND %s
				)`, sexTagsCTE, tagMatchCondition("sex_tags")))

			// Must NOT have oral tag as top (if provided)
			if oralTagID != "" {
				oralTagsCTE := tagFamilyCTE("oral_tags", oralTagID)
				conditions = append(conditions, fmt.Sprintf(`
					NOT EXISTS (
						%s
						SELECT 1 FROM scene_marker_performers smp
						JOIN scene_markers sm ON sm.id = smp.scene_marker_id
						WHERE smp.performer_id = performers.id
						  AND smp.role = 'top'
						  AND %s
					)`, oralTagsCTE, tagMatchCondition("oral_tags")))
			}

			// Must NOT have facial tag as top (if provided)
			if facialTagID != "" {
				facialTagsCTE := tagFamilyCTE("facial_tags", facialTagID)
				conditions = append(conditions, fmt.Sprintf(`
					NOT EXISTS (
						%s
						SELECT 1 FROM scene_marker_performers smp
						JOIN scene_markers sm ON sm.id = smp.scene_marker_id
						WHERE smp.performer_id = performers.id
						  AND smp.role = 'top'
						  AND %s
					)`, facialTagsCTE, tagMatchCondition("facial_tags")))
			}

			f.addWhere(strings.Join(conditions, " AND "))

		case "lenient_bottoms":
			// At least one sexTagId as bottom, zero sexTagId as top, at least one oralTagId or facialTagId as top
			var conditions []string

			// Must have at least one sex tag as bottom
			conditions = append(conditions, fmt.Sprintf(`
				EXISTS (
					%s
					SELECT 1 FROM scene_marker_performers smp
					JOIN scene_markers sm ON sm.id = smp.scene_marker_id
					WHERE smp.performer_id = performers.id
					  AND smp.role = 'bottom'
					  AND %s
				)`, sexTagsCTE, tagMatchCondition("sex_tags")))

			// Must NOT have sex tag as top
			conditions = append(conditions, fmt.Sprintf(`
				NOT EXISTS (
					%s
					SELECT 1 FROM scene_marker_performers smp
					JOIN scene_markers sm ON sm.id = smp.scene_marker_id
					WHERE smp.performer_id = performers.id
					  AND smp.role = 'top'
					  AND %s
				)`, sexTagsCTE, tagMatchCondition("sex_tags")))

			// Must have at least one oral OR facial tag as top
			var orConditions []string
			if oralTagID != "" {
				oralTagsCTE := tagFamilyCTE("oral_tags", oralTagID)
				orConditions = append(orConditions, fmt.Sprintf(`
					EXISTS (
						%s
						SELECT 1 FROM scene_marker_performers smp
						JOIN scene_markers sm ON sm.id = smp.scene_marker_id
						WHERE smp.performer_id = performers.id
						  AND smp.role = 'top'
						  AND %s
					)`, oralTagsCTE, tagMatchCondition("oral_tags")))
			}
			if facialTagID != "" {
				facialTagsCTE := tagFamilyCTE("facial_tags", facialTagID)
				orConditions = append(orConditions, fmt.Sprintf(`
					EXISTS (
						%s
						SELECT 1 FROM scene_marker_performers smp
						JOIN scene_markers sm ON sm.id = smp.scene_marker_id
						WHERE smp.performer_id = performers.id
						  AND smp.role = 'top'
						  AND %s
					)`, facialTagsCTE, tagMatchCondition("facial_tags")))
			}
			if len(orConditions) > 0 {
				conditions = append(conditions, "("+strings.Join(orConditions, " OR ")+")")
			}

			f.addWhere(strings.Join(conditions, " AND "))
		}
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

// TODO - we need to provide a whitelist of possible values
func (qb *performerFilterHandler) performerIsMissingCriterionHandler(isMissing *string) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if isMissing != nil && *isMissing != "" {
			switch *isMissing {
			case "url":
				performersURLsTableMgr.join(f, "", "performers.id")
				f.addWhere("performer_urls.url IS NULL")
			case "scenes": // Deprecated: use `scene_count == 0` filter instead
				f.addLeftJoin(performersScenesTable, "scenes_join", "scenes_join.performer_id = performers.id")
				f.addWhere("scenes_join.scene_id IS NULL")
			case "image":
				f.addWhere("performers.image_blob IS NULL")
			case "stash_id":
				performersStashIDsTableMgr.join(f, "performer_stash_ids", "performers.id")
				f.addWhere("performer_stash_ids.performer_id IS NULL")
			case "aliases":
				performersAliasesTableMgr.join(f, "", "performers.id")
				f.addWhere("performer_aliases.alias IS NULL")
			default:
				f.addWhere("(performers." + *isMissing + " IS NULL OR TRIM(performers." + *isMissing + ") = '')")
			}
		}
	}
}

func (qb *performerFilterHandler) performerAgeFilterCriterionHandler(age *models.IntCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if age != nil && age.Modifier.IsValid() {
			clause, args := getIntCriterionWhereClause(
				"cast(IFNULL(strftime('%Y.%m%d', performers.death_date), strftime('%Y.%m%d', 'now')) - strftime('%Y.%m%d', performers.birthdate) as int)",
				*age,
			)
			f.addWhere(clause, args...)
		}
	}
}

func (qb *performerFilterHandler) urlsCriterionHandler(url *models.StringCriterionInput) criterionHandlerFunc {
	h := stringListCriterionHandlerBuilder{
		primaryTable: performerTable,
		primaryFK:    performerIDColumn,
		joinTable:    performerURLsTable,
		stringColumn: performerURLColumn,
		addJoinTable: func(f *filterBuilder) {
			performersURLsTableMgr.join(f, "", "performers.id")
		},
	}

	return h.handler(url)
}

func (qb *performerFilterHandler) aliasCriterionHandler(alias *models.StringCriterionInput) criterionHandlerFunc {
	h := stringListCriterionHandlerBuilder{
		primaryTable: performerTable,
		primaryFK:    performerIDColumn,
		joinTable:    performersAliasesTable,
		stringColumn: performerAliasColumn,
		addJoinTable: func(f *filterBuilder) {
			performersAliasesTableMgr.join(f, "", "performers.id")
		},
	}

	return h.handler(alias)
}

func (qb *performerFilterHandler) tagsCriterionHandler(tags *models.HierarchicalMultiCriterionInput) criterionHandlerFunc {
	h := joinedHierarchicalMultiCriterionHandlerBuilder{
		primaryTable: performerTable,
		foreignTable: tagTable,
		foreignFK:    "tag_id",

		relationsTable: "tags_relations",
		joinAs:         "performer_tag",
		joinTable:      performersTagsTable,
		primaryFK:      performerIDColumn,
	}

	return h.handler(tags)
}

func (qb *performerFilterHandler) tagCountCriterionHandler(count *models.IntCriterionInput) criterionHandlerFunc {
	h := countCriterionHandlerBuilder{
		primaryTable: performerTable,
		joinTable:    performersTagsTable,
		primaryFK:    performerIDColumn,
	}

	return h.handler(count)
}

func (qb *performerFilterHandler) sceneCountCriterionHandler(count *models.IntCriterionInput) criterionHandlerFunc {
	h := countCriterionHandlerBuilder{
		primaryTable: performerTable,
		joinTable:    performersScenesTable,
		primaryFK:    performerIDColumn,
	}

	return h.handler(count)
}

func (qb *performerFilterHandler) imageCountCriterionHandler(count *models.IntCriterionInput) criterionHandlerFunc {
	h := countCriterionHandlerBuilder{
		primaryTable: performerTable,
		joinTable:    performersImagesTable,
		primaryFK:    performerIDColumn,
	}

	return h.handler(count)
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

func (qb *performerFilterHandler) galleryCountCriterionHandler(count *models.IntCriterionInput) criterionHandlerFunc {
	h := countCriterionHandlerBuilder{
		primaryTable: performerTable,
		joinTable:    performersGalleriesTable,
		primaryFK:    performerIDColumn,
	}

	return h.handler(count)
}

// used for sorting and filtering on performer o-count
var selectPerformerOCountSQL = utils.StrFormat(
	"SELECT SUM(o_counter) "+
		"FROM ("+
		"SELECT SUM(o_counter) as o_counter from {performers_images} s "+
		"LEFT JOIN {images} ON {images}.id = s.{images_id} "+
		"WHERE s.{performer_id} = {performers}.id "+
		"UNION ALL "+
		"SELECT COUNT({scenes_o_dates}.{o_date}) as o_counter from {performers_scenes} s "+
		"LEFT JOIN {scenes} ON {scenes}.id = s.{scene_id} "+
		"LEFT JOIN {scenes_o_dates} ON {scenes_o_dates}.{scene_id} = {scenes}.id "+
		"WHERE s.{performer_id} = {performers}.id "+
		")",
	map[string]interface{}{
		"performers_images": performersImagesTable,
		"images":            imageTable,
		"performer_id":      performerIDColumn,
		"images_id":         imageIDColumn,
		"performers":        performerTable,
		"performers_scenes": performersScenesTable,
		"scenes":            sceneTable,
		"scene_id":          sceneIDColumn,
		"scenes_o_dates":    scenesODatesTable,
		"o_date":            sceneODateColumn,
	},
)

// used for sorting and filtering play count on performer view count
var selectPerformerPlayCountSQL = utils.StrFormat(
	"SELECT COUNT(DISTINCT {view_date}) FROM ("+
		"SELECT {view_date} FROM {performers_scenes} s "+
		"LEFT JOIN {scenes} ON {scenes}.id = s.{scene_id} "+
		"LEFT JOIN {scenes_view_dates} ON {scenes_view_dates}.{scene_id} = {scenes}.id "+
		"WHERE s.{performer_id} = {performers}.id"+
		")",
	map[string]interface{}{
		"performer_id":      performerIDColumn,
		"performers":        performerTable,
		"performers_scenes": performersScenesTable,
		"scenes":            sceneTable,
		"scene_id":          sceneIDColumn,
		"scenes_view_dates": scenesViewDatesTable,
		"view_date":         sceneViewDateColumn,
	},
)

func (qb *performerFilterHandler) oCounterCriterionHandler(count *models.IntCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if count == nil {
			return
		}

		lhs := "(" + selectPerformerOCountSQL + ")"
		clause, args := getIntCriterionWhereClause(lhs, *count)

		f.addWhere(clause, args...)
	}
}

func (qb *performerFilterHandler) playCounterCriterionHandler(count *models.IntCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if count == nil {
			return
		}

		lhs := "(" + selectPerformerPlayCountSQL + ")"
		clause, args := getIntCriterionWhereClause(lhs, *count)

		f.addWhere(clause, args...)
	}
}

func (qb *performerFilterHandler) studiosCriterionHandler(studios *models.HierarchicalMultiCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if studios != nil {
			formatMaps := []utils.StrFormatMap{
				{
					"primaryTable": sceneTable,
					"joinTable":    performersScenesTable,
					"primaryFK":    sceneIDColumn,
				},
				{
					"primaryTable": imageTable,
					"joinTable":    performersImagesTable,
					"primaryFK":    imageIDColumn,
				},
				{
					"primaryTable": galleryTable,
					"joinTable":    performersGalleriesTable,
					"primaryFK":    galleryIDColumn,
				},
			}

			if studios.Modifier == models.CriterionModifierIsNull || studios.Modifier == models.CriterionModifierNotNull {
				var notClause string
				if studios.Modifier == models.CriterionModifierNotNull {
					notClause = "NOT"
				}

				var conditions []string
				for _, c := range formatMaps {
					f.addLeftJoin(c["joinTable"].(string), "", fmt.Sprintf("%s.performer_id = performers.id", c["joinTable"]))
					f.addLeftJoin(c["primaryTable"].(string), "", fmt.Sprintf("%s.%s = %s.id", c["joinTable"], c["primaryFK"], c["primaryTable"]))

					conditions = append(conditions, fmt.Sprintf("%s.studio_id IS NULL", c["primaryTable"]))
				}

				f.addWhere(fmt.Sprintf("%s (%s)", notClause, strings.Join(conditions, " AND ")))
				return
			}

			if len(studios.Value) == 0 && len(studios.Excludes) == 0 {
				return
			}

			var clauseCondition string

			switch studios.Modifier {
			case models.CriterionModifierIncludes:
				// return performers who appear in scenes/images/galleries with any of the given studios
				clauseCondition = "NOT"
			case models.CriterionModifierExcludes:
				// exclude performers who appear in scenes/images/galleries with any of the given studios
				clauseCondition = ""
			default:
				return
			}

			if len(studios.Value) > 0 {
				const derivedPerformerStudioTable = "performer_studio"
				valuesClause, err := getHierarchicalValues(ctx, studios.Value, studioTable, "", "parent_id", "child_id", studios.Depth)
				if err != nil {
					f.setError(err)
					return
				}
				f.addWith("studio(root_id, item_id) AS (" + valuesClause + ")")

				templStr := `SELECT performer_id FROM {primaryTable}
		INNER JOIN {joinTable} ON {primaryTable}.id = {joinTable}.{primaryFK}
		INNER JOIN studio ON {primaryTable}.studio_id = studio.item_id`

				var unions []string
				for _, c := range formatMaps {
					unions = append(unions, utils.StrFormat(templStr, c))
				}

				f.addWith(fmt.Sprintf("%s AS (%s)", derivedPerformerStudioTable, strings.Join(unions, " UNION ")))

				f.addLeftJoin(derivedPerformerStudioTable, "", fmt.Sprintf("performers.id = %s.performer_id", derivedPerformerStudioTable))
				f.addWhere(fmt.Sprintf("%s.performer_id IS %s NULL", derivedPerformerStudioTable, clauseCondition))
			}

			// #6412 - handle excludes as well
			if len(studios.Excludes) > 0 {
				excludeValuesClause, err := getHierarchicalValues(ctx, studios.Excludes, studioTable, "", "parent_id", "child_id", studios.Depth)
				if err != nil {
					f.setError(err)
					return
				}
				f.addWith("exclude_studio(root_id, item_id) AS (" + excludeValuesClause + ")")

				excludeTemplStr := `SELECT performer_id FROM {primaryTable}
	INNER JOIN {joinTable} ON {primaryTable}.id = {joinTable}.{primaryFK}
	INNER JOIN exclude_studio ON {primaryTable}.studio_id = exclude_studio.item_id`

				var unions []string
				for _, c := range formatMaps {
					unions = append(unions, utils.StrFormat(excludeTemplStr, c))
				}

				const excludePerformerStudioTable = "performer_studio_exclude"
				f.addWith(fmt.Sprintf("%s AS (%s)", excludePerformerStudioTable, strings.Join(unions, " UNION ")))

				f.addLeftJoin(excludePerformerStudioTable, "", fmt.Sprintf("performers.id = %s.performer_id", excludePerformerStudioTable))
				f.addWhere(fmt.Sprintf("%s.performer_id IS NULL", excludePerformerStudioTable))
			}
		}
	}
}

func (qb *performerFilterHandler) groupsCriterionHandler(groups *models.HierarchicalMultiCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if groups != nil {
			if groups.Modifier == models.CriterionModifierIsNull || groups.Modifier == models.CriterionModifierNotNull {
				var notClause string
				if groups.Modifier == models.CriterionModifierNotNull {
					notClause = "NOT"
				}

				f.addLeftJoin(performersScenesTable, "", "performers_scenes.performer_id = performers.id")
				f.addLeftJoin(groupsScenesTable, "", "performers_scenes.scene_id = groups_scenes.scene_id")

				f.addWhere(fmt.Sprintf("%s groups_scenes.group_id IS NULL", notClause))
				return
			}

			if len(groups.Value) == 0 {
				return
			}

			var clauseCondition string

			switch groups.Modifier {
			case models.CriterionModifierIncludes:
				// return performers who appear in scenes with any of the given groups
				clauseCondition = "NOT"
			case models.CriterionModifierExcludes:
				// exclude performers who appear in scenes with any of the given groups
				clauseCondition = ""
			default:
				return
			}

			const derivedPerformerGroupTable = "performer_group"

			// Simplified approach: direct group-scene-performer relationship without hierarchy
			var args []interface{}
			for _, val := range groups.Value {
				args = append(args, val)
			}

			// If depth is specified and not 0, we need hierarchy, otherwise use simple approach
			depthVal := 0
			if groups.Depth != nil {
				depthVal = *groups.Depth
			}

			if depthVal == 0 {
				// Simple case: no hierarchy, direct group relationship
				f.addWith(fmt.Sprintf("group_values(id) AS (VALUES %s)", strings.Repeat("(?),", len(groups.Value)-1)+"(?)"), args...)

				templStr := `SELECT performer_id FROM {joinTable}
	INNER JOIN {primaryTable} ON {joinTable}.scene_id = {primaryTable}.scene_id
	INNER JOIN group_values ON {primaryTable}.{groupFK} = group_values.id`

				formatMaps := []utils.StrFormatMap{
					{
						"primaryTable": groupsScenesTable,
						"joinTable":    performersScenesTable,
						"primaryFK":    sceneIDColumn,
						"groupFK":      groupIDColumn,
					},
				}

				var unions []string
				for _, c := range formatMaps {
					unions = append(unions, utils.StrFormat(templStr, c))
				}

				f.addWith(fmt.Sprintf("%s AS (%s)", derivedPerformerGroupTable, strings.Join(unions, " UNION ")))
			} else {
				// Complex case: with hierarchy
				var depthCondition string
				if depthVal != -1 {
					depthCondition = fmt.Sprintf("WHERE depth < %d", depthVal)
				}

				// Build recursive CTE for group hierarchy
				hierarchyQuery := fmt.Sprintf(`group_hierarchy AS (
SELECT sub_id AS root_id, sub_id AS item_id, 0 AS depth FROM groups_relations WHERE sub_id IN%s
UNION
SELECT root_id, sub_id, depth + 1 FROM groups_relations INNER JOIN group_hierarchy ON item_id = containing_id %s
)`, getInBinding(len(groups.Value)), depthCondition)

				f.addRecursiveWith(hierarchyQuery, args...)

				templStr := `SELECT performer_id FROM {joinTable}
	INNER JOIN {primaryTable} ON {joinTable}.scene_id = {primaryTable}.scene_id
	INNER JOIN group_hierarchy ON {primaryTable}.{groupFK} = group_hierarchy.item_id`

				formatMaps := []utils.StrFormatMap{
					{
						"primaryTable": groupsScenesTable,
						"joinTable":    performersScenesTable,
						"primaryFK":    sceneIDColumn,
						"groupFK":      groupIDColumn,
					},
				}

				var unions []string
				for _, c := range formatMaps {
					unions = append(unions, utils.StrFormat(templStr, c))
				}

				f.addWith(fmt.Sprintf("%s AS (%s)", derivedPerformerGroupTable, strings.Join(unions, " UNION ")))
			}

			f.addLeftJoin(derivedPerformerGroupTable, "", fmt.Sprintf("performers.id = %s.performer_id", derivedPerformerGroupTable))
			f.addWhere(fmt.Sprintf("%s.performer_id IS %s NULL", derivedPerformerGroupTable, clauseCondition))
		}
	}
}

func (qb *performerFilterHandler) appearsWithCriterionHandler(performers *models.MultiCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if performers != nil {
			formatMaps := []utils.StrFormatMap{
				{
					"primaryTable": performersScenesTable,
					"joinTable":    performersScenesTable,
					"primaryFK":    sceneIDColumn,
				},
				{
					"primaryTable": performersImagesTable,
					"joinTable":    performersImagesTable,
					"primaryFK":    imageIDColumn,
				},
				{
					"primaryTable": performersGalleriesTable,
					"joinTable":    performersGalleriesTable,
					"primaryFK":    galleryIDColumn,
				},
			}

			if len(performers.Value) == '0' {
				return
			}

			const derivedPerformerPerformersTable = "performer_performers"

			valuesClause := strings.Join(performers.Value, "),(")

			f.addWith("performer(id) AS (VALUES(" + valuesClause + "))")

			templStr := `SELECT {primaryTable}2.performer_id FROM {primaryTable}
			INNER JOIN {primaryTable} AS {primaryTable}2 ON {primaryTable}.{primaryFK} = {primaryTable}2.{primaryFK}
			INNER JOIN performer ON {primaryTable}.performer_id = performer.id
			WHERE {primaryTable}2.performer_id != performer.id`

			if performers.Modifier == models.CriterionModifierIncludesAll && len(performers.Value) > 1 {
				templStr += `
							GROUP BY {primaryTable}2.performer_id
							HAVING(count(distinct {primaryTable}.performer_id) IS ` + strconv.Itoa(len(performers.Value)) + `)`
			}

			var unions []string
			for _, c := range formatMaps {
				unions = append(unions, utils.StrFormat(templStr, c))
			}

			f.addWith(fmt.Sprintf("%s AS (%s)", derivedPerformerPerformersTable, strings.Join(unions, " UNION ")))

			f.addInnerJoin(derivedPerformerPerformersTable, "", fmt.Sprintf("performers.id = %s.performer_id", derivedPerformerPerformersTable))
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
