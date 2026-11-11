package api

// CUSTOM: Flattened scene-marker tag ancestry for scene-card insights.

import (
	"context"
	"fmt"
	"sort"
	"strconv"

	"github.com/stashapp/stash/pkg/models"
)

type sceneMarkerTagAncestorReaderCustom interface {
	FindTagAncestorIDsBySceneIDCustom(ctx context.Context, sceneID int) (map[int][]int, error)
}

func (r *sceneResolver) SceneMarkerTagAncestors(ctx context.Context, obj *models.Scene) ([]*SceneMarkerTagAncestors, error) {
	reader, ok := r.repository.SceneMarker.(sceneMarkerTagAncestorReaderCustom)
	if !ok {
		return nil, fmt.Errorf("scene marker repository does not support tag ancestry")
	}

	var ancestorsByTag map[int][]int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		var queryErr error
		ancestorsByTag, queryErr = reader.FindTagAncestorIDsBySceneIDCustom(ctx, obj.ID)
		return queryErr
	}); err != nil {
		return nil, err
	}

	return sceneMarkerTagAncestorsCustom(ancestorsByTag), nil
}

func (r *sceneReleaseResolver) SceneMarkerTagAncestors(ctx context.Context, obj *models.SceneRelease) ([]*SceneMarkerTagAncestors, error) {
	var ancestorsByTag map[int][]int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		var queryErr error
		ancestorsByTag, queryErr = r.repository.SceneRelease.FindMarkerTagAncestorIDsCustom(ctx, obj.ID)
		return queryErr
	}); err != nil {
		return nil, err
	}
	return sceneMarkerTagAncestorsCustom(ancestorsByTag), nil
}

func sceneMarkerTagAncestorsCustom(ancestorsByTag map[int][]int) []*SceneMarkerTagAncestors {
	tagIDs := make([]int, 0, len(ancestorsByTag))
	for tagID := range ancestorsByTag {
		tagIDs = append(tagIDs, tagID)
	}
	sort.Ints(tagIDs)

	ret := make([]*SceneMarkerTagAncestors, 0, len(tagIDs))
	for _, tagID := range tagIDs {
		ancestorIDs := ancestorsByTag[tagID]
		sort.Ints(ancestorIDs)
		serializedAncestorIDs := make([]string, len(ancestorIDs))
		for i, ancestorID := range ancestorIDs {
			serializedAncestorIDs[i] = strconv.Itoa(ancestorID)
		}
		ret = append(ret, &SceneMarkerTagAncestors{
			TagID:       strconv.Itoa(tagID),
			AncestorIds: serializedAncestorIDs,
		})
	}

	return ret
}
