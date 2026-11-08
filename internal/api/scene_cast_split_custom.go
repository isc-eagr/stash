package api

// CUSTOM: Sex and oral-only scenes split by vato count, for the Scene Types
// tiles on Vato and Studio details.

import (
	"context"

	"github.com/stashapp/stash/internal/manager/config"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/scene"
	"github.com/stashapp/stash/pkg/sqlite"
)

func sceneCastSplitCustom(split scene.SceneCastSplitCustom) *SceneCastSplit {
	return &SceneCastSplit{
		Solo:      split.Solo,
		Standard:  split.Standard,
		Threesome: split.Threesome,
		Group:     split.Group,
	}
}

// sceneTypeCastSplitCustom buckets the sex and oral scene sets by vato count.
func sceneTypeCastSplitCustom(ctx context.Context, sex, oral map[int]bool) (*SceneTypeCastSplit, error) {
	ids := make([]int, 0, len(sex)+len(oral))
	for id := range sex {
		ids = append(ids, id)
	}
	for id := range oral {
		ids = append(ids, id)
	}
	counts, err := sqlite.ScenePerformerCountsCustom(ctx, ids)
	if err != nil {
		return nil, err
	}
	return &SceneTypeCastSplit{
		Sex:  sceneCastSplitCustom(scene.SplitScenesByCastSizeCustom(sex, counts)),
		Oral: sceneCastSplitCustom(scene.SplitScenesByCastSizeCustom(oral, counts)),
	}, nil
}

func (r *performerResolver) SceneTypeCastSplit(ctx context.Context, obj *models.Performer) (ret *SceneTypeCastSplit, err error) {
	sexTagID, oralTagID, _, _, _, _, _ := getRoleTagIDs(config.GetInstance().GetUIConfiguration())
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		sex, oral, err := scene.PerformerSexOralScenesCustom(ctx, r.repository.SceneMarker, obj.ID, sexTagID, oralTagID)
		if err != nil {
			return err
		}
		ret, err = sceneTypeCastSplitCustom(ctx, sex, oral)
		return err
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

func (r *studioResolver) SceneTypeCastSplit(ctx context.Context, obj *models.Studio, depth *int) (ret *SceneTypeCastSplit, err error) {
	sexTagID, oralTagID, _, _, _, _, _ := getRoleTagIDs(config.GetInstance().GetUIConfiguration())
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		sex, oral, err := scene.StudioSexOralScenesCustom(ctx, r.repository.SceneMarker, r.repository.Scene, obj.ID, depth, sexTagID, oralTagID)
		if err != nil {
			return err
		}
		ret, err = sceneTypeCastSplitCustom(ctx, sex, oral)
		return err
	}); err != nil {
		return nil, err
	}
	return ret, nil
}
