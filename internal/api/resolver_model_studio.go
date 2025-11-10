package api

import (
	"context"

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

func (r *studioResolver) SceneCount(ctx context.Context, obj *models.Studio, depth *int) (ret int, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByStudioID(ctx, r.repository.Scene, obj.ID, depth)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

// SexSceneCount returns the count of scenes with top/bottom performer_scene_tags
func (r *studioResolver) SexSceneCount(ctx context.Context, obj *models.Studio, depth *int, topTag *string, bottomTag *string) (ret int, err error) {
	// Get tag names from UI configuration if not provided
	uiConfig := config.GetInstance().GetUIConfiguration()
	sceneTagAliases, _ := uiConfig["sceneTagAliases"].(map[string]interface{})

	top := "top"
	if topTag != nil {
		top = *topTag
	} else if sceneTagAliases != nil {
		if t, ok := sceneTagAliases["top"].(string); ok && t != "" {
			top = t
		}
	}

	bottom := "bottom"
	if bottomTag != nil {
		bottom = *bottomTag
	} else if sceneTagAliases != nil {
		if b, ok := sceneTagAliases["bottom"].(string); ok && b != "" {
			bottom = b
		}
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByStudioIDAndPerformerSceneTags(ctx, r.repository.Scene, r.repository.Tag, obj.ID, depth, []string{top, bottom}, false)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

// OralSceneCount returns the count of scenes with oral tags but not top/bottom
func (r *studioResolver) OralSceneCount(ctx context.Context, obj *models.Studio, depth *int, oralTopTag *string, oralBottomTag *string, topTag *string, bottomTag *string) (ret int, err error) {
	// Get tag names from UI configuration if not provided
	uiConfig := config.GetInstance().GetUIConfiguration()
	sceneTagAliases, _ := uiConfig["sceneTagAliases"].(map[string]interface{})

	oralTop := "oraltop"
	if oralTopTag != nil {
		oralTop = *oralTopTag
	} else if sceneTagAliases != nil {
		if ot, ok := sceneTagAliases["oraltop"].(string); ok && ot != "" {
			oralTop = ot
		}
	}

	oralBottom := "oralbottom"
	if oralBottomTag != nil {
		oralBottom = *oralBottomTag
	} else if sceneTagAliases != nil {
		if ob, ok := sceneTagAliases["oralbottom"].(string); ok && ob != "" {
			oralBottom = ob
		}
	}

	top := "top"
	if topTag != nil {
		top = *topTag
	} else if sceneTagAliases != nil {
		if t, ok := sceneTagAliases["top"].(string); ok && t != "" {
			top = t
		}
	}

	bottom := "bottom"
	if bottomTag != nil {
		bottom = *bottomTag
	} else if sceneTagAliases != nil {
		if b, ok := sceneTagAliases["bottom"].(string); ok && b != "" {
			bottom = b
		}
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByStudioIDAndPerformerSceneTagsWithExclusions(ctx, r.repository.Scene, r.repository.Tag, obj.ID, depth, []string{oralTop, oralBottom}, []string{top, bottom})
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

// SoloSceneCount returns the count of scenes with solo tags but not top/bottom/oral
func (r *studioResolver) SoloSceneCount(ctx context.Context, obj *models.Studio, depth *int, soloTag *string, topTag *string, bottomTag *string, oralTopTag *string, oralBottomTag *string) (ret int, err error) {
	// Get tag names from UI configuration if not provided
	uiConfig := config.GetInstance().GetUIConfiguration()
	sceneTagAliases, _ := uiConfig["sceneTagAliases"].(map[string]interface{})

	solo := "solo"
	if soloTag != nil {
		solo = *soloTag
	} else if sceneTagAliases != nil {
		if s, ok := sceneTagAliases["solo"].(string); ok && s != "" {
			solo = s
		}
	}

	top := "top"
	if topTag != nil {
		top = *topTag
	} else if sceneTagAliases != nil {
		if t, ok := sceneTagAliases["top"].(string); ok && t != "" {
			top = t
		}
	}

	bottom := "bottom"
	if bottomTag != nil {
		bottom = *bottomTag
	} else if sceneTagAliases != nil {
		if b, ok := sceneTagAliases["bottom"].(string); ok && b != "" {
			bottom = b
		}
	}

	oralTop := "oraltop"
	if oralTopTag != nil {
		oralTop = *oralTopTag
	} else if sceneTagAliases != nil {
		if ot, ok := sceneTagAliases["oraltop"].(string); ok && ot != "" {
			oralTop = ot
		}
	}

	oralBottom := "oralbottom"
	if oralBottomTag != nil {
		oralBottom = *oralBottomTag
	} else if sceneTagAliases != nil {
		if ob, ok := sceneTagAliases["oralbottom"].(string); ok && ob != "" {
			oralBottom = ob
		}
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByStudioIDAndPerformerSceneTagsWithExclusions(ctx, r.repository.Scene, r.repository.Tag, obj.ID, depth, []string{solo}, []string{top, bottom, oralTop, oralBottom})
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

// FacialSceneCount returns the count of scenes with facialgiven or facialreceived performer_scene_tags
func (r *studioResolver) FacialSceneCount(ctx context.Context, obj *models.Studio, depth *int, facialGivenTag *string, facialReceivedTag *string) (ret int, err error) {
	// Get tag names from UI configuration if not provided
	uiConfig := config.GetInstance().GetUIConfiguration()
	sceneTagAliases, _ := uiConfig["sceneTagAliases"].(map[string]interface{})

	facialGiven := "facialgiven"
	if facialGivenTag != nil {
		facialGiven = *facialGivenTag
	} else if sceneTagAliases != nil {
		if fg, ok := sceneTagAliases["facialgiven"].(string); ok && fg != "" {
			facialGiven = fg
		}
	}

	facialReceived := "facialreceived"
	if facialReceivedTag != nil {
		facialReceived = *facialReceivedTag
	} else if sceneTagAliases != nil {
		if fr, ok := sceneTagAliases["facialreceived"].(string); ok && fr != "" {
			facialReceived = fr
		}
	}

	// Optional third facial tag: selffacial
	selfFacial := "selffacial"
	if sceneTagAliases != nil {
		if sf, ok := sceneTagAliases["selffacial"].(string); ok && sf != "" {
			selfFacial = sf
		}
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByStudioIDAndPerformerSceneTags(ctx, r.repository.Scene, r.repository.Tag, obj.ID, depth, []string{facialGiven, facialReceived, selfFacial}, false)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

func (r *studioResolver) ImageCount(ctx context.Context, obj *models.Studio, depth *int) (ret int, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = image.CountByStudioID(ctx, r.repository.Image, obj.ID, depth)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

func (r *studioResolver) GalleryCount(ctx context.Context, obj *models.Studio, depth *int) (ret int, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
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

func (r *studioResolver) GroupCount(ctx context.Context, obj *models.Studio, depth *int) (ret int, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = group.CountByStudioID(ctx, r.repository.Group, obj.ID, depth)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

// deprecated
func (r *studioResolver) MovieCount(ctx context.Context, obj *models.Studio, depth *int) (ret int, err error) {
	return r.GroupCount(ctx, obj, depth)
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

// deprecated
func (r *studioResolver) Movies(ctx context.Context, obj *models.Studio) (ret []*models.Group, err error) {
	return r.Groups(ctx, obj)
}
