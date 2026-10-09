package api

// CUSTOM: Custom Studio resolver methods for role-based scene counts.

import (
	"context"
	"strconv"

	"github.com/stashapp/stash/internal/manager/config"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/performer"
	"github.com/stashapp/stash/pkg/scene"
)

func (r *studioResolver) UniquePerformerCount(ctx context.Context, obj *models.Studio, depth *int) (ret int, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = performer.CountUniqueByStudioID(ctx, r.repository.Performer, obj.ID, depth)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

// CUSTOM: begin - batched resolvers

// StudioRoleCounts resolves all non-performer-filtered role counts in a single DB pass,
// eliminating the redundant getStudioSceneIDs calls that fire for each individual count field.
func (r *studioResolver) StudioRoleCounts(ctx context.Context, obj *models.Studio, depth *int) (ret *StudioRoleCounts, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, oralTagID, soloTagID, facialTagID, _, _, _ := getRoleTagIDs(uiConfig)

	var data *scene.StudioRoleCountsData
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		data, err = scene.GetStudioRoleCounts(ctx, r.repository.SceneMarker, r.repository.Scene, obj.ID, depth, sexTagID, oralTagID, soloTagID, facialTagID)
		return err
	}); err != nil {
		return nil, err
	}

	return &StudioRoleCounts{
		SexSceneCount:    data.SexSceneCount,
		OralSceneCount:   data.OralSceneCount,
		SoloSceneCount:   data.SoloSceneCount,
		FacialSceneCount: data.FacialSceneCount,
	}, nil
}

// FacialCount uses the Facial Stats "Total Facials" rule for this studio's scenes.
func (r *studioResolver) FacialCount(ctx context.Context, obj *models.Studio, depth *int) (ret int, err error) {
	studioID := strconv.Itoa(obj.ID)
	sceneScope, sceneScopeArgs, err := sceneStatsSceneScopeCustom(&studioID, depth, nil)
	if err != nil {
		return 0, err
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = weightedMarkerCountInScopeCustom(ctx, "facialTagId", sceneScope, sceneScopeArgs)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

// StudioPerformerRoleStats resolves all performer-filtered marker-based counts in a single batch,
// cutting getStudioSceneIDs calls from ~21 down to 2 for a given (studioID, depth, performerID).
func (r *studioResolver) StudioPerformerRoleStats(ctx context.Context, obj *models.Studio, performerID string, depth *int) (ret *StudioPerformerRoleStats, err error) {
	perfID, err := strconv.Atoi(performerID)
	if err != nil {
		return nil, err
	}

	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, oralTagID, soloTagID, facialTagID, orgasmTagID, feetTagID, secondCameraTagID := getRoleTagIDs(uiConfig)

	var data *scene.StudioPerformerRoleStatsData
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		data, err = scene.GetStudioPerformerRoleStats(ctx, r.repository.SceneMarker, r.repository.Scene, r.repository.Tag, obj.ID, depth, perfID, sexTagID, oralTagID, soloTagID, facialTagID, orgasmTagID, feetTagID, secondCameraTagID)
		return err
	}); err != nil {
		return nil, err
	}

	return &StudioPerformerRoleStats{
		SexSceneCount:               data.SexSceneCount,
		SexTopCount:                 data.SexTopCount,
		SexBottomCount:              data.SexBottomCount,
		SexWithTopCount:             data.SexWithTopCount,
		SexWithBottomCount:          data.SexWithBottomCount,
		OralSceneCount:              data.OralSceneCount,
		OralTopCount:                data.OralTopCount,
		OralBottomCount:             data.OralBottomCount,
		OralWithTopCount:            data.OralWithTopCount,
		OralWithBottomCount:         data.OralWithBottomCount,
		SoloSceneCount:              data.SoloSceneCount,
		FacialSceneCount:            data.FacialSceneCount,
		FacialTopCount:              data.FacialTopCount,
		FacialBottomCount:           data.FacialBottomCount,
		FacialWithTopCount:          data.FacialWithTopCount,
		FacialWithBottomCount:       data.FacialWithBottomCount,
		FacialMarkerWithTopCount:    data.FacialMarkerWithTopCount,
		FacialMarkerWithBottomCount: data.FacialMarkerWithBottomCount,
		SexUniquePartnerCount:       data.SexUniquePartnerCount,
		OralUniquePartnerCount:      data.OralUniquePartnerCount,
		FacialUniquePartnerCount:    data.FacialUniquePartnerCount,
		OrgasmTopCount:              data.OrgasmTopCount,
		FacialMarkerCount:           data.FacialMarkerCount,
		FeetTopCount:                data.FeetTopCount,
	}, nil
}

// CUSTOM: end
