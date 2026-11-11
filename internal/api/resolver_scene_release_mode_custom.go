package api

// CUSTOM: release-mode scene page operations: marker tags, cover from a video
// frame, and copying items between a scene and its releases.

import (
	"context"
	"fmt"
	"sort"
	"strconv"

	"github.com/stashapp/stash/internal/api/loaders"
	"github.com/stashapp/stash/internal/manager"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/utils"
)

// SceneReleaseMarkerTags mirrors sceneMarkerTags for a release's own markers.
func (r *queryResolver) SceneReleaseMarkerTags(ctx context.Context, releaseIDText string) ([]*SceneMarkerTag, error) {
	releaseID, err := strconv.Atoi(releaseIDText)
	if err != nil {
		return nil, fmt.Errorf("%w: release_id is not an integer: '%s'", ErrInput, releaseIDText)
	}
	var markers []*models.SceneMarker
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		release, err := r.repository.SceneRelease.Find(ctx, releaseID)
		if err != nil {
			return err
		}
		if release == nil {
			return fmt.Errorf("release with id %d not found", releaseID)
		}
		markers, err = r.repository.SceneRelease.GetMarkersCustom(ctx, releaseID)
		// Keep legacy scene_id consumers pointed at the parent scene.
		for _, marker := range markers {
			marker.SceneID = release.SceneID
		}
		return err
	}); err != nil {
		return nil, err
	}

	primaryTagIDs := make([]int, len(markers))
	for i, marker := range markers {
		primaryTagIDs[i] = marker.PrimaryTagID
	}
	primaryTags, errs := loaders.From(ctx).TagByID.LoadAll(primaryTagIDs)
	if err := firstError(errs); err != nil {
		return nil, err
	}
	return groupMarkersByPrimaryTagCustom(markers, primaryTags)
}

// groupMarkersByPrimaryTagCustom groups markers in the order sceneMarkerTags
// uses: tags whose first marker plays earlier come first.
func groupMarkersByPrimaryTagCustom(markers []*models.SceneMarker, primaryTags []*models.Tag) ([]*SceneMarkerTag, error) {
	var keys []int
	tags := make(map[int]*SceneMarkerTag)
	for i, marker := range markers {
		tag := primaryTags[i]
		if tag == nil {
			return nil, fmt.Errorf("tag with id %d not found", marker.PrimaryTagID)
		}
		if _, ok := tags[tag.ID]; !ok {
			tags[tag.ID] = &SceneMarkerTag{Tag: tag}
			keys = append(keys, tag.ID)
		}
		tags[tag.ID].SceneMarkers = append(tags[tag.ID].SceneMarkers, marker)
	}
	sort.SliceStable(keys, func(i, j int) bool {
		return tags[keys[i]].SceneMarkers[0].Seconds < tags[keys[j]].SceneMarkers[0].Seconds
	})
	ret := make([]*SceneMarkerTag, 0, len(keys))
	for _, key := range keys {
		ret = append(ret, tags[key])
	}
	return ret, nil
}

// SceneReleaseGenerateScreenshot is sceneGenerateScreenshot for a release: the
// frame comes from the release's primary file and becomes the release cover.
func (r *mutationResolver) SceneReleaseGenerateScreenshot(ctx context.Context, id string, at *float64) (string, error) {
	releaseID, err := strconv.Atoi(id)
	if err != nil {
		return "", fmt.Errorf("%w: id is not an integer: '%s'", ErrInput, id)
	}
	if err := manager.CheckReleaseScreenshotCustom(ctx, r.repository, releaseID); err != nil {
		return "", err
	}
	return strconv.Itoa(manager.GetInstance().GenerateReleaseScreenshotCustom(ctx, releaseID, at)), nil
}

// sceneOwnerFromInputCustom reads one owner from a scene/release ID pair.
func sceneOwnerFromInputCustom(side string, sceneID, releaseID *string) (models.SceneOwnerCustom, error) {
	var owner models.SceneOwnerCustom
	if (sceneID == nil) == (releaseID == nil) {
		return owner, fmt.Errorf("%w: set exactly one of %[2]s_scene_id or %[2]s_release_id", ErrInput, side)
	}
	var err error
	if sceneID != nil {
		owner.SceneID, err = strconv.Atoi(*sceneID)
	} else {
		owner.ReleaseID, err = strconv.Atoi(*releaseID)
	}
	if err != nil || (owner.SceneID <= 0 && owner.ReleaseID <= 0) {
		return owner, fmt.Errorf("%w: invalid %s owner ID", ErrInput, side)
	}
	return owner, nil
}

// sceneOwnerFamilyCustom returns the scene whose family the owner belongs to.
func (r *mutationResolver) sceneOwnerFamilyCustom(ctx context.Context, owner models.SceneOwnerCustom) (int, error) {
	if owner.ReleaseID != 0 {
		release, err := r.repository.SceneRelease.Find(ctx, owner.ReleaseID)
		if err != nil {
			return 0, err
		}
		if release == nil {
			return 0, fmt.Errorf("release with id %d not found", owner.ReleaseID)
		}
		return release.SceneID, nil
	}
	scene, err := r.repository.Scene.Find(ctx, owner.SceneID)
	if err != nil {
		return 0, err
	}
	if scene == nil {
		return 0, fmt.Errorf("scene with id %d not found", owner.SceneID)
	}
	return scene.ID, nil
}

func (r *mutationResolver) SceneOwnerCopyItems(ctx context.Context, input SceneOwnerCopyItemsInput) (*SceneOwnerCopyItemsResult, error) {
	from, err := sceneOwnerFromInputCustom("from", input.FromSceneID, input.FromReleaseID)
	if err != nil {
		return nil, err
	}
	to, err := sceneOwnerFromInputCustom("to", input.ToSceneID, input.ToReleaseID)
	if err != nil {
		return nil, err
	}
	if from == to {
		return nil, fmt.Errorf("%w: source and target are the same", ErrInput)
	}
	kinds := models.SceneOwnerCopyKindsCustom{
		Markers:         utils.IsTrue(input.Markers),
		NegativeMarkers: utils.IsTrue(input.NegativeMarkers),
		LoopPresets:     utils.IsTrue(input.LoopPresets),
	}
	if !kinds.Markers && !kinds.NegativeMarkers && !kinds.LoopPresets {
		return nil, fmt.Errorf("%w: choose markers, negative_markers, or loop_presets", ErrInput)
	}

	var copied models.SceneOwnerCopyResultCustom
	if err := r.withTxn(ctx, func(ctx context.Context) error {
		fromFamily, err := r.sceneOwnerFamilyCustom(ctx, from)
		if err != nil {
			return err
		}
		toFamily, err := r.sceneOwnerFamilyCustom(ctx, to)
		if err != nil {
			return err
		}
		if fromFamily != toFamily {
			return fmt.Errorf("%w: source and target must be a scene and its own releases", ErrInput)
		}

		// New scene markers can change the scene's rubric mode, as on create.
		var previousModes map[int]string
		if kinds.Markers && to.SceneID != 0 {
			if previousModes, err = r.sceneRatingModesCustom(ctx, []int{to.SceneID}); err != nil {
				return err
			}
		}
		if copied, err = r.repository.SceneRelease.CopyOwnerItemsCustom(ctx, from, to, kinds); err != nil {
			return err
		}
		if copied.Markers == 0 {
			return nil
		}
		if to.ReleaseID != 0 {
			return r.recalculateReleaseAdvisorsCustom(ctx, to.ReleaseID)
		}
		return r.resetSceneAdvisorsIfModeChangedCustom(ctx, previousModes)
	}); err != nil {
		return nil, err
	}

	return &SceneOwnerCopyItemsResult{
		Markers:         copied.Markers,
		NegativeMarkers: copied.NegativeMarkers,
		LoopPresets:     copied.LoopPresets,
	}, nil
}
