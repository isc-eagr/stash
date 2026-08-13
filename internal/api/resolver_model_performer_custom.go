package api

// CUSTOM: This file contains all custom Performer resolver methods
// added to this fork. These are NOT present in upstream Stash.

import (
	"context"
	"strconv"

	"github.com/stashapp/stash/internal/manager/config"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/scene"
)

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
	sexTagID, oralTagID, soloTagID, facialTagID, orgasmTagID, feetTagID, secondCameraTagID := getRoleTagIDs(uiConfig)

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.GetPerformerMarkerRolesForScene(ctx, r.repository.SceneMarker, r.repository.Tag, obj.ID, sid, sexTagID, oralTagID, soloTagID, facialTagID, orgasmTagID, feetTagID, secondCameraTagID)
		return err
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

// Helper to get role tag IDs from UI configuration
func getRoleTagIDs(uiConfig map[string]interface{}) (sexTagID, oralTagID, soloTagID, facialTagID, orgasmTagID, feetTagID, secondCameraTagID int) {
	roleTagIDs := getRoleTagIDsFromUIConfig(uiConfig)
	return roleTagIDs.sexTagID,
		roleTagIDs.oralTagID,
		roleTagIDs.soloTagID,
		roleTagIDs.facialTagID,
		roleTagIDs.orgasmTagID,
		roleTagIDs.feetTagID,
		roleTagIDs.secondCameraTagID
}

// SexSceneCount returns the count of scenes with sex markers where performer participates
func (r *performerResolver) SexSceneCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, _, _, _, _, _, _ := getRoleTagIDs(uiConfig)

	if sexTagID == 0 {
		return 0, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountScenesByPerformerMarkerRole(ctx, r.repository.SceneMarker, obj.ID, sexTagID, "")
		return err
	}); err != nil {
		return 0, err
	}
	return ret, nil
}

// SexTopCount returns the count of scenes where performer is the top in sex markers
func (r *performerResolver) SexTopCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, _, _, _, _, _, _ := getRoleTagIDs(uiConfig)

	if sexTagID == 0 {
		return 0, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountScenesByPerformerMarkerRole(ctx, r.repository.SceneMarker, obj.ID, sexTagID, "top")
		return err
	}); err != nil {
		return 0, err
	}
	return ret, nil
}

// SexBottomCount returns the count of scenes where performer is the bottom in sex markers
func (r *performerResolver) SexBottomCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, _, _, _, _, _, _ := getRoleTagIDs(uiConfig)

	if sexTagID == 0 {
		return 0, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountScenesByPerformerMarkerRole(ctx, r.repository.SceneMarker, obj.ID, sexTagID, "bottom")
		return err
	}); err != nil {
		return 0, err
	}
	return ret, nil
}

// OralSceneCount returns the count of scenes with oral markers (excluding sex scenes)
func (r *performerResolver) OralSceneCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, oralTagID, _, _, _, _, _ := getRoleTagIDs(uiConfig)

	if oralTagID == 0 {
		return 0, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountScenesByPerformerMarkerRoleExcluding(ctx, r.repository.SceneMarker, obj.ID, oralTagID, "", sexTagID)
		return err
	}); err != nil {
		return 0, err
	}
	return ret, nil
}

// OralTopCount returns the count of scenes where performer is the top in oral markers
func (r *performerResolver) OralTopCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, oralTagID, _, _, _, _, _ := getRoleTagIDs(uiConfig)

	if oralTagID == 0 {
		return 0, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountScenesByPerformerMarkerRoleExcluding(ctx, r.repository.SceneMarker, obj.ID, oralTagID, "top", sexTagID)
		return err
	}); err != nil {
		return 0, err
	}
	return ret, nil
}

// OralBottomCount returns the count of scenes where performer is the bottom in oral markers
func (r *performerResolver) OralBottomCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, oralTagID, _, _, _, _, _ := getRoleTagIDs(uiConfig)

	if oralTagID == 0 {
		return 0, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountScenesByPerformerMarkerRoleExcluding(ctx, r.repository.SceneMarker, obj.ID, oralTagID, "bottom", sexTagID)
		return err
	}); err != nil {
		return 0, err
	}
	return ret, nil
}

// SoloSceneCount returns the count of scenes with solo markers (excluding sex and oral scenes)
func (r *performerResolver) SoloSceneCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, oralTagID, soloTagID, _, _, _, _ := getRoleTagIDs(uiConfig)

	if soloTagID == 0 {
		return 0, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountScenesByPerformerMarkerRoleExcludingMultiple(ctx, r.repository.SceneMarker, obj.ID, soloTagID, "top", []int{sexTagID, oralTagID}) // CUSTOM: only top role counts as jerk/solo
		return err
	}); err != nil {
		return 0, err
	}
	return ret, nil
}

// FacialSceneCount returns the count of scenes with facial markers (independent of other markers)
func (r *performerResolver) FacialSceneCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, _, _, facialTagID, _, _, _ := getRoleTagIDs(uiConfig)

	if facialTagID == 0 {
		return 0, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = scene.CountScenesByPerformerMarkerRole(ctx, r.repository.SceneMarker, obj.ID, facialTagID, "")
		return err
	}); err != nil {
		return 0, err
	}
	return ret, nil
}

// FacialTopCount returns the count of scenes where performer is the top in facial markers
func (r *performerResolver) FacialTopCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, _, _, facialTagID, _, _, _ := getRoleTagIDs(uiConfig)

	if facialTagID == 0 {
		return 0, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		// Count SCENES (not markers) where performer is top
		ret, err = scene.CountScenesByPerformerMarkerRole(ctx, r.repository.SceneMarker, obj.ID, facialTagID, "top")
		return err
	}); err != nil {
		return 0, err
	}
	return ret, nil
}

// FacialBottomCount returns the count of scenes where performer is the bottom in facial markers
func (r *performerResolver) FacialBottomCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, _, _, facialTagID, _, _, _ := getRoleTagIDs(uiConfig)

	if facialTagID == 0 {
		return 0, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		// Count SCENES (not markers) where performer is bottom
		ret, err = scene.CountScenesByPerformerMarkerRole(ctx, r.repository.SceneMarker, obj.ID, facialTagID, "bottom")
		return err
	}); err != nil {
		return 0, err
	}
	return ret, nil
}

// FacialMarkerCount returns the count of facial markers (individual markers, not scenes)
func (r *performerResolver) FacialMarkerCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, _, _, facialTagID, _, _, secondCameraTagID := getRoleTagIDs(uiConfig)

	if facialTagID == 0 {
		return 0, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		// Count markers with facial tag in primary OR secondary tags, excluding 2nd camera
		ret, err = scene.CountMarkersByPerformerRoleWithSecondary(ctx, r.repository.SceneMarker, r.repository.Tag, obj.ID, facialTagID, "", secondCameraTagID)
		return err
	}); err != nil {
		return 0, err
	}
	return ret, nil
}

// FacialMarkerTopCount returns the count of facial markers where performer is the top
func (r *performerResolver) FacialMarkerTopCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, _, _, facialTagID, _, _, secondCameraTagID := getRoleTagIDs(uiConfig)

	if facialTagID == 0 {
		return 0, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		// Count markers with facial tag in primary OR secondary tags where performer is top, excluding 2nd camera
		ret, err = scene.CountMarkersByPerformerRoleWithSecondary(ctx, r.repository.SceneMarker, r.repository.Tag, obj.ID, facialTagID, "top", secondCameraTagID)
		return err
	}); err != nil {
		return 0, err
	}
	return ret, nil
}

// FacialMarkerBottomCount returns the count of facial markers where performer is the bottom
func (r *performerResolver) FacialMarkerBottomCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, _, _, facialTagID, _, _, secondCameraTagID := getRoleTagIDs(uiConfig)

	if facialTagID == 0 {
		return 0, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		// Count markers with facial tag in primary OR secondary tags where performer is bottom, excluding 2nd camera
		ret, err = scene.CountMarkersByPerformerRoleWithSecondary(ctx, r.repository.SceneMarker, r.repository.Tag, obj.ID, facialTagID, "bottom", secondCameraTagID)
		return err
	}); err != nil {
		return 0, err
	}
	return ret, nil
}

// FacialMarkerWithTopCount returns the count of facial markers with performers this performer has topped
func (r *performerResolver) FacialMarkerWithTopCount(ctx context.Context, obj *models.Performer) (int, error) {
	return r.FacialMarkerTopCount(ctx, obj)
}

// FacialMarkerWithBottomCount returns the count of facial markers with performers this performer has bottomed for
func (r *performerResolver) FacialMarkerWithBottomCount(ctx context.Context, obj *models.Performer) (int, error) {
	return r.FacialMarkerBottomCount(ctx, obj)
}

// OrgasmTopCount returns the count of orgasm markers where performer is the top
func (r *performerResolver) OrgasmTopCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, _, _, _, orgasmTagID, _, secondCameraTagID := getRoleTagIDs(uiConfig)

	if orgasmTagID == 0 {
		return 0, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		// Use CountMarkersByPerformerRoleWithSecondary to count actual markers, not scenes, excluding 2nd camera
		ret, err = scene.CountMarkersByPerformerRoleWithSecondary(ctx, r.repository.SceneMarker, r.repository.Tag, obj.ID, orgasmTagID, "top", secondCameraTagID)
		return err
	}); err != nil {
		return 0, err
	}
	return ret, nil
}

// FeetTopCount returns the count of distinct scenes with feet markers where performer is the top
func (r *performerResolver) FeetTopCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, _, _, _, _, feetTagID, _ := getRoleTagIDs(uiConfig)

	if feetTagID == 0 {
		return 0, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		// Count distinct scenes where performer is top for feet markers
		ret, err = scene.CountScenesByPerformerMarkerRole(ctx, r.repository.SceneMarker, obj.ID, feetTagID, "top")
		return err
	}); err != nil {
		return 0, err
	}
	return ret, nil
}

// FeetMarkerCount returns the count of feet markers where performer is the top
func (r *performerResolver) FeetMarkerCount(ctx context.Context, obj *models.Performer) (ret int, err error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, _, _, _, _, feetTagID, secondCameraTagID := getRoleTagIDs(uiConfig)

	if feetTagID == 0 {
		return 0, nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		// Use WithSecondary to exclude 2nd camera markers, consistent with FacialMarkerCount / OrgasmTopCount
		ret, err = scene.CountMarkersByPerformerRoleWithSecondary(ctx, r.repository.SceneMarker, r.repository.Tag, obj.ID, feetTagID, "top", secondCameraTagID) // CUSTOM
		return err
	}); err != nil {
		return 0, err
	}
	return ret, nil
}

func (r *performerResolver) coPerformerCount(ctx context.Context, performerID int, tagID int, performerRole string, depth int) (int, error) {
	counts, err := r.getCoPerformersWithCounts(ctx, performerID, tagID, performerRole, depth)
	if err != nil {
		return 0, err
	}
	return len(counts), nil
}

func (r *performerResolver) uniqueCoPerformerCount(ctx context.Context, performerID int, tagID int, depth int) (int, error) {
	topPartners, err := r.getCoPerformersWithCounts(ctx, performerID, tagID, "top", depth)
	if err != nil {
		return 0, err
	}
	bottomPartners, err := r.getCoPerformersWithCounts(ctx, performerID, tagID, "bottom", depth)
	if err != nil {
		return 0, err
	}

	uniquePartners := make(map[int]bool, len(topPartners)+len(bottomPartners))
	for performerID := range topPartners {
		uniquePartners[performerID] = true
	}
	for performerID := range bottomPartners {
		uniquePartners[performerID] = true
	}

	return len(uniquePartners), nil
}

// SexWithTopCount returns the count of unique performers this performer has topped sexually
func (r *performerResolver) SexWithTopCount(ctx context.Context, obj *models.Performer) (int, error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, _, _, _, _, _, _ := getRoleTagIDs(uiConfig)
	if sexTagID == 0 {
		return 0, nil
	}

	return r.coPerformerCount(ctx, obj.ID, sexTagID, "top", 0)
}

// SexWithBottomCount returns the count of unique performers this performer has bottomed for sexually
func (r *performerResolver) SexWithBottomCount(ctx context.Context, obj *models.Performer) (int, error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, _, _, _, _, _, _ := getRoleTagIDs(uiConfig)
	if sexTagID == 0 {
		return 0, nil
	}

	return r.coPerformerCount(ctx, obj.ID, sexTagID, "bottom", 0)
}

// OralWithTopCount returns the count of unique performers this performer has topped orally
func (r *performerResolver) OralWithTopCount(ctx context.Context, obj *models.Performer) (int, error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, oralTagID, _, _, _, _, _ := getRoleTagIDs(uiConfig)
	if oralTagID == 0 {
		return 0, nil
	}

	return r.coPerformerCount(ctx, obj.ID, oralTagID, "top", -1)
}

// OralWithBottomCount returns the count of unique performers this performer has bottomed for orally
func (r *performerResolver) OralWithBottomCount(ctx context.Context, obj *models.Performer) (int, error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, oralTagID, _, _, _, _, _ := getRoleTagIDs(uiConfig)
	if oralTagID == 0 {
		return 0, nil
	}

	return r.coPerformerCount(ctx, obj.ID, oralTagID, "bottom", -1)
}

// FacialWithTopCount returns the count of unique performers this performer has given facials to
func (r *performerResolver) FacialWithTopCount(ctx context.Context, obj *models.Performer) (int, error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, _, _, facialTagID, _, _, _ := getRoleTagIDs(uiConfig)
	if facialTagID == 0 {
		return 0, nil
	}

	return r.coPerformerCount(ctx, obj.ID, facialTagID, "top", -1)
}

// FacialWithBottomCount returns the count of unique performers this performer has received facials from
func (r *performerResolver) FacialWithBottomCount(ctx context.Context, obj *models.Performer) (int, error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, _, _, facialTagID, _, _, _ := getRoleTagIDs(uiConfig)
	if facialTagID == 0 {
		return 0, nil
	}

	return r.coPerformerCount(ctx, obj.ID, facialTagID, "bottom", -1)
}

// SexUniquePartnerCount returns the count of unique performers this performer has been with sexually (any role)
func (r *performerResolver) SexUniquePartnerCount(ctx context.Context, obj *models.Performer) (int, error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, _, _, _, _, _, _ := getRoleTagIDs(uiConfig)
	if sexTagID == 0 {
		return 0, nil
	}

	return r.uniqueCoPerformerCount(ctx, obj.ID, sexTagID, 0)
}

// OralUniquePartnerCount returns the count of unique performers this performer has been with orally (any role)
func (r *performerResolver) OralUniquePartnerCount(ctx context.Context, obj *models.Performer) (int, error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, oralTagID, _, _, _, _, _ := getRoleTagIDs(uiConfig)
	if oralTagID == 0 {
		return 0, nil
	}

	return r.uniqueCoPerformerCount(ctx, obj.ID, oralTagID, -1)
}

// FacialUniquePartnerCount returns the count of unique performers this performer has been with in facial scenes (any role)
func (r *performerResolver) FacialUniquePartnerCount(ctx context.Context, obj *models.Performer) (int, error) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, _, _, facialTagID, _, _, _ := getRoleTagIDs(uiConfig)
	if facialTagID == 0 {
		return 0, nil
	}

	return r.uniqueCoPerformerCount(ctx, obj.ID, facialTagID, -1)
}

// getCoPerformersWithCounts gets co-performers for a given performer based on tag and role
// Returns a map of performer ID to scene count
// depth: 0 for exact tag match, -1 for including all subtags
func (r *performerResolver) getCoPerformersWithCounts(ctx context.Context, performerID int, tagID int, performerRole string, depth int) (map[int]int, error) {
	// Find markers with this tag where the performer has the given role
	// Then find other performers in those markers with the opposite role
	oppositeRole := "bottom"
	if performerRole == "bottom" {
		oppositeRole = "top"
	}

	// Build filter using SceneMarkerTags with groups_extended
	performerIDStr := strconv.Itoa(performerID)
	tagIDStr := strconv.Itoa(tagID)

	group := models.SceneMarkerTagGroupInput{
		TagIDs: []string{tagIDStr},
		Depth:  &depth,
	}

	// Set the performer in the appropriate role
	if performerRole == "top" {
		group.TopPerformerIDs = []string{performerIDStr}
	} else {
		group.BottomPerformerIDs = []string{performerIDStr}
	}

	performerMode := "OR"
	group.PerformerMode = &performerMode

	filter := &models.SceneMarkerFilterType{
		SceneMarkerTags: &models.SceneMarkerTagsCriterionInput{
			Modifier:       models.CriterionModifierEquals,
			GroupsExtended: []models.SceneMarkerTagGroupInput{group},
		},
	}

	var sceneCountsByPerformer map[int]int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		markers, _, err := r.repository.SceneMarker.Query(ctx, filter, nil)
		if err != nil {
			return err
		}

		// CUSTOM: begin - batch-fetch performer associations to eliminate N+1 queries
		markerIDs := make([]int, len(markers))
		for i, m := range markers {
			markerIDs[i] = m.ID
		}
		allMarkerPerformers, err := r.repository.SceneMarker.GetPerformersForMarkers(ctx, markerIDs)
		if err != nil {
			return err
		}
		// CUSTOM: end

		// Collect performer IDs with the opposite role from these markers
		// Map of performer ID to scene IDs they appeared in
		coPerformerScenes := make(map[int]map[int]bool)

		for _, marker := range markers {
			markerPerformers := allMarkerPerformers[marker.ID] // CUSTOM: use batched result
			for _, mp := range markerPerformers {
				if mp.PerformerID != performerID && mp.Role == oppositeRole {
					if coPerformerScenes[mp.PerformerID] == nil {
						coPerformerScenes[mp.PerformerID] = make(map[int]bool)
					}
					coPerformerScenes[mp.PerformerID][marker.SceneID] = true
				}
			}
		}

		// Convert to scene counts
		sceneCountsByPerformer = make(map[int]int)
		for performerID, scenes := range coPerformerScenes {
			sceneCountsByPerformer[performerID] = len(scenes)
		}

		return nil
	}); err != nil {
		return nil, err
	}

	return sceneCountsByPerformer, nil
}

func (r *performerResolver) AdditionalImages(ctx context.Context, obj *models.Performer) ([]*models.PerformerImage, error) {
	var images []*models.PerformerImage
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		var err error
		images, err = r.repository.PerformerImage.GetByPerformerID(ctx, obj.ID)
		return err
	}); err != nil {
		return nil, err
	}
	return images, nil
}
