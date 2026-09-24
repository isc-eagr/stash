package api

import (
	"fmt"
	"strconv"

	"github.com/stashapp/stash/pkg/models"
)

func sceneReleaseExtendedInputCustom(
	translator changesetTranslator,
	rating *int,
	organized *bool,
	urls []string,
	performerIDs []string,
	tagIDs []string,
	groups []*models.SceneGroupInput,
	stashIDs []*models.StashIDInput,
	customFields *models.CustomFieldsInput,
) (models.SceneReleaseExtendedUpdateCustom, bool, error) {
	var update models.SceneReleaseExtendedUpdateCustom
	if translator.hasField("rating100") {
		if rating != nil && (*rating < 0 || *rating > 100) {
			return update, false, fmt.Errorf("rating100 must be between 0 and 100")
		}
		update.RatingSet = true
		update.Rating = rating
	}
	if translator.hasField("organized") {
		update.OrganizedSet = true
		update.Organized = organized != nil && *organized
	}
	if translator.hasField("urls") {
		update.URLsSet = true
		update.URLs = urls
	}
	if translator.hasField("performer_ids") {
		ids, err := translator.relatedIds(performerIDs)
		if err != nil {
			return update, false, fmt.Errorf("converting performer ids: %w", err)
		}
		update.PerformerIDsSet = true
		update.PerformerIDs = ids.List()
	}
	if translator.hasField("tag_ids") {
		ids, err := translator.relatedIds(tagIDs)
		if err != nil {
			return update, false, fmt.Errorf("converting tag ids: %w", err)
		}
		update.TagIDsSet = true
		update.TagIDs = ids.List()
	}
	if translator.hasField("groups") {
		update.GroupsSet = true
		for _, group := range groups {
			if group == nil {
				return update, false, fmt.Errorf("release group cannot be null")
			}
			id, err := strconv.Atoi(group.GroupID)
			if err != nil {
				return update, false, fmt.Errorf("invalid group id %q: %w", group.GroupID, err)
			}
			update.Groups = append(update.Groups, models.GroupsScenes{GroupID: id, SceneIndex: group.SceneIndex})
		}
	}
	if translator.hasField("stash_ids") {
		update.StashIDsSet = true
		for _, stashID := range stashIDs {
			if stashID == nil {
				return update, false, fmt.Errorf("release Stash ID cannot be null")
			}
			update.StashIDs = append(update.StashIDs, stashID.ToStashID())
		}
	}
	if translator.hasField("custom_fields") {
		update.CustomFields = customFields
	}
	changed := update.RatingSet || update.OrganizedSet || update.URLsSet ||
		update.PerformerIDsSet || update.TagIDsSet || update.GroupsSet ||
		update.StashIDsSet || update.CustomFields != nil
	return update, changed, nil
}
