package sqlite

import (
	"context"
	"fmt"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/stashapp/stash/pkg/models"
)

type galleryFilterHandler struct {
	galleryFilter *models.GalleryFilterType
}

func (qb *galleryFilterHandler) validate() error {
	galleryFilter := qb.galleryFilter
	if galleryFilter == nil {
		return nil
	}

	if err := validateFilterCombination(galleryFilter.OperatorFilter); err != nil {
		return err
	}

	if subFilter := galleryFilter.SubFilter(); subFilter != nil {
		sqb := &galleryFilterHandler{galleryFilter: subFilter}
		if err := sqb.validate(); err != nil {
			return err
		}
	}

	return nil
}

func (qb *galleryFilterHandler) handle(ctx context.Context, f *filterBuilder) {
	galleryFilter := qb.galleryFilter
	if galleryFilter == nil {
		return
	}

	if err := qb.validate(); err != nil {
		f.setError(err)
		return
	}

	sf := galleryFilter.SubFilter()
	if sf != nil {
		sub := &galleryFilterHandler{sf}
		handleSubFilter(ctx, sub, f, galleryFilter.OperatorFilter)
	}

	f.handleCriterion(ctx, qb.criterionHandler())
}

func (qb *galleryFilterHandler) criterionHandler() criterionHandler {
	filter := qb.galleryFilter
	return compoundHandler{
		intCriterionHandler(filter.ID, "galleries.id", nil),
		stringCriterionHandler(filter.Title, "galleries.title"),
		stringCriterionHandler(filter.Code, "galleries.code"),
		stringCriterionHandler(filter.Details, "galleries.details"),
		stringCriterionHandler(filter.Photographer, "galleries.photographer"),

		criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
			if filter.Checksum != nil {
				galleryRepository.addGalleriesFilesTable(f)
				f.addLeftJoin(fingerprintTable, "fingerprints_md5", "galleries_files.file_id = fingerprints_md5.file_id AND fingerprints_md5.type = 'md5'")
			}

			stringCriterionHandler(filter.Checksum, "fingerprints_md5.fingerprint")(ctx, f)
		}),

		criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
			if filter.IsZip != nil {
				galleryRepository.addGalleriesFilesTable(f)
				if *filter.IsZip {

					f.addWhere("galleries_files.file_id IS NOT NULL")
				} else {
					f.addWhere("galleries_files.file_id IS NULL")
				}
			}
		}),

		qb.pathCriterionHandler(filter.Path),
		qb.fileCountCriterionHandler(filter.FileCount),
		intCriterionHandler(filter.Rating100, "galleries.rating", nil),
		qb.urlsCriterionHandler(filter.URL),
		boolCriterionHandler(filter.Organized, "galleries.organized", nil),
		qb.missingCriterionHandler(filter.IsMissing),
		qb.tagsCriterionHandler(filter.Tags),
		qb.tagCountCriterionHandler(filter.TagCount),
		qb.performersCriterionHandler(filter.Performers),
		qb.performerCountCriterionHandler(filter.PerformerCount),
		qb.scenesCriterionHandler(filter.Scenes),
		qb.hasChaptersCriterionHandler(filter.HasChapters),
		studioCriterionHandler(galleryTable, filter.Studios),
		qb.performerTagsCriterionHandler(filter.PerformerTags),
		qb.averageResolutionCriterionHandler(filter.AverageResolution),
		qb.imageCountCriterionHandler(filter.ImageCount),
		qb.performerFavoriteCriterionHandler(filter.PerformerFavorite),
		qb.performerAgeCriterionHandler(filter.PerformerAge),
		// Performer ethnicity filter mirrors scenes semantics
		criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
			if filter.PerformerEthnicity != nil {
				pe := filter.PerformerEthnicity
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

				existsPerformer := "EXISTS (SELECT 1 FROM performers_galleries pg WHERE pg.gallery_id = galleries.id)"

				switch pe.Modifier {
				case models.CriterionModifierIncludes:
					clause := fmt.Sprintf("EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND p.ethnicity IN (%s))", placeholders)
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
						f.addWhere(fmt.Sprintf("EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND p.ethnicity IN (%s))", ph), gargs...)
					}
				case models.CriterionModifierEquals:
					clause := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND (p.ethnicity IS NULL OR TRIM(p.ethnicity) = '' OR p.ethnicity NOT IN (%s)))", placeholders)
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
						f.addWhere(fmt.Sprintf("EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND p.ethnicity IN (%s))", ph), gargs...)
					}
				case models.CriterionModifierNotEquals:
					clause := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND p.ethnicity IN (%s))", placeholders)
					f.addWhere(clause, args...)
					f.addWhere(existsPerformer)
				default:
					clause := fmt.Sprintf("EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND p.ethnicity IN (%s))", placeholders)
					f.addWhere(clause, args...)
					f.addWhere(existsPerformer)
				}
			}
		}),
		// Performer country filter mirrors scenes semantics
		criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
			if filter.PerformerCountry != nil {
				pc := filter.PerformerCountry
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

				existsPerformer := "EXISTS (SELECT 1 FROM performers_galleries pg WHERE pg.gallery_id = galleries.id)"

				switch pc.Modifier {
				case models.CriterionModifierIncludes:
					clause := fmt.Sprintf("EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND p.country IN (%s))", placeholders)
					f.addWhere(clause, args...)
					f.addWhere(existsPerformer)
				case models.CriterionModifierIncludesAll:
					for _, c := range countries {
						f.addWhere("EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND p.country = ?)", c)
					}
				case models.CriterionModifierEquals:
					clause := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND (p.country IS NULL OR TRIM(p.country) = '' OR p.country NOT IN (%s)))", placeholders)
					f.addWhere(clause, args...)
					f.addWhere(existsPerformer)
					for _, c := range countries {
						f.addWhere("EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND p.country = ?)", c)
					}
				case models.CriterionModifierNotEquals:
					clause := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND p.country IN (%s))", placeholders)
					f.addWhere(clause, args...)
					f.addWhere(existsPerformer)
				default:
					clause := fmt.Sprintf("EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND p.country IN (%s))", placeholders)
					f.addWhere(clause, args...)
					f.addWhere(existsPerformer)
				}
			}
		}),
		// Performer rating filter with ALL/ANY mode
		criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
			if filter.PerformerRating != nil {
				pr := filter.PerformerRating
				modeAll := true
				if filter.PerformerRatingAll != nil {
					modeAll = *filter.PerformerRatingAll
				}

				if !modeAll {
					f.addInnerJoin("performers_galleries", "", "galleries.id = performers_galleries.gallery_id")
					f.addInnerJoin("performers", "", "performers_galleries.performer_id = performers.id")
					intCriterionHandler(pr, "performers.rating", nil)(ctx, f)
					return
				}

				existsPerformer := "EXISTS (SELECT 1 FROM performers_galleries pg WHERE pg.gallery_id = galleries.id)"
				switch pr.Modifier {
				case models.CriterionModifierEquals:
					f.addWhere("NOT EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND (p.rating IS NULL OR p.rating != ?))", pr.Value)
					f.addWhere(existsPerformer)
				case models.CriterionModifierNotEquals:
					f.addWhere("NOT EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND p.rating = ?)", pr.Value)
					f.addWhere(existsPerformer)
				case models.CriterionModifierGreaterThan:
					f.addWhere("NOT EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND (p.rating IS NULL OR p.rating <= ?))", pr.Value)
					f.addWhere(existsPerformer)
				case models.CriterionModifierLessThan:
					f.addWhere("NOT EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND (p.rating IS NULL OR p.rating >= ?))", pr.Value)
					f.addWhere(existsPerformer)
				case models.CriterionModifierBetween:
					f.addWhere("NOT EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND (p.rating IS NULL OR p.rating < ? OR p.rating > ?))", pr.Value, pr.Value2)
					f.addWhere(existsPerformer)
				case models.CriterionModifierNotBetween:
					f.addWhere("NOT EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND (p.rating IS NULL OR (p.rating >= ? AND p.rating <= ?)))", pr.Value, pr.Value2)
					f.addWhere(existsPerformer)
				case models.CriterionModifierNotNull:
					f.addWhere("NOT EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND p.rating IS NULL)")
					f.addWhere(existsPerformer)
				case models.CriterionModifierIsNull:
					f.addWhere("NOT EXISTS (SELECT 1 FROM performers_galleries pg JOIN performers p ON p.id = pg.performer_id WHERE pg.gallery_id = galleries.id AND p.rating IS NOT NULL)")
					f.addWhere(existsPerformer)
				default:
					f.addInnerJoin("performers_galleries", "", "galleries.id = performers_galleries.gallery_id")
					f.addInnerJoin("performers", "", "performers_galleries.performer_id = performers.id")
					intCriterionHandler(pr, "performers.rating", nil)(ctx, f)
				}
			}
		}),
		&dateCriterionHandler{filter.Date, "galleries.date", nil},
		&timestampCriterionHandler{filter.CreatedAt, "galleries.created_at", nil},
		&timestampCriterionHandler{filter.UpdatedAt, "galleries.updated_at", nil},

		&relatedFilterHandler{
			relatedIDCol:   "scenes_galleries.scene_id",
			relatedRepo:    sceneRepository.repository,
			relatedHandler: &sceneFilterHandler{filter.ScenesFilter},
			joinFn: func(f *filterBuilder) {
				galleryRepository.scenes.innerJoin(f, "", "galleries.id")
			},
		},

		&relatedFilterHandler{
			relatedIDCol:   "galleries_images.image_id",
			relatedRepo:    imageRepository.repository,
			relatedHandler: &imageFilterHandler{filter.ImagesFilter},
			joinFn: func(f *filterBuilder) {
				galleryRepository.images.innerJoin(f, "", "galleries.id")
			},
		},

		&relatedFilterHandler{
			relatedIDCol:   "performers_join.performer_id",
			relatedRepo:    performerRepository.repository,
			relatedHandler: &performerFilterHandler{filter.PerformersFilter},
			joinFn: func(f *filterBuilder) {
				galleryRepository.performers.innerJoin(f, "performers_join", "galleries.id")
			},
		},

		&relatedFilterHandler{
			relatedIDCol:   "galleries.studio_id",
			relatedRepo:    studioRepository.repository,
			relatedHandler: &studioFilterHandler{filter.StudiosFilter},
		},

		&relatedFilterHandler{
			relatedIDCol:   "gallery_tag.tag_id",
			relatedRepo:    tagRepository.repository,
			relatedHandler: &tagFilterHandler{filter.TagsFilter},
			joinFn: func(f *filterBuilder) {
				galleryRepository.tags.innerJoin(f, "gallery_tag", "galleries.id")
			},
		},

		&relatedFilterHandler{
			relatedIDCol: "files.id",
			relatedRepo:  fileRepository.repository,
			relatedHandler: &fileFilterHandler{
				fileFilter: filter.FilesFilter,
				isRelated:  true,
			},
			joinFn: func(f *filterBuilder) {
				galleryRepository.addFilesTable(f)
				galleryRepository.addFoldersTable(f)
			},
			// don't use a subquery; join directly
			directJoin: true,
		},

		&relatedFilterHandler{
			relatedIDCol: "gallery_folder.id",
			relatedRepo:  folderRepository.repository,
			relatedHandler: &folderFilterHandler{
				folderFilter: filter.FoldersFilter,
				table:        "gallery_folder",
				isRelated:    true,
			},
			joinFn: func(f *filterBuilder) {
				f.addLeftJoin(folderTable, "gallery_folder", "galleries.folder_id = gallery_folder.id")
			},
			// don't use a subquery; join directly
			directJoin: true,
		},
	}
}

func (qb *galleryFilterHandler) urlsCriterionHandler(url *models.StringCriterionInput) criterionHandlerFunc {
	h := stringListCriterionHandlerBuilder{
		primaryTable: galleryTable,
		primaryFK:    galleryIDColumn,
		joinTable:    galleriesURLsTable,
		stringColumn: galleriesURLColumn,
		addJoinTable: func(f *filterBuilder) {
			galleriesURLsTableMgr.join(f, "", "galleries.id")
		},
	}

	return h.handler(url)
}

func (qb *galleryFilterHandler) getMultiCriterionHandlerBuilder(foreignTable, joinTable, foreignFK string, addJoinsFunc func(f *filterBuilder)) multiCriterionHandlerBuilder {
	return multiCriterionHandlerBuilder{
		primaryTable: galleryTable,
		foreignTable: foreignTable,
		joinTable:    joinTable,
		primaryFK:    galleryIDColumn,
		foreignFK:    foreignFK,
		addJoinsFunc: addJoinsFunc,
	}
}

func (qb *galleryFilterHandler) pathCriterionHandler(c *models.StringCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if c != nil {
			galleryRepository.addFoldersTable(f)
			f.addLeftJoin(folderTable, "gallery_folder", "galleries.folder_id = gallery_folder.id")

			const pathColumn = "folders.path"
			const basenameColumn = "files.basename"
			const folderPathColumn = "gallery_folder.path"

			addWildcards := true
			not := false

			if modifier := c.Modifier; c.Modifier.IsValid() {
				switch modifier {
				case models.CriterionModifierIncludes:
					clause := getPathSearchClauseMany(pathColumn, basenameColumn, c.Value, addWildcards, not)
					clause2 := getStringSearchClause([]string{folderPathColumn}, c.Value, false)
					f.whereClauses = append(f.whereClauses, orClauses(clause, clause2))
				case models.CriterionModifierExcludes:
					not = true
					clause := getPathSearchClauseMany(pathColumn, basenameColumn, c.Value, addWildcards, not)
					clause2 := getStringSearchClause([]string{folderPathColumn}, c.Value, true)
					f.whereClauses = append(f.whereClauses, orClauses(clause, clause2))
				case models.CriterionModifierEquals:
					addWildcards = false
					clause := getPathSearchClause(pathColumn, basenameColumn, c.Value, addWildcards, not)
					clause2 := makeClause(folderPathColumn+" LIKE ?", c.Value)
					f.whereClauses = append(f.whereClauses, orClauses(clause, clause2))
				case models.CriterionModifierNotEquals:
					addWildcards = false
					not = true
					clause := getPathSearchClause(pathColumn, basenameColumn, c.Value, addWildcards, not)
					clause2 := makeClause(folderPathColumn+" NOT LIKE ?", c.Value)
					f.whereClauses = append(f.whereClauses, orClauses(clause, clause2))
				case models.CriterionModifierMatchesRegex:
					if _, err := regexp.Compile(c.Value); err != nil {
						f.setError(err)
						return
					}
					filepathColumn := fmt.Sprintf("%s || '%s' || %s", pathColumn, string(filepath.Separator), basenameColumn)
					clause := makeClause(fmt.Sprintf("%s IS NOT NULL AND %s IS NOT NULL AND %s regexp ?", pathColumn, basenameColumn, filepathColumn), c.Value)
					clause2 := makeClause(fmt.Sprintf("%s IS NOT NULL AND %[1]s regexp ?", folderPathColumn), c.Value)
					f.whereClauses = append(f.whereClauses, orClauses(clause, clause2))
				case models.CriterionModifierNotMatchesRegex:
					if _, err := regexp.Compile(c.Value); err != nil {
						f.setError(err)
						return
					}
					filepathColumn := fmt.Sprintf("%s || '%s' || %s", pathColumn, string(filepath.Separator), basenameColumn)
					f.addWhere(fmt.Sprintf("%s IS NULL OR %s IS NULL OR %s NOT regexp ?", pathColumn, basenameColumn, filepathColumn), c.Value)
					f.addWhere(fmt.Sprintf("%s IS NULL OR %[1]s NOT regexp ?", folderPathColumn), c.Value)
				case models.CriterionModifierIsNull:
					f.addWhere(fmt.Sprintf("%s IS NULL OR TRIM(%[1]s) = '' OR %s IS NULL OR TRIM(%[2]s) = ''", pathColumn, basenameColumn))
					f.addWhere(fmt.Sprintf("%s IS NULL OR TRIM(%[1]s) = ''", folderPathColumn))
				case models.CriterionModifierNotNull:
					clause := makeClause(fmt.Sprintf("%s IS NOT NULL AND TRIM(%[1]s) != '' AND %s IS NOT NULL AND TRIM(%[2]s) != ''", pathColumn, basenameColumn))
					clause2 := makeClause(fmt.Sprintf("%s IS NOT NULL AND TRIM(%[1]s) != ''", folderPathColumn))
					f.whereClauses = append(f.whereClauses, orClauses(clause, clause2))
				default:
					panic("unsupported string filter modifier")
				}
			}
		}
	}
}

func (qb *galleryFilterHandler) fileCountCriterionHandler(fileCount *models.IntCriterionInput) criterionHandlerFunc {
	h := countCriterionHandlerBuilder{
		primaryTable: galleryTable,
		joinTable:    galleriesFilesTable,
		primaryFK:    galleryIDColumn,
	}

	return h.handler(fileCount)
}

func (qb *galleryFilterHandler) missingCriterionHandler(isMissing *string) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if isMissing != nil && *isMissing != "" {
			switch *isMissing {
			case "url":
				galleriesURLsTableMgr.join(f, "", "galleries.id")
				f.addWhere("gallery_urls.url IS NULL")
			case "scenes":
				f.addLeftJoin("scenes_galleries", "scenes_join", "scenes_join.gallery_id = galleries.id")
				f.addWhere("scenes_join.gallery_id IS NULL")
			case "studio":
				f.addWhere("galleries.studio_id IS NULL")
			case "performers":
				galleryRepository.performers.join(f, "performers_join", "galleries.id")
				f.addWhere("performers_join.gallery_id IS NULL")
			case "date":
				f.addWhere("galleries.date IS NULL OR galleries.date IS \"\"")
			case "tags":
				galleryRepository.tags.join(f, "tags_join", "galleries.id")
				f.addWhere("tags_join.gallery_id IS NULL")
			default:
				f.addWhere("(galleries." + *isMissing + " IS NULL OR TRIM(galleries." + *isMissing + ") = '')")
			}
		}
	}
}

func (qb *galleryFilterHandler) tagsCriterionHandler(tags *models.HierarchicalMultiCriterionInput) criterionHandlerFunc {
	h := joinedHierarchicalMultiCriterionHandlerBuilder{
		primaryTable: galleryTable,
		foreignTable: tagTable,
		foreignFK:    "tag_id",

		relationsTable: "tags_relations",
		joinAs:         "gallery_tag",
		joinTable:      galleriesTagsTable,
		primaryFK:      galleryIDColumn,
	}

	return h.handler(tags)
}

func (qb *galleryFilterHandler) tagCountCriterionHandler(tagCount *models.IntCriterionInput) criterionHandlerFunc {
	h := countCriterionHandlerBuilder{
		primaryTable: galleryTable,
		joinTable:    galleriesTagsTable,
		primaryFK:    galleryIDColumn,
	}

	return h.handler(tagCount)
}

func (qb *galleryFilterHandler) scenesCriterionHandler(scenes *models.MultiCriterionInput) criterionHandlerFunc {
	addJoinsFunc := func(f *filterBuilder) {
		galleryRepository.scenes.join(f, "", "galleries.id")
		f.addLeftJoin("scenes", "", "scenes_galleries.scene_id = scenes.id")
	}
	h := qb.getMultiCriterionHandlerBuilder(sceneTable, galleriesScenesTable, "scene_id", addJoinsFunc)
	return h.handler(scenes)
}

func (qb *galleryFilterHandler) performersCriterionHandler(performers *models.MultiCriterionInput) criterionHandlerFunc {
	h := joinedMultiCriterionHandlerBuilder{
		primaryTable: galleryTable,
		joinTable:    performersGalleriesTable,
		joinAs:       "performers_join",
		primaryFK:    galleryIDColumn,
		foreignFK:    performerIDColumn,

		addJoinTable: func(f *filterBuilder) {
			galleryRepository.performers.join(f, "performers_join", "galleries.id")
		},
	}

	return h.handler(performers)
}

func (qb *galleryFilterHandler) performerCountCriterionHandler(performerCount *models.IntCriterionInput) criterionHandlerFunc {
	h := countCriterionHandlerBuilder{
		primaryTable: galleryTable,
		joinTable:    performersGalleriesTable,
		primaryFK:    galleryIDColumn,
	}

	return h.handler(performerCount)
}

func (qb *galleryFilterHandler) imageCountCriterionHandler(imageCount *models.IntCriterionInput) criterionHandlerFunc {
	h := countCriterionHandlerBuilder{
		primaryTable: galleryTable,
		joinTable:    galleriesImagesTable,
		primaryFK:    galleryIDColumn,
	}

	return h.handler(imageCount)
}

func (qb *galleryFilterHandler) hasChaptersCriterionHandler(hasChapters *string) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if hasChapters != nil {
			f.addLeftJoin("galleries_chapters", "", "galleries_chapters.gallery_id = galleries.id")
			if *hasChapters == "true" {
				f.addHaving("count(galleries_chapters.gallery_id) > 0")
			} else {
				f.addWhere("galleries_chapters.id IS NULL")
			}
		}
	}
}

func (qb *galleryFilterHandler) performerTagsCriterionHandler(tags *models.HierarchicalMultiCriterionInput) criterionHandler {
	return &joinedPerformerTagsHandler{
		criterion:      tags,
		primaryTable:   galleryTable,
		joinTable:      performersGalleriesTable,
		joinPrimaryKey: galleryIDColumn,
	}
}

func (qb *galleryFilterHandler) performerFavoriteCriterionHandler(performerfavorite *bool) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if performerfavorite != nil {
			f.addLeftJoin("performers_galleries", "", "galleries.id = performers_galleries.gallery_id")

			if *performerfavorite {
				// contains at least one favorite
				f.addLeftJoin("performers", "", "performers.id = performers_galleries.performer_id")
				f.addWhere("performers.favorite = 1")
			} else {
				// contains zero favorites
				f.addLeftJoin(`(SELECT performers_galleries.gallery_id as id FROM performers_galleries 
JOIN performers ON performers.id = performers_galleries.performer_id
GROUP BY performers_galleries.gallery_id HAVING SUM(performers.favorite) = 0)`, "nofaves", "galleries.id = nofaves.id")
				f.addWhere("performers_galleries.gallery_id IS NULL OR nofaves.id IS NOT NULL")
			}
		}
	}
}

func (qb *galleryFilterHandler) performerAgeCriterionHandler(performerAge *models.IntCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if performerAge != nil {
			f.addInnerJoin("performers_galleries", "", "galleries.id = performers_galleries.gallery_id")
			f.addInnerJoin("performers", "", "performers_galleries.performer_id = performers.id")

			f.addWhere("galleries.date != '' AND performers.birthdate != ''")
			f.addWhere("galleries.date IS NOT NULL AND performers.birthdate IS NOT NULL")

			ageCalc := "cast(strftime('%Y.%m%d', galleries.date) - strftime('%Y.%m%d', performers.birthdate) as int)"
			whereClause, args := getIntWhereClause(ageCalc, performerAge.Modifier, performerAge.Value, performerAge.Value2)
			f.addWhere(whereClause, args...)
		}
	}
}

func (qb *galleryFilterHandler) averageResolutionCriterionHandler(resolution *models.ResolutionCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if resolution != nil && resolution.Value.IsValid() {
			galleryRepository.images.join(f, "images_join", "galleries.id")
			f.addLeftJoin("images", "", "images_join.image_id = images.id")
			f.addLeftJoin("images_files", "", "images.id = images_files.image_id")
			f.addLeftJoin("image_files", "", "images_files.file_id = image_files.file_id")

			mn := resolution.Value.GetMinResolution()
			mx := resolution.Value.GetMaxResolution()

			const widthHeight = "avg(MIN(image_files.width, image_files.height))"

			switch resolution.Modifier {
			case models.CriterionModifierEquals:
				f.addHaving(fmt.Sprintf("%s BETWEEN %d AND %d", widthHeight, mn, mx))
			case models.CriterionModifierNotEquals:
				f.addHaving(fmt.Sprintf("%s NOT BETWEEN %d AND %d", widthHeight, mn, mx))
			case models.CriterionModifierLessThan:
				f.addHaving(fmt.Sprintf("%s < %d", widthHeight, mn))
			case models.CriterionModifierGreaterThan:
				f.addHaving(fmt.Sprintf("%s > %d", widthHeight, mx))
			}
		}
	}
}
