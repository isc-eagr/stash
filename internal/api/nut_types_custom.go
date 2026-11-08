package api

// CUSTOM: nut and facial counts by quality for the Vato and Studio Detail Nut tiles.

import (
	"context"
	"strconv"

	"github.com/stashapp/stash/internal/manager/config"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/scene"
)

func reallyHotTagIDCustom(uiConfig map[string]interface{}) int {
	roleTagIDs, _ := uiConfig["roleTagIds"].(map[string]interface{})
	id, _ := strconv.Atoi(customStringConfigValue(roleTagIDs["reallyHotTagId"]))
	return id
}

func nutQualityCountsCustom(counts scene.NutQualityCountsCustom) *NutQualityCounts {
	return &NutQualityCounts{Plain: counts[0], ReallyHot: counts[1], Goat: counts[2]}
}

func nutTypeCountsCustom(counts scene.NutTypeCountsCustom) *NutTypeCounts {
	return &NutTypeCounts{
		Nut:    nutQualityCountsCustom(counts.Nut),
		Facial: nutQualityCountsCustom(counts.Facial),
	}
}

func (r *studioResolver) NutTypeCounts(ctx context.Context, obj *models.Studio, depth *int) (ret *NutTypeCounts, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, _, _, facialTagID, orgasmTagID, _, secondCameraTagID := getRoleTagIDs(uiConfig)
	_, _, _, goatTagID := activityStatsRoleTagIDsCustom()
	reallyHotTagID := reallyHotTagIDCustom(uiConfig)
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		counts, err := scene.StudioNutTypeCountsCustom(ctx, r.repository.SceneMarker, r.repository.Scene, r.repository.Tag, obj.ID, depth, facialTagID, orgasmTagID, secondCameraTagID, goatTagID, reallyHotTagID)
		ret = nutTypeCountsCustom(counts)
		return err
	}); err != nil {
		return nil, err
	}
	return ret, nil
}
