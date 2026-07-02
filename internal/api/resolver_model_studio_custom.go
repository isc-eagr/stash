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

func (r *studioResolver) SexSceneCount(ctx context.Context, obj *models.Studio, depth *int, performerID *string) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, _, _, _, _, _, _ := getRoleTagIDs(uiConfig)

	if sexTagID == 0 {
		return 0, nil
	}

	var perfID *int
	if performerID != nil {
		id, err := strconv.Atoi(*performerID)
		if err != nil {
			return 0, err
		}
		perfID = &id
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByStudioMarkerRole(ctx, r.repository.SceneMarker, r.repository.Scene, obj.ID, depth, sexTagID, "", perfID)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

func (r *studioResolver) SexTopCount(ctx context.Context, obj *models.Studio, depth *int, performerID *string) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, _, _, _, _, _, _ := getRoleTagIDs(uiConfig)

	if sexTagID == 0 {
		return 0, nil
	}

	var perfID *int
	if performerID != nil {
		id, err := strconv.Atoi(*performerID)
		if err != nil {
			return 0, err
		}
		perfID = &id
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByStudioMarkerRole(ctx, r.repository.SceneMarker, r.repository.Scene, obj.ID, depth, sexTagID, "top", perfID)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

func (r *studioResolver) SexBottomCount(ctx context.Context, obj *models.Studio, depth *int, performerID *string) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, _, _, _, _, _, _ := getRoleTagIDs(uiConfig)

	if sexTagID == 0 {
		return 0, nil
	}

	var perfID *int
	if performerID != nil {
		id, err := strconv.Atoi(*performerID)
		if err != nil {
			return 0, err
		}
		perfID = &id
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByStudioMarkerRole(ctx, r.repository.SceneMarker, r.repository.Scene, obj.ID, depth, sexTagID, "bottom", perfID)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

func (r *studioResolver) SexWithTopCount(ctx context.Context, obj *models.Studio, depth *int, performerID *string) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, _, _, _, _, _, _ := getRoleTagIDs(uiConfig)

	if sexTagID == 0 || performerID == nil {
		return 0, nil
	}

	perfID, err := strconv.Atoi(*performerID)
	if err != nil {
		return 0, err
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		counts, err := scene.GetCoPerformersWithCountsByStudio(ctx, r.repository.SceneMarker, r.repository.Scene, obj.ID, depth, perfID, sexTagID, "top", 0)
		if err != nil {
			return err
		}
		ret = len(counts)
		return nil
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

func (r *studioResolver) SexWithBottomCount(ctx context.Context, obj *models.Studio, depth *int, performerID *string) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, _, _, _, _, _, _ := getRoleTagIDs(uiConfig)

	if sexTagID == 0 || performerID == nil {
		return 0, nil
	}

	perfID, err := strconv.Atoi(*performerID)
	if err != nil {
		return 0, err
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		counts, err := scene.GetCoPerformersWithCountsByStudio(ctx, r.repository.SceneMarker, r.repository.Scene, obj.ID, depth, perfID, sexTagID, "bottom", 0)
		if err != nil {
			return err
		}
		ret = len(counts)
		return nil
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

// OralSceneCount returns the count of scenes with oral markers but not sex markers
func (r *studioResolver) OralSceneCount(ctx context.Context, obj *models.Studio, depth *int, performerID *string) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, oralTagID, _, _, _, _, _ := getRoleTagIDs(uiConfig)

	if oralTagID == 0 {
		return 0, nil
	}

	var perfID *int
	if performerID != nil {
		id, err := strconv.Atoi(*performerID)
		if err != nil {
			return 0, err
		}
		perfID = &id
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByStudioMarkerRoleExcluding(ctx, r.repository.SceneMarker, r.repository.Scene, obj.ID, depth, oralTagID, "", sexTagID, perfID)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

func (r *studioResolver) OralWithTopCount(ctx context.Context, obj *models.Studio, depth *int, performerID *string) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, oralTagID, _, _, _, _, _ := getRoleTagIDs(uiConfig)

	if oralTagID == 0 || performerID == nil {
		return 0, nil
	}

	perfID, err := strconv.Atoi(*performerID)
	if err != nil {
		return 0, err
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		counts, err := scene.GetCoPerformersWithCountsByStudio(ctx, r.repository.SceneMarker, r.repository.Scene, obj.ID, depth, perfID, oralTagID, "top", -1)
		if err != nil {
			return err
		}
		ret = len(counts)
		return nil
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

func (r *studioResolver) OralWithBottomCount(ctx context.Context, obj *models.Studio, depth *int, performerID *string) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, oralTagID, _, _, _, _, _ := getRoleTagIDs(uiConfig)

	if oralTagID == 0 || performerID == nil {
		return 0, nil
	}

	perfID, err := strconv.Atoi(*performerID)
	if err != nil {
		return 0, err
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		counts, err := scene.GetCoPerformersWithCountsByStudio(ctx, r.repository.SceneMarker, r.repository.Scene, obj.ID, depth, perfID, oralTagID, "bottom", -1)
		if err != nil {
			return err
		}
		ret = len(counts)
		return nil
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

func (r *studioResolver) OralTopCount(ctx context.Context, obj *models.Studio, depth *int, performerID *string) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, oralTagID, _, _, _, _, _ := getRoleTagIDs(uiConfig)

	if oralTagID == 0 {
		return 0, nil
	}

	var perfID *int
	if performerID != nil {
		id, err := strconv.Atoi(*performerID)
		if err != nil {
			return 0, err
		}
		perfID = &id
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByStudioMarkerRoleExcluding(ctx, r.repository.SceneMarker, r.repository.Scene, obj.ID, depth, oralTagID, "top", sexTagID, perfID)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

func (r *studioResolver) OralBottomCount(ctx context.Context, obj *models.Studio, depth *int, performerID *string) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, oralTagID, _, _, _, _, _ := getRoleTagIDs(uiConfig)

	if oralTagID == 0 {
		return 0, nil
	}

	var perfID *int
	if performerID != nil {
		id, err := strconv.Atoi(*performerID)
		if err != nil {
			return 0, err
		}
		perfID = &id
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByStudioMarkerRoleExcluding(ctx, r.repository.SceneMarker, r.repository.Scene, obj.ID, depth, oralTagID, "bottom", sexTagID, perfID)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

// SoloSceneCount returns the count of scenes with solo markers but not sex/oral markers
func (r *studioResolver) SoloSceneCount(ctx context.Context, obj *models.Studio, depth *int, performerID *string) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, oralTagID, soloTagID, _, _, _, _ := getRoleTagIDs(uiConfig)

	if soloTagID == 0 {
		return 0, nil
	}

	var perfID *int
	if performerID != nil {
		id, err := strconv.Atoi(*performerID)
		if err != nil {
			return 0, err
		}
		perfID = &id
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByStudioMarkerRoleExcludingMultiple(ctx, r.repository.SceneMarker, r.repository.Scene, obj.ID, depth, soloTagID, "top", []int{sexTagID, oralTagID}, perfID) // CUSTOM: only top role counts as jerk/solo
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

// FacialSceneCount returns the count of scenes with facial markers (independent of other markers)
func (r *studioResolver) FacialSceneCount(ctx context.Context, obj *models.Studio, depth *int, performerID *string) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, _, _, facialTagID, _, _, _ := getRoleTagIDs(uiConfig)

	if facialTagID == 0 {
		return 0, nil
	}

	var perfID *int
	if performerID != nil {
		id, err := strconv.Atoi(*performerID)
		if err != nil {
			return 0, err
		}
		perfID = &id
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByStudioMarkerRole(ctx, r.repository.SceneMarker, r.repository.Scene, obj.ID, depth, facialTagID, "", perfID)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

func (r *studioResolver) FacialTopCount(ctx context.Context, obj *models.Studio, depth *int, performerID *string) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, _, _, facialTagID, _, _, _ := getRoleTagIDs(uiConfig)

	if facialTagID == 0 {
		return 0, nil
	}

	var perfID *int
	if performerID != nil {
		id, err := strconv.Atoi(*performerID)
		if err != nil {
			return 0, err
		}
		perfID = &id
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByStudioMarkerRole(ctx, r.repository.SceneMarker, r.repository.Scene, obj.ID, depth, facialTagID, "top", perfID)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

func (r *studioResolver) FacialMarkerWithTopCount(ctx context.Context, obj *models.Studio, depth *int, performerID *string) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, _, _, facialTagID, _, _, secondCameraTagID := getRoleTagIDs(uiConfig)

	if facialTagID == 0 || performerID == nil {
		return 0, nil
	}

	perfID, err := strconv.Atoi(*performerID)
	if err != nil {
		return 0, err
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountMarkersByStudioRoleWithSecondary(ctx, r.repository.SceneMarker, r.repository.Scene, r.repository.Tag, obj.ID, depth, perfID, facialTagID, "top", secondCameraTagID)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

func (r *studioResolver) FacialMarkerWithBottomCount(ctx context.Context, obj *models.Studio, depth *int, performerID *string) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, _, _, facialTagID, _, _, secondCameraTagID := getRoleTagIDs(uiConfig)

	if facialTagID == 0 || performerID == nil {
		return 0, nil
	}

	perfID, err := strconv.Atoi(*performerID)
	if err != nil {
		return 0, err
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountMarkersByStudioRoleWithSecondary(ctx, r.repository.SceneMarker, r.repository.Scene, r.repository.Tag, obj.ID, depth, perfID, facialTagID, "bottom", secondCameraTagID)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

func (r *studioResolver) FacialBottomCount(ctx context.Context, obj *models.Studio, depth *int, performerID *string) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, _, _, facialTagID, _, _, _ := getRoleTagIDs(uiConfig)

	if facialTagID == 0 {
		return 0, nil
	}

	var perfID *int
	if performerID != nil {
		id, err := strconv.Atoi(*performerID)
		if err != nil {
			return 0, err
		}
		perfID = &id
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByStudioMarkerRole(ctx, r.repository.SceneMarker, r.repository.Scene, obj.ID, depth, facialTagID, "bottom", perfID)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

func (r *studioResolver) OrgasmTopCount(ctx context.Context, obj *models.Studio, depth *int, performerID *string) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, _, _, _, orgasmTagID, _, secondCameraTagID := getRoleTagIDs(uiConfig)

	if orgasmTagID == 0 || performerID == nil {
		return 0, nil
	}

	perfID, err := strconv.Atoi(*performerID)
	if err != nil {
		return 0, err
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountMarkersByStudioRoleWithSecondary(ctx, r.repository.SceneMarker, r.repository.Scene, r.repository.Tag, obj.ID, depth, perfID, orgasmTagID, "top", secondCameraTagID)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

// FacialMarkerCount returns the count of individual facial markers (not scenes) within this studio for a performer.
// This matches the global performer facial_marker_count semantics. // CUSTOM
func (r *studioResolver) FacialMarkerCount(ctx context.Context, obj *models.Studio, depth *int, performerID *string) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, _, _, facialTagID, _, _, secondCameraTagID := getRoleTagIDs(uiConfig)

	if facialTagID == 0 || performerID == nil {
		return 0, nil
	}

	perfID, err := strconv.Atoi(*performerID)
	if err != nil {
		return 0, err
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountMarkersByStudioRoleWithSecondary(ctx, r.repository.SceneMarker, r.repository.Scene, r.repository.Tag, obj.ID, depth, perfID, facialTagID, "", secondCameraTagID)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

// FeetTopCount returns the count of feet markers where performer is the top within this studio. // CUSTOM
func (r *studioResolver) FeetTopCount(ctx context.Context, obj *models.Studio, depth *int, performerID *string) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, _, _, _, _, feetTagID, secondCameraTagID := getRoleTagIDs(uiConfig)

	if feetTagID == 0 || performerID == nil {
		return 0, nil
	}

	perfID, err := strconv.Atoi(*performerID)
	if err != nil {
		return 0, err
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountMarkersByStudioRoleWithSecondary(ctx, r.repository.SceneMarker, r.repository.Scene, r.repository.Tag, obj.ID, depth, perfID, feetTagID, "top", secondCameraTagID)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

func (r *studioResolver) SexUniquePartnerCount(ctx context.Context, obj *models.Studio, depth *int, performerID *string) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, _, _, _, _, _, _ := getRoleTagIDs(uiConfig)

	if sexTagID == 0 || performerID == nil {
		return 0, nil
	}

	perfID, err := strconv.Atoi(*performerID)
	if err != nil {
		return 0, err
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.GetTotalUniqueCoPerformersByStudio(ctx, r.repository.SceneMarker, r.repository.Scene, obj.ID, depth, perfID, sexTagID, 0)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

func (r *studioResolver) OralUniquePartnerCount(ctx context.Context, obj *models.Studio, depth *int, performerID *string) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, oralTagID, _, _, _, _, _ := getRoleTagIDs(uiConfig)

	if oralTagID == 0 || performerID == nil {
		return 0, nil
	}

	perfID, err := strconv.Atoi(*performerID)
	if err != nil {
		return 0, err
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.GetTotalUniqueCoPerformersByStudio(ctx, r.repository.SceneMarker, r.repository.Scene, obj.ID, depth, perfID, oralTagID, -1)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

func (r *studioResolver) FacialUniquePartnerCount(ctx context.Context, obj *models.Studio, depth *int, performerID *string) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, _, _, facialTagID, _, _, _ := getRoleTagIDs(uiConfig) // CUSTOM

	if facialTagID == 0 || performerID == nil {
		return 0, nil
	}

	perfID, err := strconv.Atoi(*performerID)
	if err != nil {
		return 0, err
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.GetTotalUniqueCoPerformersByStudio(ctx, r.repository.SceneMarker, r.repository.Scene, obj.ID, depth, perfID, facialTagID, -1)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

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
