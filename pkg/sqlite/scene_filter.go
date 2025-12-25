package sqlite

import (
	"context"
	"fmt"
	"strings"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/utils"
)

type sceneFilterHandler struct {
	sceneFilter *models.SceneFilterType
}

func (qb *sceneFilterHandler) validate() error {
	sceneFilter := qb.sceneFilter
	if sceneFilter == nil {
		return nil
	}

	if err := validateFilterCombination(sceneFilter.OperatorFilter); err != nil {
		return err
	}

	if subFilter := sceneFilter.SubFilter(); subFilter != nil {
		sqb := &sceneFilterHandler{sceneFilter: subFilter}
		if err := sqb.validate(); err != nil {
			return err
		}
	}

	return nil
}

func (qb *sceneFilterHandler) handle(ctx context.Context, f *filterBuilder) {
	sceneFilter := qb.sceneFilter
	if sceneFilter == nil {
		return
	}

	if err := qb.validate(); err != nil {
		f.setError(err)
		return
	}

	sf := sceneFilter.SubFilter()
	if sf != nil {
		sub := &sceneFilterHandler{sf}
		handleSubFilter(ctx, sub, f, sceneFilter.OperatorFilter)
	}

	f.handleCriterion(ctx, qb.criterionHandler())
}

func (qb *sceneFilterHandler) criterionHandler() criterionHandler {
	sceneFilter := qb.sceneFilter
	return compoundHandler{
		intCriterionHandler(sceneFilter.ID, "scenes.id", nil),
		pathCriterionHandler(sceneFilter.Path, "folders.path", "files.basename", qb.addFoldersTable),
		qb.fileCountCriterionHandler(sceneFilter.FileCount),
		stringCriterionHandler(sceneFilter.Title, "scenes.title"),
		stringCriterionHandler(sceneFilter.Code, "scenes.code"),
		stringCriterionHandler(sceneFilter.Details, "scenes.details"),
		stringCriterionHandler(sceneFilter.Director, "scenes.director"),
		criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
			if sceneFilter.Oshash != nil {
				qb.addSceneFilesTable(f)
				f.addLeftJoin(fingerprintTable, "fingerprints_oshash", "scenes_files.file_id = fingerprints_oshash.file_id AND fingerprints_oshash.type = 'oshash'")
			}

			stringCriterionHandler(sceneFilter.Oshash, "fingerprints_oshash.fingerprint")(ctx, f)
		}),

		criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
			if sceneFilter.Checksum != nil {
				qb.addSceneFilesTable(f)
				f.addLeftJoin(fingerprintTable, "fingerprints_md5", "scenes_files.file_id = fingerprints_md5.file_id AND fingerprints_md5.type = 'md5'")
			}

			stringCriterionHandler(sceneFilter.Checksum, "fingerprints_md5.fingerprint")(ctx, f)
		}),

		criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
			if sceneFilter.Phash != nil {
				// backwards compatibility
				qb.phashDistanceCriterionHandler(&models.PhashDistanceCriterionInput{
					Value:    sceneFilter.Phash.Value,
					Modifier: sceneFilter.Phash.Modifier,
				})(ctx, f)
			}
		}),

		qb.phashDistanceCriterionHandler(sceneFilter.PhashDistance),

		intCriterionHandler(sceneFilter.Rating100, "scenes.rating", nil),
		qb.oCountCriterionHandler(sceneFilter.OCounter),
		boolCriterionHandler(sceneFilter.Organized, "scenes.organized", nil),

		floatIntCriterionHandler(sceneFilter.Duration, "video_files.duration", qb.addVideoFilesTable),
		resolutionCriterionHandler(sceneFilter.Resolution, "video_files.height", "video_files.width", qb.addVideoFilesTable),
		orientationCriterionHandler(sceneFilter.Orientation, "video_files.height", "video_files.width", qb.addVideoFilesTable),
		floatIntCriterionHandler(sceneFilter.Framerate, "ROUND(video_files.frame_rate)", qb.addVideoFilesTable),
		intCriterionHandler(sceneFilter.Bitrate, "video_files.bit_rate", qb.addVideoFilesTable),
		qb.codecCriterionHandler(sceneFilter.VideoCodec, "video_files.video_codec", qb.addVideoFilesTable),
		qb.codecCriterionHandler(sceneFilter.AudioCodec, "video_files.audio_codec", qb.addVideoFilesTable),

		qb.hasMarkersCriterionHandler(sceneFilter.HasMarkers),
		qb.hasMarkerPerformersCriterionHandler(sceneFilter.HasMarkerPerformers),
		qb.isMissingCriterionHandler(sceneFilter.IsMissing),
		qb.urlsCriterionHandler(sceneFilter.URL),

		criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
			if sceneFilter.StashID != nil {
				sceneRepository.stashIDs.join(f, "scene_stash_ids", "scenes.id")
				stringCriterionHandler(sceneFilter.StashID, "scene_stash_ids.stash_id")(ctx, f)
			}
		}),

		&stashIDCriterionHandler{
			c:                 sceneFilter.StashIDEndpoint,
			stashIDRepository: &sceneRepository.stashIDs,
			stashIDTableAs:    "scene_stash_ids",
			parentIDCol:       "scenes.id",
		},

		boolCriterionHandler(sceneFilter.Interactive, "video_files.interactive", qb.addVideoFilesTable),
		intCriterionHandler(sceneFilter.InteractiveSpeed, "video_files.interactive_speed", qb.addVideoFilesTable),

		qb.captionCriterionHandler(sceneFilter.Captions),

		floatIntCriterionHandler(sceneFilter.ResumeTime, "scenes.resume_time", nil),
		floatIntCriterionHandler(sceneFilter.PlayDuration, "scenes.play_duration", nil),
		qb.playCountCriterionHandler(sceneFilter.PlayCount),
		criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
			if sceneFilter.LastPlayedAt != nil {
				f.addLeftJoin(
					fmt.Sprintf("(SELECT %s, MAX(%s) as last_played_at FROM %s GROUP BY %s)", sceneIDColumn, sceneViewDateColumn, scenesViewDatesTable, sceneIDColumn),
					"scene_last_view",
					fmt.Sprintf("scene_last_view.%s = scenes.id", sceneIDColumn),
				)
				h := timestampCriterionHandler{sceneFilter.LastPlayedAt, "IFNULL(last_played_at, datetime(0))", nil}
				h.handle(ctx, f)
			}
		}),

		qb.tagsCriterionHandler(sceneFilter.Tags),
		qb.tagCountCriterionHandler(sceneFilter.TagCount),
		qb.performersCriterionHandler(sceneFilter.Performers),
		qb.performerCountCriterionHandler(sceneFilter.PerformerCount),
		studioCriterionHandler(sceneTable, sceneFilter.Studios),

		qb.groupsCriterionHandler(sceneFilter.Groups),
		qb.moviesCriterionHandler(sceneFilter.Movies),

		qb.galleriesCriterionHandler(sceneFilter.Galleries),
		qb.performerTagsCriterionHandler(sceneFilter.PerformerTags),
		qb.sceneMarkerTagsCriterionHandler(sceneFilter.SceneMarkerTags),
		qb.performerFavoriteCriterionHandler(sceneFilter.PerformerFavorite),
		qb.performerAgeCriterionHandler(sceneFilter.PerformerAge),
		criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
			if sceneFilter.PerformerEthnicity != nil {
				pe := sceneFilter.PerformerEthnicity
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
		}),
		criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
			if sceneFilter.PerformerCountry != nil {
				pc := sceneFilter.PerformerCountry
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
					// at least one performer country in the set; include null countries implicitly, but must have some performer in set
					clause := fmt.Sprintf("EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scenes.id AND p.country IN (%s))", placeholders)
					f.addWhere(clause, args...)
					f.addWhere(existsPerformer)
				case models.CriterionModifierIncludesAll:
					// at least one performer from each selected country; do not restrict other countries or nulls
					for _, c := range countries {
						f.addWhere("EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scenes.id AND p.country = ?)", c)
					}
				case models.CriterionModifierEquals:
					// all performers must be in the set; exclude performers with NULL/empty country
					clause := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM performers_scenes ps JOIN performers p ON p.id = ps.performer_id WHERE ps.scene_id = scenes.id AND (p.country IS NULL OR TRIM(p.country) = '' OR p.country NOT IN (%s)))", placeholders)
					f.addWhere(clause, args...)
					f.addWhere(existsPerformer)
					// and ensure at least one performer from each selected country
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

		}),
		criterionHandlerFunc(func(ctx context.Context, f *filterBuilder) {
			if sceneFilter.PerformerRating != nil {
				pr := sceneFilter.PerformerRating
				// default to ALL performers must satisfy unless explicitly overridden
				modeAll := true
				if sceneFilter.PerformerRatingAll != nil {
					modeAll = *sceneFilter.PerformerRatingAll
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
		}),
		qb.phashDuplicatedCriterionHandler(sceneFilter.Duplicated, qb.addSceneFilesTable),
		&dateCriterionHandler{sceneFilter.Date, "scenes.date", nil},
		&timestampCriterionHandler{sceneFilter.CreatedAt, "scenes.created_at", nil},
		&timestampCriterionHandler{sceneFilter.UpdatedAt, "scenes.updated_at", nil},

		&relatedFilterHandler{
			relatedIDCol:   "scenes_galleries.gallery_id",
			relatedRepo:    galleryRepository.repository,
			relatedHandler: &galleryFilterHandler{sceneFilter.GalleriesFilter},
			joinFn: func(f *filterBuilder) {
				sceneRepository.galleries.innerJoin(f, "", "scenes.id")
			},
		},

		&relatedFilterHandler{
			relatedIDCol:   "performers_join.performer_id",
			relatedRepo:    performerRepository.repository,
			relatedHandler: &performerFilterHandler{sceneFilter.PerformersFilter},
			joinFn: func(f *filterBuilder) {
				sceneRepository.performers.innerJoin(f, "performers_join", "scenes.id")
			},
		},

		&relatedFilterHandler{
			relatedIDCol:   "scenes.studio_id",
			relatedRepo:    studioRepository.repository,
			relatedHandler: &studioFilterHandler{sceneFilter.StudiosFilter},
		},

		&relatedFilterHandler{
			relatedIDCol:   "scene_tag.tag_id",
			relatedRepo:    tagRepository.repository,
			relatedHandler: &tagFilterHandler{sceneFilter.TagsFilter},
			joinFn: func(f *filterBuilder) {
				sceneRepository.tags.innerJoin(f, "scene_tag", "scenes.id")
			},
		},

		&relatedFilterHandler{
			relatedIDCol:   "groups_scenes.group_id",
			relatedRepo:    groupRepository.repository,
			relatedHandler: &groupFilterHandler{sceneFilter.MoviesFilter},
			joinFn: func(f *filterBuilder) {
				sceneRepository.groups.innerJoin(f, "", "scenes.id")
			},
		},

		&relatedFilterHandler{
			relatedIDCol: "files.id",
			relatedRepo:  fileRepository.repository,
			relatedHandler: &fileFilterHandler{
				fileFilter: sceneFilter.FilesFilter,
				isRelated:  true,
			},
			joinFn: func(f *filterBuilder) {
				qb.addFilesTable(f)
				qb.addFoldersTable(f)
			},
			// don't use a subquery; join directly
			directJoin: true,
		},

		&relatedFilterHandler{
			relatedIDCol:   "scene_markers.id",
			relatedRepo:    sceneMarkerRepository.repository,
			relatedHandler: &sceneMarkerFilterHandler{sceneFilter.MarkersFilter},
			joinFn: func(f *filterBuilder) {
				f.addInnerJoin("scene_markers", "", "scenes.id")
			},
		},
	}
}

func (qb *sceneFilterHandler) addSceneFilesTable(f *filterBuilder) {
	f.addLeftJoin(scenesFilesTable, "", "scenes_files.scene_id = scenes.id")
}

func (qb *sceneFilterHandler) addFilesTable(f *filterBuilder) {
	qb.addSceneFilesTable(f)
	f.addLeftJoin(fileTable, "", "scenes_files.file_id = files.id")
}

func (qb *sceneFilterHandler) addFoldersTable(f *filterBuilder) {
	qb.addFilesTable(f)
	f.addLeftJoin(folderTable, "", "files.parent_folder_id = folders.id")
}

func (qb *sceneFilterHandler) addVideoFilesTable(f *filterBuilder) {
	qb.addSceneFilesTable(f)
	f.addLeftJoin(videoFileTable, "", "video_files.file_id = scenes_files.file_id")
}

func (qb *sceneFilterHandler) playCountCriterionHandler(count *models.IntCriterionInput) criterionHandlerFunc {
	h := countCriterionHandlerBuilder{
		primaryTable: sceneTable,
		joinTable:    scenesViewDatesTable,
		primaryFK:    sceneIDColumn,
	}

	return h.handler(count)
}

func (qb *sceneFilterHandler) oCountCriterionHandler(count *models.IntCriterionInput) criterionHandlerFunc {
	h := countCriterionHandlerBuilder{
		primaryTable: sceneTable,
		joinTable:    scenesODatesTable,
		primaryFK:    sceneIDColumn,
	}

	return h.handler(count)
}

func (qb *sceneFilterHandler) fileCountCriterionHandler(fileCount *models.IntCriterionInput) criterionHandlerFunc {
	h := countCriterionHandlerBuilder{
		primaryTable: sceneTable,
		joinTable:    scenesFilesTable,
		primaryFK:    sceneIDColumn,
	}

	return h.handler(fileCount)
}

func (qb *sceneFilterHandler) phashDuplicatedCriterionHandler(duplicatedFilter *models.PHashDuplicationCriterionInput, addJoinFn func(f *filterBuilder)) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		// TODO: Wishlist item: Implement Distance matching
		if duplicatedFilter != nil {
			if addJoinFn != nil {
				addJoinFn(f)
			}

			var v string
			if *duplicatedFilter.Duplicated {
				v = ">"
			} else {
				v = "="
			}

			f.addInnerJoin("(SELECT file_id FROM files_fingerprints INNER JOIN (SELECT fingerprint FROM files_fingerprints WHERE type = 'phash' GROUP BY fingerprint HAVING COUNT (fingerprint) "+v+" 1) dupes on files_fingerprints.fingerprint = dupes.fingerprint)", "scph", "scenes_files.file_id = scph.file_id")
		}
	}
}

func (qb *sceneFilterHandler) codecCriterionHandler(codec *models.StringCriterionInput, codecColumn string, addJoinFn func(f *filterBuilder)) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if codec != nil {
			if addJoinFn != nil {
				addJoinFn(f)
			}

			stringCriterionHandler(codec, codecColumn)(ctx, f)
		}
	}
}

func (qb *sceneFilterHandler) hasMarkersCriterionHandler(hasMarkers *string) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if hasMarkers != nil {
			f.addLeftJoin("scene_markers", "", "scene_markers.scene_id = scenes.id")
			if *hasMarkers == "true" {
				f.addHaving("count(scene_markers.scene_id) > 0")
			} else {
				f.addWhere("scene_markers.id IS NULL")
			}
		}
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

func (qb *sceneFilterHandler) isMissingCriterionHandler(isMissing *string) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if isMissing != nil && *isMissing != "" {
			switch *isMissing {
			case "url":
				scenesURLsTableMgr.join(f, "", "scenes.id")
				f.addWhere("scene_urls.url IS NULL")
			case "galleries":
				sceneRepository.galleries.join(f, "galleries_join", "scenes.id")
				f.addWhere("galleries_join.scene_id IS NULL")
			case "studio":
				f.addWhere("scenes.studio_id IS NULL")
			case "movie", "group":
				sceneRepository.groups.join(f, "groups_join", "scenes.id")
				f.addWhere("groups_join.scene_id IS NULL")
			case "performers":
				sceneRepository.performers.join(f, "performers_join", "scenes.id")
				f.addWhere("performers_join.scene_id IS NULL")
			case "date":
				f.addWhere(`scenes.date IS NULL OR scenes.date IS ""`)
			case "tags":
				sceneRepository.tags.join(f, "tags_join", "scenes.id")
				f.addWhere("tags_join.scene_id IS NULL")
			case "stash_id":
				sceneRepository.stashIDs.join(f, "scene_stash_ids", "scenes.id")
				f.addWhere("scene_stash_ids.scene_id IS NULL")
			case "phash":
				qb.addSceneFilesTable(f)
				f.addLeftJoin(fingerprintTable, "fingerprints_phash", "scenes_files.file_id = fingerprints_phash.file_id AND fingerprints_phash.type = 'phash'")
				f.addWhere("fingerprints_phash.fingerprint IS NULL")
			case "cover":
				f.addWhere("scenes.cover_blob IS NULL")
			default:
				f.addWhere("(scenes." + *isMissing + " IS NULL OR TRIM(scenes." + *isMissing + ") = '')")
			}
		}
	}
}

func (qb *sceneFilterHandler) urlsCriterionHandler(url *models.StringCriterionInput) criterionHandlerFunc {
	h := stringListCriterionHandlerBuilder{
		primaryTable: sceneTable,
		primaryFK:    sceneIDColumn,
		joinTable:    scenesURLsTable,
		stringColumn: sceneURLColumn,
		addJoinTable: func(f *filterBuilder) {
			scenesURLsTableMgr.join(f, "", "scenes.id")
		},
	}

	return h.handler(url)
}

func (qb *sceneFilterHandler) getMultiCriterionHandlerBuilder(foreignTable, joinTable, foreignFK string, addJoinsFunc func(f *filterBuilder)) multiCriterionHandlerBuilder {
	return multiCriterionHandlerBuilder{
		primaryTable: sceneTable,
		foreignTable: foreignTable,
		joinTable:    joinTable,
		primaryFK:    sceneIDColumn,
		foreignFK:    foreignFK,
		addJoinsFunc: addJoinsFunc,
	}
}

func (qb *sceneFilterHandler) captionCriterionHandler(captions *models.StringCriterionInput) criterionHandlerFunc {
	h := stringListCriterionHandlerBuilder{
		primaryTable: sceneTable,
		primaryFK:    sceneIDColumn,
		joinTable:    videoCaptionsTable,
		stringColumn: captionCodeColumn,
		addJoinTable: func(f *filterBuilder) {
			qb.addSceneFilesTable(f)
			f.addLeftJoin(videoCaptionsTable, "", "video_captions.file_id = scenes_files.file_id")
		},
		excludeHandler: func(f *filterBuilder, criterion *models.StringCriterionInput) {
			excludeClause := `scenes.id NOT IN (
				SELECT scenes_files.scene_id from scenes_files 
				INNER JOIN video_captions on video_captions.file_id = scenes_files.file_id 
				WHERE video_captions.language_code LIKE ?
			)`
			f.addWhere(excludeClause, criterion.Value)

			// TODO - should we also exclude null values?
		},
	}

	return h.handler(captions)
}

func (qb *sceneFilterHandler) tagsCriterionHandler(tags *models.HierarchicalMultiCriterionInput) criterionHandlerFunc {
	h := joinedHierarchicalMultiCriterionHandlerBuilder{
		primaryTable: sceneTable,
		foreignTable: tagTable,
		foreignFK:    "tag_id",

		relationsTable: "tags_relations",
		joinAs:         "scene_tag",
		joinTable:      scenesTagsTable,
		primaryFK:      sceneIDColumn,
	}

	return h.handler(tags)
}

func (qb *sceneFilterHandler) tagCountCriterionHandler(tagCount *models.IntCriterionInput) criterionHandlerFunc {
	h := countCriterionHandlerBuilder{
		primaryTable: sceneTable,
		joinTable:    scenesTagsTable,
		primaryFK:    sceneIDColumn,
	}

	return h.handler(tagCount)
}

func (qb *sceneFilterHandler) performersCriterionHandler(performers *models.MultiCriterionInput) criterionHandlerFunc {
	h := joinedMultiCriterionHandlerBuilder{
		primaryTable: sceneTable,
		joinTable:    performersScenesTable,
		joinAs:       "performers_join",
		primaryFK:    sceneIDColumn,
		foreignFK:    performerIDColumn,

		addJoinTable: func(f *filterBuilder) {
			sceneRepository.performers.join(f, "performers_join", "scenes.id")
		},
	}

	return h.handler(performers)
}

func (qb *sceneFilterHandler) performerCountCriterionHandler(performerCount *models.IntCriterionInput) criterionHandlerFunc {
	h := countCriterionHandlerBuilder{
		primaryTable: sceneTable,
		joinTable:    performersScenesTable,
		primaryFK:    sceneIDColumn,
	}

	return h.handler(performerCount)
}

func (qb *sceneFilterHandler) performerFavoriteCriterionHandler(performerfavorite *bool) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if performerfavorite != nil {
			f.addLeftJoin("performers_scenes", "", "scenes.id = performers_scenes.scene_id")

			if *performerfavorite {
				// contains at least one favorite
				f.addLeftJoin("performers", "", "performers.id = performers_scenes.performer_id")
				f.addWhere("performers.favorite = 1")
			} else {
				// contains zero favorites
				f.addLeftJoin(`(SELECT performers_scenes.scene_id as id FROM performers_scenes
JOIN performers ON performers.id = performers_scenes.performer_id
GROUP BY performers_scenes.scene_id HAVING SUM(performers.favorite) = 0)`, "nofaves", "scenes.id = nofaves.id")
				f.addWhere("performers_scenes.scene_id IS NULL OR nofaves.id IS NOT NULL")
			}
		}
	}
}

func (qb *sceneFilterHandler) performerAgeCriterionHandler(performerAge *models.IntCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if performerAge != nil {
			f.addInnerJoin("performers_scenes", "", "scenes.id = performers_scenes.scene_id")
			f.addInnerJoin("performers", "", "performers_scenes.performer_id = performers.id")

			f.addWhere("scenes.date != '' AND performers.birthdate != ''")
			f.addWhere("scenes.date IS NOT NULL AND performers.birthdate IS NOT NULL")

			ageCalc := "cast(strftime('%Y.%m%d', scenes.date) - strftime('%Y.%m%d', performers.birthdate) as int)"
			whereClause, args := getIntWhereClause(ageCalc, performerAge.Modifier, performerAge.Value, performerAge.Value2)
			f.addWhere(whereClause, args...)
		}
	}
}

// legacy handler
func (qb *sceneFilterHandler) moviesCriterionHandler(movies *models.MultiCriterionInput) criterionHandlerFunc {
	addJoinsFunc := func(f *filterBuilder) {
		sceneRepository.groups.join(f, "", "scenes.id")
		f.addLeftJoin("groups", "", "groups_scenes.group_id = groups.id")
	}
	h := qb.getMultiCriterionHandlerBuilder(groupTable, groupsScenesTable, "group_id", addJoinsFunc)
	return h.handler(movies)
}

func (qb *sceneFilterHandler) groupsCriterionHandler(groups *models.HierarchicalMultiCriterionInput) criterionHandlerFunc {
	h := joinedHierarchicalMultiCriterionHandlerBuilder{
		primaryTable: sceneTable,
		foreignTable: groupTable,
		foreignFK:    "group_id",

		relationsTable: groupRelationsTable,
		parentFK:       "containing_id",
		childFK:        "sub_id",
		joinAs:         "scene_group",
		joinTable:      groupsScenesTable,
		primaryFK:      sceneIDColumn,
	}

	return h.handler(groups)
}

func (qb *sceneFilterHandler) galleriesCriterionHandler(galleries *models.MultiCriterionInput) criterionHandlerFunc {
	addJoinsFunc := func(f *filterBuilder) {
		sceneRepository.galleries.join(f, "", "scenes.id")
		f.addLeftJoin("galleries", "", "scenes_galleries.gallery_id = galleries.id")
	}
	h := qb.getMultiCriterionHandlerBuilder(galleryTable, scenesGalleriesTable, "gallery_id", addJoinsFunc)
	return h.handler(galleries)
}

func (qb *sceneFilterHandler) performerTagsCriterionHandler(tags *models.HierarchicalMultiCriterionInput) criterionHandler {
	return &joinedPerformerTagsHandler{
		criterion:      tags,
		primaryTable:   sceneTable,
		joinTable:      performersScenesTable,
		joinPrimaryKey: sceneIDColumn,
	}
}

func (qb *sceneFilterHandler) sceneMarkerTagsCriterionHandler(tags *models.SceneMarkerTagsCriterionInput) criterionHandler {
	return &joinedSceneMarkerTagsHandler{
		criterion:      tags,
		primaryTable:   sceneTable,
		joinTable:      sceneMarkersTable,
		joinPrimaryKey: sceneIDColumn,
	}
}

func (qb *sceneFilterHandler) phashDistanceCriterionHandler(phashDistance *models.PhashDistanceCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if phashDistance != nil {
			qb.addSceneFilesTable(f)
			f.addLeftJoin(fingerprintTable, "fingerprints_phash", "scenes_files.file_id = fingerprints_phash.file_id AND fingerprints_phash.type = 'phash'")

			value, _ := utils.StringToPhash(phashDistance.Value)
			distance := 0
			if phashDistance.Distance != nil {
				distance = *phashDistance.Distance
			}

			if distance == 0 {
				// use the default handler
				intCriterionHandler(&models.IntCriterionInput{
					Value:    int(value),
					Modifier: phashDistance.Modifier,
				}, "fingerprints_phash.fingerprint", nil)(ctx, f)
			}

			switch {
			case phashDistance.Modifier == models.CriterionModifierEquals && distance > 0:
				// needed to avoid a type mismatch
				f.addWhere("typeof(fingerprints_phash.fingerprint) = 'integer'")
				f.addWhere("phash_distance(fingerprints_phash.fingerprint, ?) < ?", value, distance)
			case phashDistance.Modifier == models.CriterionModifierNotEquals && distance > 0:
				// needed to avoid a type mismatch
				f.addWhere("typeof(fingerprints_phash.fingerprint) = 'integer'")
				f.addWhere("phash_distance(fingerprints_phash.fingerprint, ?) > ?", value, distance)
			default:
				intCriterionHandler(&models.IntCriterionInput{
					Value:    int(value),
					Modifier: phashDistance.Modifier,
				}, "fingerprints_phash.fingerprint", nil)(ctx, f)
			}
		}
	}
}
