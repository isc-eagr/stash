package api

// CUSTOM: merge dialog choices for fork-owned scene data.

import (
	"context"
	"fmt"
	"maps"
	"slices"
	"strconv"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/sliceutil/stringslice"
	"github.com/stashapp/stash/pkg/utils"
)

// sceneMergeCustomDataCustom applies the merge choices for fork-owned data. It
// must run before the sources are destroyed and returns the advisor mode the
// destination's answers were given in, for the post-merge mode check.
func (r *mutationResolver) sceneMergeCustomDataCustom(ctx context.Context, input SceneMergeInput, srcIDs []int, destID int) (map[int]string, error) {
	previousModes, err := r.sceneRatingModesCustom(ctx, append([]int{destID}, srcIDs...))
	if err != nil {
		return nil, err
	}

	options := models.SceneMergeOptionsCustom{IncludeOHistory: utils.IsTrue(input.OHistory)}
	if options.NegativeMarkerIDs, err = mergeKeepIDsCustom(input.NegativeMarkerIds); err != nil {
		return nil, fmt.Errorf("converting negative marker ids: %w", err)
	}
	if options.LoopPresetIDs, err = mergeKeepIDsCustom(input.LoopPresetIds); err != nil {
		return nil, fmt.Errorf("converting loop preset ids: %w", err)
	}
	if options.RatingSceneID, err = mergeSceneChoiceCustom(input.RatingSceneID); err != nil {
		return nil, fmt.Errorf("converting rating scene id: %w", err)
	}
	if options.StashDBMatchesSceneID, err = mergeSceneChoiceCustom(input.StashdbMatchesSceneID); err != nil {
		return nil, fmt.Errorf("converting StashDB matches scene id: %w", err)
	}

	releaseIDs, err := mergeKeepIDsCustom(input.ReleaseIds)
	if err != nil {
		return nil, fmt.Errorf("converting release ids: %w", err)
	}
	if releaseIDs != nil {
		if err := r.pruneMergeReleasesCustom(ctx, srcIDs, destID, releaseIDs); err != nil {
			return nil, err
		}
	}

	ratingSourceID, err := r.repository.Scene.MergeCustomDataCustom(ctx, srcIDs, destID, options)
	if err != nil {
		return nil, err
	}

	previousMode := previousModes[destID]
	if ratingSourceID != 0 {
		previousMode = previousModes[ratingSourceID]
	}
	return map[int]string{destID: previousMode}, nil
}

// pruneMergeReleasesCustom deletes the releases not kept, moving their files
// to the destination as Delete Release does.
func (r *mutationResolver) pruneMergeReleasesCustom(ctx context.Context, srcIDs []int, destID int, keep []int) error {
	pending := make(map[int]bool, len(keep))
	for _, id := range keep {
		pending[id] = true
	}

	pruned := false
	for _, sceneID := range append([]int{destID}, srcIDs...) {
		releases, err := r.repository.SceneRelease.FindBySceneID(ctx, sceneID)
		if err != nil {
			return err
		}
		for _, release := range releases {
			if pending[release.ID] {
				delete(pending, release.ID)
				continue
			}
			if err := r.repository.SceneRelease.AssignFilesToScene(ctx, release.ID, destID); err != nil {
				return err
			}
			if err := r.repository.SceneRelease.Destroy(ctx, release.ID); err != nil {
				return err
			}
			pruned = true
		}
	}
	if len(pending) > 0 {
		return fmt.Errorf("release %d is not part of the merge", slices.Min(slices.Collect(maps.Keys(pending))))
	}
	if pruned {
		return r.repository.Scene.EnsurePrimaryFileCustom(ctx, destID)
	}
	return nil
}

// mergeKeepIDsCustom keeps an omitted list nil, which keeps every row.
func mergeKeepIDsCustom(ids []string) ([]int, error) {
	if ids == nil {
		return nil, nil
	}
	return stringslice.StringSliceToIntSlice(ids)
}

func mergeSceneChoiceCustom(id *string) (*int, error) {
	if id == nil {
		return nil, nil
	}
	ret, err := strconv.Atoi(*id)
	if err != nil {
		return nil, err
	}
	return &ret, nil
}
