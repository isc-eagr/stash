package api

import (
	"context"

	"github.com/stashapp/stash/pkg/models"
)

func equalSceneStringsCustom(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}

	counts := make(map[string]int, len(left))
	for _, value := range left {
		counts[value]++
	}
	for _, value := range right {
		if counts[value] == 0 {
			return false
		}
		counts[value]--
	}

	return true
}

func equalSceneGroupsCustom(left, right []models.GroupsScenes) bool {
	if len(left) != len(right) {
		return false
	}

	type groupKey struct {
		groupID  int
		index    int
		hasIndex bool
	}
	keyFor := func(value models.GroupsScenes) groupKey {
		key := groupKey{groupID: value.GroupID}
		if value.SceneIndex != nil {
			key.index = *value.SceneIndex
			key.hasIndex = true
		}
		return key
	}

	counts := make(map[groupKey]int, len(left))
	for _, value := range left {
		counts[keyFor(value)]++
	}
	for _, value := range right {
		key := keyFor(value)
		if counts[key] == 0 {
			return false
		}
		counts[key]--
	}

	return true
}

func equalSceneStashIDsCustom(left, right []models.StashID) bool {
	if len(left) != len(right) {
		return false
	}

	matched := make([]bool, len(right))
	for _, leftValue := range left {
		found := false
		for i, rightValue := range right {
			if matched[i] || leftValue.Endpoint != rightValue.Endpoint || leftValue.StashID != rightValue.StashID || !leftValue.UpdatedAt.Equal(rightValue.UpdatedAt) {
				continue
			}
			matched[i] = true
			found = true
			break
		}
		if !found {
			return false
		}
	}

	return true
}

func suppressUnchangedSceneRelationshipsCustom(ctx context.Context, qb models.SceneReaderWriter, sceneID int, updated *models.ScenePartial) ([]int, error) {
	var previousPerformerIDs []int
	var err error

	if updated.URLs != nil && updated.URLs.Mode == models.RelationshipUpdateModeSet {
		var existing []string
		existing, err = qb.GetURLs(ctx, sceneID)
		if err == nil && equalSceneStringsCustom(existing, updated.URLs.Values) {
			updated.URLs = nil
		}
	}
	if err != nil {
		return nil, err
	}

	if updated.PerformerIDs != nil && updated.PerformerIDs.Mode == models.RelationshipUpdateModeSet {
		previousPerformerIDs, err = qb.GetPerformerIDs(ctx, sceneID)
		if err == nil && equalSceneMarkerIDSetsCustom(previousPerformerIDs, updated.PerformerIDs.IDs) {
			updated.PerformerIDs = nil
			previousPerformerIDs = nil
		}
	}
	if err != nil {
		return nil, err
	}

	if updated.TagIDs != nil && updated.TagIDs.Mode == models.RelationshipUpdateModeSet {
		var existing []int
		existing, err = qb.GetTagIDs(ctx, sceneID)
		if err == nil && equalSceneMarkerIDSetsCustom(existing, updated.TagIDs.IDs) {
			updated.TagIDs = nil
		}
	}
	if err != nil {
		return nil, err
	}

	if updated.GalleryIDs != nil && updated.GalleryIDs.Mode == models.RelationshipUpdateModeSet {
		var existing []int
		existing, err = qb.GetGalleryIDs(ctx, sceneID)
		if err == nil && equalSceneMarkerIDSetsCustom(existing, updated.GalleryIDs.IDs) {
			updated.GalleryIDs = nil
		}
	}
	if err != nil {
		return nil, err
	}

	if updated.GroupIDs != nil && updated.GroupIDs.Mode == models.RelationshipUpdateModeSet {
		var existing []models.GroupsScenes
		existing, err = qb.GetGroups(ctx, sceneID)
		if err == nil && equalSceneGroupsCustom(existing, updated.GroupIDs.Groups) {
			updated.GroupIDs = nil
		}
	}
	if err != nil {
		return nil, err
	}

	if updated.StashIDs != nil && updated.StashIDs.Mode == models.RelationshipUpdateModeSet {
		var existing []models.StashID
		existing, err = qb.GetStashIDs(ctx, sceneID)
		if err == nil && equalSceneStashIDsCustom(existing, updated.StashIDs.StashIDs) {
			updated.StashIDs = nil
		}
	}
	if err != nil {
		return nil, err
	}

	return previousPerformerIDs, nil
}
