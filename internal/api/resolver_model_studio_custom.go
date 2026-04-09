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
		ret, err = scene.CountByStudioMarkerRoleExcludingMultiple(ctx, r.repository.SceneMarker, r.repository.Scene, obj.ID, depth, soloTagID, "", []int{sexTagID, oralTagID}, perfID)
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

func (r *studioResolver) UniquePerformerCount(ctx context.Context, obj *models.Studio, depth *int) (ret int, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = performer.CountUniqueByStudioID(ctx, r.repository.Performer, obj.ID, depth)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}
