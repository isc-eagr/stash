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
	// DEPRECATED: performer_scene_tags has been removed. Return empty array for backward compatibility.
	return nil, nil
}

// SceneMarkerRoles returns the roles a performer has in a specific scene's markers
func (r *performerResolver) SceneMarkerRoles(ctx context.Context, obj *models.Performer, sceneID string) (ret []string, err error) {
	// convert sceneID to int
	sid, err := strconv.Atoi(sceneID)
	if err != nil {
		return nil, err
	}

	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, oralTagID, soloTagID, facialTagID := getRoleTagIDs(uiConfig)

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.GetPerformerMarkerRolesForScene(ctx, r.repository.SceneMarker, obj.ID, sid, sexTagID, oralTagID, soloTagID, facialTagID)
		return err
	}); err != nil {
		return nil, err
	}

	return ret, nil
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

// Helper to get role tag IDs from UI configuration
func getRoleTagIDs(uiConfig map[string]interface{}) (sexTagID, oralTagID, soloTagID, facialTagID int) {
	roleTagIds, _ := uiConfig["roleTagIds"].(map[string]interface{})
	if roleTagIds == nil {
		return 0, 0, 0, 0
	}

	if id, ok := roleTagIds["sexTagId"].(string); ok && id != "" {
		sexTagID, _ = strconv.Atoi(id)
	}
	if id, ok := roleTagIds["oralTagId"].(string); ok && id != "" {
		oralTagID, _ = strconv.Atoi(id)
	}
	if id, ok := roleTagIds["soloTagId"].(string); ok && id != "" {
		soloTagID, _ = strconv.Atoi(id)
	}
	if id, ok := roleTagIds["facialTagId"].(string); ok && id != "" {
		facialTagID, _ = strconv.Atoi(id)
	}
	return
}

// SexSceneCount returns the count of scenes with sex markers where performer participates
func (r *performerResolver) SexSceneCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, _, _, _ := getRoleTagIDs(uiConfig)

	if sexTagID == 0 {
		return 0, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByPerformerMarkerRole(ctx, r.repository.SceneMarker, obj.ID, sexTagID, "")
		return err
	}); err != nil {
		return 0, err
	}
	return ret, nil
}

// SexGiverCount returns the count of scenes where performer is the giver in sex markers
func (r *performerResolver) SexGiverCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, _, _, _ := getRoleTagIDs(uiConfig)

	if sexTagID == 0 {
		return 0, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByPerformerMarkerRole(ctx, r.repository.SceneMarker, obj.ID, sexTagID, "giver")
		return err
	}); err != nil {
		return 0, err
	}
	return ret, nil
}

// SexReceiverCount returns the count of scenes where performer is the receiver in sex markers
func (r *performerResolver) SexReceiverCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, _, _, _ := getRoleTagIDs(uiConfig)

	if sexTagID == 0 {
		return 0, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByPerformerMarkerRole(ctx, r.repository.SceneMarker, obj.ID, sexTagID, "receiver")
		return err
	}); err != nil {
		return 0, err
	}
	return ret, nil
}

// OralSceneCount returns the count of scenes with oral markers (excluding sex scenes)
func (r *performerResolver) OralSceneCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, oralTagID, _, _ := getRoleTagIDs(uiConfig)

	if oralTagID == 0 {
		return 0, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByPerformerMarkerRoleExcluding(ctx, r.repository.SceneMarker, obj.ID, oralTagID, "", sexTagID)
		return err
	}); err != nil {
		return 0, err
	}
	return ret, nil
}

// OralGiverCount returns the count of scenes where performer is the giver in oral markers
func (r *performerResolver) OralGiverCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, oralTagID, _, _ := getRoleTagIDs(uiConfig)

	if oralTagID == 0 {
		return 0, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByPerformerMarkerRoleExcluding(ctx, r.repository.SceneMarker, obj.ID, oralTagID, "giver", sexTagID)
		return err
	}); err != nil {
		return 0, err
	}
	return ret, nil
}

// OralReceiverCount returns the count of scenes where performer is the receiver in oral markers
func (r *performerResolver) OralReceiverCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, oralTagID, _, _ := getRoleTagIDs(uiConfig)

	if oralTagID == 0 {
		return 0, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByPerformerMarkerRoleExcluding(ctx, r.repository.SceneMarker, obj.ID, oralTagID, "receiver", sexTagID)
		return err
	}); err != nil {
		return 0, err
	}
	return ret, nil
}

// SoloSceneCount returns the count of scenes with solo markers (excluding sex and oral scenes)
func (r *performerResolver) SoloSceneCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, oralTagID, soloTagID, _ := getRoleTagIDs(uiConfig)

	if soloTagID == 0 {
		return 0, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByPerformerMarkerRoleExcludingMultiple(ctx, r.repository.SceneMarker, obj.ID, soloTagID, "", []int{sexTagID, oralTagID})
		return err
	}); err != nil {
		return 0, err
	}
	return ret, nil
}

// FacialSceneCount returns the count of scenes with facial markers (independent of other markers)
func (r *performerResolver) FacialSceneCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, _, _, facialTagID := getRoleTagIDs(uiConfig)

	if facialTagID == 0 {
		return 0, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByPerformerMarkerRole(ctx, r.repository.SceneMarker, obj.ID, facialTagID, "")
		return err
	}); err != nil {
		return 0, err
	}
	return ret, nil
}

// FacialGiverCount returns the count of scenes where performer is the giver in facial markers
func (r *performerResolver) FacialGiverCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, _, _, facialTagID := getRoleTagIDs(uiConfig)

	if facialTagID == 0 {
		return 0, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByPerformerMarkerRole(ctx, r.repository.SceneMarker, obj.ID, facialTagID, "giver")
		return err
	}); err != nil {
		return 0, err
	}
	return ret, nil
}

// FacialReceiverCount returns the count of scenes where performer is the receiver in facial markers
func (r *performerResolver) FacialReceiverCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, _, _, facialTagID := getRoleTagIDs(uiConfig)

	if facialTagID == 0 {
		return 0, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountByPerformerMarkerRole(ctx, r.repository.SceneMarker, obj.ID, facialTagID, "receiver")
		return err
	}); err != nil {
		return 0, err
	}
	return ret, nil
}
