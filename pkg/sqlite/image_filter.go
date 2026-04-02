package sqlite

import (
	"context"
	"fmt"
	"strings"

	"github.com/stashapp/stash/pkg/models"
)

type imageFilterHandler struct {
	imageFilter *models.ImageFilterType
}

func (qb *imageFilterHandler) validate() error {
	imageFilter := qb.imageFilter
	if imageFilter == nil {
		return nil
	}

	if err := validateFilterCombination(imageFilter.OperatorFilter); err != nil {
		return err
	}

	if subFilter := imageFilter.SubFilter(); subFilter != nil {
		sqb := &imageFilterHandler{imageFilter: subFilter}
		if err := sqb.validate(); err != nil {
			return err
		}
	}

	return nil
}

func (qb *imageFilterHandler) handle(ctx context.Context, f *filterBuilder) {
	imageFilter := qb.imageFilter
	if imageFilter == nil {
		return
	}

	if err := qb.validate(); err != nil {
		f.setError(err)
		return
	}

	sf := imageFilter.SubFilter()
	if sf != nil {
		sub := &imageFilterHandler{sf}
		handleSubFilter(ctx, sub, f, imageFilter.OperatorFilter)
	}

	f.handleCriterion(ctx, qb.criterionHandler())
}

func (qb *imageFilterHandler) criterionHandler() criterionHandler {
	imageFilter := qb.imageFilter
	return compoundHandler{
		intCriterionHandler(imageFilter.ID, "images.id", nil),
		criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
			if imageFilter.Checksum != nil {
				imageRepository.addImagesFilesTable(f)
				f.addInnerJoin(fingerprintTable, "fingerprints_md5", "images_files.file_id = fingerprints_md5.file_id AND fingerprints_md5.type = 'md5'")
			}

			stringCriterionHandler(imageFilter.Checksum, "fingerprints_md5.fingerprint")(ctx, f)
		}),

		&phashDistanceCriterionHandler{
			joinFn: func(f *filterBuilder) {
				imageRepository.addImagesFilesTable(f)
				f.addLeftJoin(fingerprintTable, "fingerprints_phash", "images_files.file_id = fingerprints_phash.file_id AND fingerprints_phash.type = 'phash'")
			},
			criterion: imageFilter.PhashDistance,
		},

		stringCriterionHandler(imageFilter.Title, "images.title"),
		stringCriterionHandler(imageFilter.Code, "images.code"),
		stringCriterionHandler(imageFilter.Details, "images.details"),
		stringCriterionHandler(imageFilter.Photographer, "images.photographer"),

		pathCriterionHandler(imageFilter.Path, "folders.path", "files.basename", imageRepository.addFoldersTable),
		qb.fileCountCriterionHandler(imageFilter.FileCount),
		intCriterionHandler(imageFilter.Rating100, "images.rating", nil),
		intCriterionHandler(imageFilter.OCounter, "images.o_counter", nil),
		boolCriterionHandler(imageFilter.Organized, "images.organized", nil),
		&dateCriterionHandler{imageFilter.Date, "images.date", nil},
		qb.urlsCriterionHandler(imageFilter.URL),

		resolutionCriterionHandler(imageFilter.Resolution, "image_files.height", "image_files.width", imageRepository.addImageFilesTable),
		orientationCriterionHandler(imageFilter.Orientation, "image_files.height", "image_files.width", imageRepository.addImageFilesTable),
		qb.missingCriterionHandler(imageFilter.IsMissing),

		qb.tagsCriterionHandler(imageFilter.Tags),
		qb.tagCountCriterionHandler(imageFilter.TagCount),
		qb.galleriesCriterionHandler(imageFilter.Galleries),
		qb.performersCriterionHandler(imageFilter.Performers),
		qb.performerCountCriterionHandler(imageFilter.PerformerCount),
		studioCriterionHandler(imageTable, imageFilter.Studios),
		qb.performerTagsCriterionHandler(imageFilter.PerformerTags),
		qb.performerFavoriteCriterionHandler(imageFilter.PerformerFavorite),
		qb.performerAgeCriterionHandler(imageFilter.PerformerAge),
		// Performer ethnicity filter mirrors scenes semantics
		criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
			if imageFilter.PerformerEthnicity != nil {
				pe := imageFilter.PerformerEthnicity
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

				existsPerformer := "EXISTS (SELECT 1 FROM performers_images pi WHERE pi.image_id = images.id)"

				switch pe.Modifier {
				case models.CriterionModifierIncludes:
					clause := fmt.Sprintf("EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND p.ethnicity IN (%s))", placeholders)
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
						f.addWhere(fmt.Sprintf("EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND p.ethnicity IN (%s))", ph), gargs...)
					}
				case models.CriterionModifierEquals:
					clause := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND (p.ethnicity IS NULL OR TRIM(p.ethnicity) = '' OR p.ethnicity NOT IN (%s)))", placeholders)
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
						f.addWhere(fmt.Sprintf("EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND p.ethnicity IN (%s))", ph), gargs...)
					}
				case models.CriterionModifierNotEquals:
					clause := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND p.ethnicity IN (%s))", placeholders)
					f.addWhere(clause, args...)
					f.addWhere(existsPerformer)
				default:
					clause := fmt.Sprintf("EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND p.ethnicity IN (%s))", placeholders)
					f.addWhere(clause, args...)
					f.addWhere(existsPerformer)
				}
			}
		}),
		// Performer country filter mirrors scenes semantics
		criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
			if imageFilter.PerformerCountry != nil {
				pc := imageFilter.PerformerCountry
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

				existsPerformer := "EXISTS (SELECT 1 FROM performers_images pi WHERE pi.image_id = images.id)"

				switch pc.Modifier {
				case models.CriterionModifierIncludes:
					clause := fmt.Sprintf("EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND p.country IN (%s))", placeholders)
					f.addWhere(clause, args...)
					f.addWhere(existsPerformer)
				case models.CriterionModifierIncludesAll:
					for _, c := range countries {
						f.addWhere("EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND p.country = ?)", c)
					}
				case models.CriterionModifierEquals:
					clause := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND (p.country IS NULL OR TRIM(p.country) = '' OR p.country NOT IN (%s)))", placeholders)
					f.addWhere(clause, args...)
					f.addWhere(existsPerformer)
					for _, c := range countries {
						f.addWhere("EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND p.country = ?)", c)
					}
				case models.CriterionModifierNotEquals:
					clause := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND p.country IN (%s))", placeholders)
					f.addWhere(clause, args...)
					f.addWhere(existsPerformer)
				default:
					clause := fmt.Sprintf("EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND p.country IN (%s))", placeholders)
					f.addWhere(clause, args...)
					f.addWhere(existsPerformer)
				}
			}
		}),
		// Performer rating filter with ALL/ANY mode
		criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
			if imageFilter.PerformerRating != nil {
				pr := imageFilter.PerformerRating
				modeAll := true
				if imageFilter.PerformerRatingAll != nil {
					modeAll = *imageFilter.PerformerRatingAll
				}

				if !modeAll {
					f.addInnerJoin("performers_images", "", "images.id = performers_images.image_id")
					f.addInnerJoin("performers", "", "performers_images.performer_id = performers.id")
					intCriterionHandler(pr, "performers.rating", nil)(ctx, f)
					return
				}

				existsPerformer := "EXISTS (SELECT 1 FROM performers_images pi WHERE pi.image_id = images.id)"
				switch pr.Modifier {
				case models.CriterionModifierEquals:
					f.addWhere("NOT EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND (p.rating IS NULL OR p.rating != ?))", pr.Value)
					f.addWhere(existsPerformer)
				case models.CriterionModifierNotEquals:
					f.addWhere("NOT EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND p.rating = ?)", pr.Value)
					f.addWhere(existsPerformer)
				case models.CriterionModifierGreaterThan:
					f.addWhere("NOT EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND (p.rating IS NULL OR p.rating <= ?))", pr.Value)
					f.addWhere(existsPerformer)
				case models.CriterionModifierLessThan:
					f.addWhere("NOT EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND (p.rating IS NULL OR p.rating >= ?))", pr.Value)
					f.addWhere(existsPerformer)
				case models.CriterionModifierBetween:
					f.addWhere("NOT EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND (p.rating IS NULL OR p.rating < ? OR p.rating > ?))", pr.Value, pr.Value2)
					f.addWhere(existsPerformer)
				case models.CriterionModifierNotBetween:
					f.addWhere("NOT EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND (p.rating IS NULL OR (p.rating >= ? AND p.rating <= ?)))", pr.Value, pr.Value2)
					f.addWhere(existsPerformer)
				case models.CriterionModifierNotNull:
					f.addWhere("NOT EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND p.rating IS NULL)")
					f.addWhere(existsPerformer)
				case models.CriterionModifierIsNull:
					f.addWhere("NOT EXISTS (SELECT 1 FROM performers_images pi JOIN performers p ON p.id = pi.performer_id WHERE pi.image_id = images.id AND p.rating IS NOT NULL)")
					f.addWhere(existsPerformer)
				default:
					f.addInnerJoin("performers_images", "", "images.id = performers_images.image_id")
					f.addInnerJoin("performers", "", "performers_images.performer_id = performers.id")
					intCriterionHandler(pr, "performers.rating", nil)(ctx, f)
				}
			}
		}),
		&timestampCriterionHandler{imageFilter.CreatedAt, "images.created_at", nil},
		&timestampCriterionHandler{imageFilter.UpdatedAt, "images.updated_at", nil},

		&customFieldsFilterHandler{
			table: imagesCustomFieldsTable.GetTable(),
			fkCol: imageIDColumn,
			c:     imageFilter.CustomFields,
			idCol: "images.id",
		},

		&relatedFilterHandler{
			relatedIDCol:   "galleries_images.gallery_id",
			relatedRepo:    galleryRepository.repository,
			relatedHandler: &galleryFilterHandler{imageFilter.GalleriesFilter},
			joinFn: func(f *filterBuilder) {
				imageRepository.galleries.innerJoin(f, "", "images.id")
			},
		},

		&relatedFilterHandler{
			relatedIDCol:   "performers_join.performer_id",
			relatedRepo:    performerRepository.repository,
			relatedHandler: &performerFilterHandler{imageFilter.PerformersFilter},
			joinFn: func(f *filterBuilder) {
				imageRepository.performers.innerJoin(f, "performers_join", "images.id")
			},
		},

		&relatedFilterHandler{
			relatedIDCol:   "images.studio_id",
			relatedRepo:    studioRepository.repository,
			relatedHandler: &studioFilterHandler{imageFilter.StudiosFilter},
		},

		&relatedFilterHandler{
			relatedIDCol:   "image_tag.tag_id",
			relatedRepo:    tagRepository.repository,
			relatedHandler: &tagFilterHandler{imageFilter.TagsFilter},
			joinFn: func(f *filterBuilder) {
				imageRepository.tags.innerJoin(f, "image_tag", "images.id")
			},
		},

		&relatedFilterHandler{
			relatedIDCol: "files.id",
			relatedRepo:  fileRepository.repository,
			relatedHandler: &fileFilterHandler{
				fileFilter: imageFilter.FilesFilter,
				isRelated:  true,
			},
			joinFn: func(f *filterBuilder) {
				imageRepository.addFilesTable(f)
				imageRepository.addFoldersTable(f)
			},
			// don't use a subquery; join directly
			directJoin: true,
		},
	}
}

func (qb *imageFilterHandler) fileCountCriterionHandler(fileCount *models.IntCriterionInput) criterionHandlerFunc {
	h := countCriterionHandlerBuilder{
		primaryTable: imageTable,
		joinTable:    imagesFilesTable,
		primaryFK:    imageIDColumn,
	}

	return h.handler(fileCount)
}

func (qb *imageFilterHandler) missingCriterionHandler(isMissing *string) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if isMissing != nil && *isMissing != "" {
			switch *isMissing {
			case "url":
				imagesURLsTableMgr.join(f, "", "images.id")
				f.addWhere("image_urls.url IS NULL")
			case "studio":
				f.addWhere("images.studio_id IS NULL")
			case "performers":
				imageRepository.performers.join(f, "performers_join", "images.id")
				f.addWhere("performers_join.image_id IS NULL")
			case "galleries":
				imageRepository.galleries.join(f, "galleries_join", "images.id")
				f.addWhere("galleries_join.image_id IS NULL")
			case "tags":
				imageRepository.tags.join(f, "tags_join", "images.id")
				f.addWhere("tags_join.image_id IS NULL")
			default:
				if err := validateIsMissing(*isMissing, []string{
					"title", "details", "photographer", "date", "code", "rating",
				}); err != nil {
					f.setError(err)
					return
				}
				f.addWhere("(images." + *isMissing + " IS NULL OR TRIM(images." + *isMissing + ") = '')")
			}
		}
	}
}

func (qb *imageFilterHandler) urlsCriterionHandler(url *models.StringCriterionInput) criterionHandlerFunc {
	h := stringListCriterionHandlerBuilder{
		primaryTable: imageTable,
		primaryFK:    imageIDColumn,
		joinTable:    imagesURLsTable,
		stringColumn: imageURLColumn,
		addJoinTable: func(f *filterBuilder) {
			imagesURLsTableMgr.join(f, "", "images.id")
		},
	}

	return h.handler(url)
}

func (qb *imageFilterHandler) getMultiCriterionHandlerBuilder(foreignTable, joinTable, foreignFK string, addJoinsFunc func(f *filterBuilder)) multiCriterionHandlerBuilder {
	return multiCriterionHandlerBuilder{
		primaryTable: imageTable,
		foreignTable: foreignTable,
		joinTable:    joinTable,
		primaryFK:    imageIDColumn,
		foreignFK:    foreignFK,
		addJoinsFunc: addJoinsFunc,
	}
}

func (qb *imageFilterHandler) tagsCriterionHandler(tags *models.HierarchicalMultiCriterionInput) criterionHandlerFunc {
	h := joinedHierarchicalMultiCriterionHandlerBuilder{
		primaryTable: imageTable,
		foreignTable: tagTable,
		foreignFK:    "tag_id",

		relationsTable: "tags_relations",
		joinAs:         "image_tag",
		joinTable:      imagesTagsTable,
		primaryFK:      imageIDColumn,
	}

	return h.handler(tags)
}

func (qb *imageFilterHandler) tagCountCriterionHandler(tagCount *models.IntCriterionInput) criterionHandlerFunc {
	h := countCriterionHandlerBuilder{
		primaryTable: imageTable,
		joinTable:    imagesTagsTable,
		primaryFK:    imageIDColumn,
	}

	return h.handler(tagCount)
}

func (qb *imageFilterHandler) galleriesCriterionHandler(galleries *models.MultiCriterionInput) criterionHandlerFunc {
	addJoinsFunc := func(f *filterBuilder) {
		if galleries.Modifier == models.CriterionModifierIncludes || galleries.Modifier == models.CriterionModifierIncludesAll {
			f.addInnerJoin(galleriesImagesTable, "", "galleries_images.image_id = images.id")
			f.addInnerJoin(galleryTable, "", "galleries_images.gallery_id = galleries.id")
		}
	}
	h := qb.getMultiCriterionHandlerBuilder(galleryTable, galleriesImagesTable, galleryIDColumn, addJoinsFunc)

	return h.handler(galleries)
}

func (qb *imageFilterHandler) performersCriterionHandler(performers *models.MultiCriterionInput) criterionHandlerFunc {
	h := joinedMultiCriterionHandlerBuilder{
		primaryTable: imageTable,
		joinTable:    performersImagesTable,
		joinAs:       "performers_join",
		primaryFK:    imageIDColumn,
		foreignFK:    performerIDColumn,

		addJoinTable: func(f *filterBuilder) {
			imageRepository.performers.join(f, "performers_join", "images.id")
		},
	}

	return h.handler(performers)
}

func (qb *imageFilterHandler) performerCountCriterionHandler(performerCount *models.IntCriterionInput) criterionHandlerFunc {
	h := countCriterionHandlerBuilder{
		primaryTable: imageTable,
		joinTable:    performersImagesTable,
		primaryFK:    imageIDColumn,
	}

	return h.handler(performerCount)
}

func (qb *imageFilterHandler) performerFavoriteCriterionHandler(performerfavorite *bool) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if performerfavorite != nil {
			f.addLeftJoin("performers_images", "", "images.id = performers_images.image_id")

			if *performerfavorite {
				// contains at least one favorite
				f.addLeftJoin("performers", "", "performers.id = performers_images.performer_id")
				f.addWhere("performers.favorite = 1")
			} else {
				// contains zero favorites
				f.addLeftJoin(`(SELECT performers_images.image_id as id FROM performers_images
JOIN performers ON performers.id = performers_images.performer_id
GROUP BY performers_images.image_id HAVING SUM(performers.favorite) = 0)`, "nofaves", "images.id = nofaves.id")
				f.addWhere("performers_images.image_id IS NULL OR nofaves.id IS NOT NULL")
			}
		}
	}
}

func (qb *imageFilterHandler) performerAgeCriterionHandler(performerAge *models.IntCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if performerAge != nil {
			f.addInnerJoin("performers_images", "", "images.id = performers_images.image_id")
			f.addInnerJoin("performers", "", "performers_images.performer_id = performers.id")

			f.addWhere("images.date != '' AND performers.birthdate != ''")
			f.addWhere("images.date IS NOT NULL AND performers.birthdate IS NOT NULL")

			ageCalc := "cast(strftime('%Y.%m%d', images.date) - strftime('%Y.%m%d', performers.birthdate) as int)"
			whereClause, args := getIntWhereClause(ageCalc, performerAge.Modifier, performerAge.Value, performerAge.Value2)
			f.addWhere(whereClause, args...)
		}
	}
}

func (qb *imageFilterHandler) performerTagsCriterionHandler(tags *models.HierarchicalMultiCriterionInput) criterionHandler {
	return &joinedPerformerTagsHandler{
		criterion:      tags,
		primaryTable:   imageTable,
		joinTable:      performersImagesTable,
		joinPrimaryKey: imageIDColumn,
	}
}
