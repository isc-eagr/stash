package api

import (
	"context"
	"sort"
	"strconv"

	"github.com/stashapp/stash/internal/manager/config"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/scene"
)

// ScenePerformerMarkerRoles returns scene-marker roles for the scene's full
// cast in one transaction. Cast members without marker roles are included with
// an empty roles array.
func (r *queryResolver) ScenePerformerMarkerRoles(ctx context.Context, sceneID string) (ret []*models.ScenePerformerMarkerRoles, err error) {
	sid, err := strconv.Atoi(sceneID)
	if err != nil {
		return nil, err
	}

	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, oralTagID, soloTagID, facialTagID, orgasmTagID, feetTagID, secondCameraTagID := getRoleTagIDs(uiConfig)

	err = r.withReadTxn(ctx, func(ctx context.Context) error {
		rolesByPerformer, err := scene.GetPerformerMarkerRolesForSceneBatch(ctx, r.repository.SceneMarker, r.repository.Tag, sid, sexTagID, oralTagID, soloTagID, facialTagID, orgasmTagID, feetTagID, secondCameraTagID)
		if err != nil {
			return err
		}

		performerIDs, err := r.repository.Scene.GetPerformerIDs(ctx, sid)
		if err != nil {
			return err
		}
		for performerID := range rolesByPerformer {
			if !containsPerformerIDCustom(performerIDs, performerID) {
				performerIDs = append(performerIDs, performerID)
			}
		}
		sort.Ints(performerIDs)

		ret = make([]*models.ScenePerformerMarkerRoles, 0, len(performerIDs))
		for _, performerID := range performerIDs {
			roles := rolesByPerformer[performerID]
			if roles == nil {
				roles = []string{}
			}
			ret = append(ret, &models.ScenePerformerMarkerRoles{
				PerformerID: performerID,
				Roles:       roles,
			})
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return ret, nil
}

func containsPerformerIDCustom(performerIDs []int, target int) bool {
	for _, performerID := range performerIDs {
		if performerID == target {
			return true
		}
	}
	return false
}
