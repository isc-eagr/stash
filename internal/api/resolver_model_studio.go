package api

import (
	"context"
	"strconv"

	"github.com/stashapp/stash/internal/api/loaders"
	"github.com/stashapp/stash/internal/api/urlbuilders"
	"github.com/stashapp/stash/internal/manager/config"
	"github.com/stashapp/stash/pkg/gallery"
	"github.com/stashapp/stash/pkg/group"
	"github.com/stashapp/stash/pkg/image"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/performer"
	"github.com/stashapp/stash/pkg/scene"
)

func (r *studioResolver) ImagePath(ctx context.Context, obj *models.Studio) (*string, error) {
	var hasImage bool
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		var err error
		hasImage, err = r.repository.Studio.HasImage(ctx, obj.ID)
		return err
	}); err != nil {
		return nil, err
	}

	baseURL, _ := ctx.Value(BaseURLCtxKey).(string)
	imagePath := urlbuilders.NewStudioURLBuilder(baseURL, obj).GetStudioImageURL(hasImage)
	return &imagePath, nil
}

func (r *studioResolver) Aliases(ctx context.Context, obj *models.Studio) ([]string, error) {
	if !obj.Aliases.Loaded() {
		if err := r.withReadTxn(ctx, func(ctx context.Context) error {
			return obj.LoadAliases(ctx, r.repository.Studio)
		}); err != nil {
			return nil, err
		}
	}

	return obj.Aliases.List(), nil
}

func (r *studioResolver) URL(ctx context.Context, obj *models.Studio) (*string, error) {
	if !obj.URLs.Loaded() {
		if err := r.withReadTxn(ctx, func(ctx context.Context) error {
			return obj.LoadURLs(ctx, r.repository.Studio)
		}); err != nil {
			return nil, err
		}
	}

	urls := obj.URLs.List()
	if len(urls) == 0 {
		return nil, nil
	}

	return &urls[0], nil
}

func (r *studioResolver) Urls(ctx context.Context, obj *models.Studio) ([]string, error) {
	if !obj.URLs.Loaded() {
		if err := r.withReadTxn(ctx, func(ctx context.Context) error {
			return obj.LoadURLs(ctx, r.repository.Studio)
		}); err != nil {
			return nil, err
		}
	}

	return obj.URLs.List(), nil
}

func (r *studioResolver) Tags(ctx context.Context, obj *models.Studio) (ret []*models.Tag, err error) {
	if !obj.TagIDs.Loaded() {
		if err := r.withReadTxn(ctx, func(ctx context.Context) error {
			return obj.LoadTagIDs(ctx, r.repository.Studio)
		}); err != nil {
			return nil, err
		}
	}

	var errs []error
	ret, errs = loaders.From(ctx).TagByID.LoadAll(obj.TagIDs.List())
	return ret, firstError(errs)
}

func (r *studioResolver) SceneCount(ctx context.Context, obj *models.Studio, depth *int, performerID *string) (ret int, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByStudioID(ctx, r.repository.Scene, obj.ID, depth, performerID)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

// SexSceneCount returns the count of scenes with sex markers
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

func (r *studioResolver) ImageCount(ctx context.Context, obj *models.Studio, depth *int, performerID *string) (ret int, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		if performerID != nil {
			perfID, err := strconv.Atoi(*performerID)
			if err != nil {
				return err
			}
			ret, err = image.CountByStudioIDAndPerformerID(ctx, r.repository.Image, obj.ID, perfID, depth)
			return err
		}
		ret, err = image.CountByStudioID(ctx, r.repository.Image, obj.ID, depth)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

func (r *studioResolver) GalleryCount(ctx context.Context, obj *models.Studio, depth *int, performerID *string) (ret int, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		if performerID != nil {
			perfID, err := strconv.Atoi(*performerID)
			if err != nil {
				return err
			}
			ret, err = gallery.CountByStudioIDAndPerformerID(ctx, r.repository.Gallery, obj.ID, perfID, depth)
			return err
		}
		ret, err = gallery.CountByStudioID(ctx, r.repository.Gallery, obj.ID, depth)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

func (r *studioResolver) PerformerCount(ctx context.Context, obj *models.Studio, depth *int) (ret int, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = performer.CountByStudioID(ctx, r.repository.Performer, obj.ID, depth)
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

func (r *studioResolver) GroupCount(ctx context.Context, obj *models.Studio, depth *int, performerID *string) (ret int, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = group.CountByStudioID(ctx, r.repository.Group, obj.ID, depth, performerID)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

// deprecated
func (r *studioResolver) MovieCount(ctx context.Context, obj *models.Studio, depth *int) (ret int, err error) {
	return r.GroupCount(ctx, obj, depth, nil)
}

func (r *studioResolver) OCounter(ctx context.Context, obj *models.Studio, performerID *string) (ret *int, err error) {
	var res_scene int
	var res_image int
	var res int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		res_scene, err = r.repository.Scene.OCountByStudioID(ctx, obj.ID, performerID)
		if err != nil {
			return err
		}
		res_image, err = r.repository.Image.OCountByStudioID(ctx, obj.ID, performerID)
		return err
	}); err != nil {
		return nil, err
	}
	res = res_scene + res_image
	return &res, nil
}

func (r *studioResolver) ParentStudio(ctx context.Context, obj *models.Studio) (ret *models.Studio, err error) {
	if obj.ParentID == nil {
		return nil, nil
	}

	return loaders.From(ctx).StudioByID.Load(*obj.ParentID)
}

func (r *studioResolver) ChildStudios(ctx context.Context, obj *models.Studio) (ret []*models.Studio, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.Studio.FindChildren(ctx, obj.ID)
		return err
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

func (r *studioResolver) StashIds(ctx context.Context, obj *models.Studio) ([]*models.StashID, error) {
	if !obj.StashIDs.Loaded() {
		if err := r.withReadTxn(ctx, func(ctx context.Context) error {
			return obj.LoadStashIDs(ctx, r.repository.Studio)
		}); err != nil {
			return nil, err
		}
	}

	return stashIDsSliceToPtrSlice(obj.StashIDs.List()), nil
}

func (r *studioResolver) Rating100(ctx context.Context, obj *models.Studio) (*int, error) {
	return obj.Rating, nil
}

func (r *studioResolver) Groups(ctx context.Context, obj *models.Studio) (ret []*models.Group, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.Group.FindByStudioID(ctx, obj.ID)
		return err
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

func (r *studioResolver) CustomFields(ctx context.Context, obj *models.Studio) (map[string]interface{}, error) {
	m, err := loaders.From(ctx).StudioCustomFields.Load(obj.ID)
	if err != nil {
		return nil, err
	}

	if m == nil {
		return make(map[string]interface{}), nil
	}

	return m, nil
}

// deprecated
func (r *studioResolver) Movies(ctx context.Context, obj *models.Studio) (ret []*models.Group, err error) {
	return r.Groups(ctx, obj)
}
