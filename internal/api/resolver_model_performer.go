package api

import (
	"context"
	"strconv"

	"github.com/stashapp/stash/internal/api/loaders"
	"github.com/stashapp/stash/internal/api/urlbuilders"
	"github.com/stashapp/stash/internal/manager/config"
	"github.com/stashapp/stash/pkg/gallery"
	"github.com/stashapp/stash/pkg/image"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/performer"
	"github.com/stashapp/stash/pkg/scene"
)

func (r *performerResolver) AliasList(ctx context.Context, obj *models.Performer) ([]string, error) {
	if !obj.Aliases.Loaded() {
		if err := r.withReadTxn(ctx, func(ctx context.Context) error {
			return obj.LoadAliases(ctx, r.repository.Performer)
		}); err != nil {
			return nil, err
		}
	}

	return obj.Aliases.List(), nil
}

func (r *performerResolver) URL(ctx context.Context, obj *models.Performer) (*string, error) {
	if !obj.URLs.Loaded() {
		if err := r.withReadTxn(ctx, func(ctx context.Context) error {
			return obj.LoadURLs(ctx, r.repository.Performer)
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

func (r *performerResolver) Twitter(ctx context.Context, obj *models.Performer) (*string, error) {
	if !obj.URLs.Loaded() {
		if err := r.withReadTxn(ctx, func(ctx context.Context) error {
			return obj.LoadURLs(ctx, r.repository.Performer)
		}); err != nil {
			return nil, err
		}
	}

	urls := obj.URLs.List()

	// find the first twitter url
	for _, url := range urls {
		if performer.IsTwitterURL(url) {
			u := url
			return &u, nil
		}
	}

	return nil, nil
}

func (r *performerResolver) Instagram(ctx context.Context, obj *models.Performer) (*string, error) {
	if !obj.URLs.Loaded() {
		if err := r.withReadTxn(ctx, func(ctx context.Context) error {
			return obj.LoadURLs(ctx, r.repository.Performer)
		}); err != nil {
			return nil, err
		}
	}

	urls := obj.URLs.List()

	// find the first instagram url
	for _, url := range urls {
		if performer.IsInstagramURL(url) {
			u := url
			return &u, nil
		}
	}

	return nil, nil
}

func (r *performerResolver) Urls(ctx context.Context, obj *models.Performer) ([]string, error) {
	if !obj.URLs.Loaded() {
		if err := r.withReadTxn(ctx, func(ctx context.Context) error {
			return obj.LoadURLs(ctx, r.repository.Performer)
		}); err != nil {
			return nil, err
		}
	}

	return obj.URLs.List(), nil
}

func (r *performerResolver) Height(ctx context.Context, obj *models.Performer) (*string, error) {
	if obj.Height != nil {
		ret := strconv.Itoa(*obj.Height)
		return &ret, nil
	}
	return nil, nil
}

func (r *performerResolver) HeightCm(ctx context.Context, obj *models.Performer) (*int, error) {
	return obj.Height, nil
}

func (r *performerResolver) Birthdate(ctx context.Context, obj *models.Performer) (*string, error) {
	if obj.Birthdate != nil {
		ret := obj.Birthdate.String()
		return &ret, nil
	}
	return nil, nil
}

func (r *performerResolver) ImagePath(ctx context.Context, obj *models.Performer) (*string, error) {
	var hasImage bool
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		var err error
		hasImage, err = r.repository.Performer.HasImage(ctx, obj.ID)
		return err
	}); err != nil {
		return nil, err
	}

	baseURL, _ := ctx.Value(BaseURLCtxKey).(string)
	imagePath := urlbuilders.NewPerformerURLBuilder(baseURL, obj).GetPerformerImageURL(hasImage)
	return &imagePath, nil
}

func (r *performerResolver) Tags(ctx context.Context, obj *models.Performer) (ret []*models.Tag, err error) {
	if !obj.TagIDs.Loaded() {
		if err := r.withReadTxn(ctx, func(ctx context.Context) error {
			return obj.LoadTagIDs(ctx, r.repository.Performer)
		}); err != nil {
			return nil, err
		}
	}

	var errs []error
	ret, errs = loaders.From(ctx).TagByID.LoadAll(obj.TagIDs.List())
	return ret, firstError(errs)
}

func (r *performerResolver) SceneTags(ctx context.Context, obj *models.Performer, sceneID string) (ret []*models.Tag, err error) {
	// convert sceneID to int
	sid, err := strconv.Atoi(sceneID)
	if err != nil {
		return nil, err
	}

	var ids []int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		var err error
		ids, err = r.repository.Performer.GetSceneTagIDs(ctx, obj.ID, sid)
		return err
	}); err != nil {
		return nil, err
	}

	if len(ids) == 0 {
		return nil, nil
	}

	var errs []error
	ret, errs = loaders.From(ctx).TagByID.LoadAll(ids)
	return ret, firstError(errs)
}

func (r *performerResolver) SceneCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.Scene.CountByPerformerID(ctx, obj.ID)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

func (r *performerResolver) ImageCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = image.CountByPerformerID(ctx, r.repository.Image, obj.ID)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

func (r *performerResolver) GalleryCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = gallery.CountByPerformerID(ctx, r.repository.Gallery, obj.ID)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

func (r *performerResolver) GroupCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.Group.CountByPerformerID(ctx, obj.ID)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

// deprecated
func (r *performerResolver) MovieCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	return r.GroupCount(ctx, obj)
}

func (r *performerResolver) PerformerCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = performer.CountByAppearsWith(ctx, r.repository.Performer, obj.ID)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

func (r *performerResolver) OCounter(ctx context.Context, obj *models.Performer) (ret *int, err error) {
	var res_scene int
	var res_image int
	var res int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		res_scene, err = r.repository.Scene.OCountByPerformerID(ctx, obj.ID)
		if err != nil {
			return err
		}
		res_image, err = r.repository.Image.OCountByPerformerID(ctx, obj.ID)
		return err
	}); err != nil {
		return nil, err
	}
	res = res_scene + res_image
	return &res, nil
}

func (r *performerResolver) Scenes(ctx context.Context, obj *models.Performer) (ret []*models.Scene, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.Scene.FindByPerformerID(ctx, obj.ID)
		return err
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

func (r *performerResolver) StashIds(ctx context.Context, obj *models.Performer) ([]*models.StashID, error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		return obj.LoadStashIDs(ctx, r.repository.Performer)
	}); err != nil {
		return nil, err
	}

	return stashIDsSliceToPtrSlice(obj.StashIDs.List()), nil
}

func (r *performerResolver) Rating100(ctx context.Context, obj *models.Performer) (*int, error) {
	return obj.Rating, nil
}

func (r *performerResolver) DeathDate(ctx context.Context, obj *models.Performer) (*string, error) {
	if obj.DeathDate != nil {
		ret := obj.DeathDate.String()
		return &ret, nil
	}
	return nil, nil
}

func (r *performerResolver) Groups(ctx context.Context, obj *models.Performer) (ret []*models.Group, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.Group.FindByPerformerID(ctx, obj.ID)
		return err
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

func (r *performerResolver) CustomFields(ctx context.Context, obj *models.Performer) (map[string]interface{}, error) {
	m, err := loaders.From(ctx).PerformerCustomFields.Load(obj.ID)
	if err != nil {
		return nil, err
	}

	if m == nil {
		return make(map[string]interface{}), nil
	}

	return m, nil
}

// deprecated
func (r *performerResolver) Movies(ctx context.Context, obj *models.Performer) (ret []*models.Group, err error) {
	return r.Groups(ctx, obj)
}

// SexSceneCount returns the count of scenes with top/bottom performer_scene_tags
func (r *performerResolver) SexSceneCount(ctx context.Context, obj *models.Performer, topTag *string, bottomTag *string) (ret int, err error) {
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
		ret, err = scene.CountByPerformerIDAndPerformerSceneTags(ctx, r.repository.Scene, r.repository.Tag, obj.ID, []string{top, bottom}, false)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

// OralSceneCount returns the count of scenes with oral tags but not top/bottom
func (r *performerResolver) OralSceneCount(ctx context.Context, obj *models.Performer, oralTopTag *string, oralBottomTag *string, topTag *string, bottomTag *string) (ret int, err error) {
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
		ret, err = scene.CountByPerformerIDAndPerformerSceneTagsWithExclusions(ctx, r.repository.Scene, r.repository.Tag, obj.ID, []string{oralTop, oralBottom}, []string{top, bottom})
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

// SoloSceneCount returns the count of scenes with solo tags but not top/bottom/oral
func (r *performerResolver) SoloSceneCount(ctx context.Context, obj *models.Performer, soloTag *string, topTag *string, bottomTag *string, oralTopTag *string, oralBottomTag *string) (ret int, err error) {
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
		ret, err = scene.CountByPerformerIDAndPerformerSceneTagsWithExclusions(ctx, r.repository.Scene, r.repository.Tag, obj.ID, []string{solo}, []string{top, bottom, oralTop, oralBottom})
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}

// FacialSceneCount returns the count of scenes with facialgiven or facialreceived performer_scene_tags
func (r *performerResolver) FacialSceneCount(ctx context.Context, obj *models.Performer, facialGivenTag *string, facialReceivedTag *string) (ret int, err error) {
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
		ret, err = scene.CountByPerformerIDAndPerformerSceneTags(ctx, r.repository.Scene, r.repository.Tag, obj.ID, []string{facialGiven, facialReceived, selfFacial}, false)
		return err
	}); err != nil {
		return 0, err
	}

	return ret, nil
}
