package api

// CUSTOM: Custom performer co-performer analysis resolver functions.

import (
	"context"
	"strconv"

	"github.com/stashapp/stash/internal/manager/config"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/scene"
)

// PerformerCoPerformersByRole returns performers grouped by their role relationship with a given performer
func (r *queryResolver) PerformerCoPerformersByRole(ctx context.Context, performerID string) (*PerformerCoPerformersByRole, error) {
	performerIDInt, err := strconv.Atoi(performerID)
	if err != nil {
		return nil, err
	}

	// Get configured tag IDs
	cfg := config.GetInstance()
	uiConfig := cfg.GetUIConfiguration()
	roleTagIDs := getRoleTagIDsFromUIConfig(uiConfig)

	result := &PerformerCoPerformersByRole{}
	performerCache := make(map[int]*models.Performer)

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		// Get sex co-performers (depth 0 = exact match)
		if roleTagIDs.sexTagID != 0 {
			sexAsTopCounts, err := r.getCoPerformersWithCounts(ctx, performerIDInt, roleTagIDs.sexTagID, "top", 0)
			if err != nil {
				return err
			}
			result.SexAsTop, err = r.convertToPerformerWithSceneCountCached(ctx, sexAsTopCounts, performerCache)
			if err != nil {
				return err
			}

			sexAsBottomCounts, err := r.getCoPerformersWithCounts(ctx, performerIDInt, roleTagIDs.sexTagID, "bottom", 0)
			if err != nil {
				return err
			}
			result.SexAsBottom, err = r.convertToPerformerWithSceneCountCached(ctx, sexAsBottomCounts, performerCache)
			if err != nil {
				return err
			}
		}

		// Get oral co-performers (depth -1 = include subtags)
		if roleTagIDs.oralTagID != 0 {
			oralAsTopCounts, err := r.getCoPerformersWithCounts(ctx, performerIDInt, roleTagIDs.oralTagID, "top", -1)
			if err != nil {
				return err
			}
			result.OralAsTop, err = r.convertToPerformerWithSceneCountCached(ctx, oralAsTopCounts, performerCache)
			if err != nil {
				return err
			}

			oralAsBottomCounts, err := r.getCoPerformersWithCounts(ctx, performerIDInt, roleTagIDs.oralTagID, "bottom", -1)
			if err != nil {
				return err
			}
			result.OralAsBottom, err = r.convertToPerformerWithSceneCountCached(ctx, oralAsBottomCounts, performerCache)
			if err != nil {
				return err
			}
		}

		// Get facial co-performers (depth -1 = include subtags)
		if roleTagIDs.facialTagID != 0 {
			facialAsTopCounts, err := r.getCoPerformersWithCounts(ctx, performerIDInt, roleTagIDs.facialTagID, "top", -1)
			if err != nil {
				return err
			}
			result.FacialAsTop, err = r.convertToPerformerWithSceneCountCached(ctx, facialAsTopCounts, performerCache)
			if err != nil {
				return err
			}

			facialAsBottomCounts, err := r.getCoPerformersWithCounts(ctx, performerIDInt, roleTagIDs.facialTagID, "bottom", -1)
			if err != nil {
				return err
			}
			result.FacialAsBottom, err = r.convertToPerformerWithSceneCountCached(ctx, facialAsBottomCounts, performerCache)
			if err != nil {
				return err
			}
		}

		// Calculate unique count across all roles
		uniqueIDs := make(map[int]struct{})
		for _, p := range result.SexAsTop {
			uniqueIDs[p.Performer.ID] = struct{}{}
		}
		for _, p := range result.SexAsBottom {
			uniqueIDs[p.Performer.ID] = struct{}{}
		}
		for _, p := range result.OralAsTop {
			uniqueIDs[p.Performer.ID] = struct{}{}
		}
		for _, p := range result.OralAsBottom {
			uniqueIDs[p.Performer.ID] = struct{}{}
		}
		for _, p := range result.FacialAsTop {
			uniqueIDs[p.Performer.ID] = struct{}{}
		}
		for _, p := range result.FacialAsBottom {
			uniqueIDs[p.Performer.ID] = struct{}{}
		}
		result.UniqueCount = len(uniqueIDs)

		return nil
	}); err != nil {
		return nil, err
	}

	return result, nil
}

// PerformerCoPerformerCount returns the exact unique co-performer count without loading full performer payloads.
// CUSTOM
func (r *queryResolver) PerformerCoPerformerCount(ctx context.Context, performerID string) (int, error) {
	performerIDInt, err := strconv.Atoi(performerID)
	if err != nil {
		return 0, err
	}

	cfg := config.GetInstance()
	uiConfig := cfg.GetUIConfiguration()
	roleTagIDs := getRoleTagIDsFromUIConfig(uiConfig)

	uniqueIDs := make(map[int]struct{})
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		addCounts := func(tagID int, role string, depth int) error {
			if tagID == 0 {
				return nil
			}

			counts, err := r.getCoPerformersWithCounts(ctx, performerIDInt, tagID, role, depth)
			if err != nil {
				return err
			}

			for id := range counts {
				uniqueIDs[id] = struct{}{}
			}

			return nil
		}

		if err := addCounts(roleTagIDs.sexTagID, "top", 0); err != nil {
			return err
		}
		if err := addCounts(roleTagIDs.sexTagID, "bottom", 0); err != nil {
			return err
		}
		if err := addCounts(roleTagIDs.oralTagID, "top", -1); err != nil {
			return err
		}
		if err := addCounts(roleTagIDs.oralTagID, "bottom", -1); err != nil {
			return err
		}
		if err := addCounts(roleTagIDs.facialTagID, "top", -1); err != nil {
			return err
		}
		return addCounts(roleTagIDs.facialTagID, "bottom", -1)
	}); err != nil {
		return 0, err
	}

	return len(uniqueIDs), nil
}

// StudioPerformerCoPerformersByRole returns co-performers scoped to a specific studio (and optional depth).
// CUSTOM
func (r *queryResolver) StudioPerformerCoPerformersByRole(ctx context.Context, performerID string, studioID string, depth *int) (*PerformerCoPerformersByRole, error) {
	performerIDInt, err := strconv.Atoi(performerID)
	if err != nil {
		return nil, err
	}
	studioIDInt, err := strconv.Atoi(studioID)
	if err != nil {
		return nil, err
	}

	cfg := config.GetInstance()
	uiConfig := cfg.GetUIConfiguration()
	roleTagIDs := getRoleTagIDsFromUIConfig(uiConfig)

	result := &PerformerCoPerformersByRole{}
	performerCache := make(map[int]*models.Performer)

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		if roleTagIDs.sexTagID != 0 {
			topCounts, err := scene.GetCoPerformersWithCountsByStudio(ctx, r.repository.SceneMarker, r.repository.Scene, studioIDInt, depth, performerIDInt, roleTagIDs.sexTagID, "top", 0)
			if err != nil {
				return err
			}
			result.SexAsTop, err = r.convertToPerformerWithSceneCountCached(ctx, topCounts, performerCache)
			if err != nil {
				return err
			}

			bottomCounts, err := scene.GetCoPerformersWithCountsByStudio(ctx, r.repository.SceneMarker, r.repository.Scene, studioIDInt, depth, performerIDInt, roleTagIDs.sexTagID, "bottom", 0)
			if err != nil {
				return err
			}
			result.SexAsBottom, err = r.convertToPerformerWithSceneCountCached(ctx, bottomCounts, performerCache)
			if err != nil {
				return err
			}
		}

		if roleTagIDs.oralTagID != 0 {
			topCounts, err := scene.GetCoPerformersWithCountsByStudio(ctx, r.repository.SceneMarker, r.repository.Scene, studioIDInt, depth, performerIDInt, roleTagIDs.oralTagID, "top", -1)
			if err != nil {
				return err
			}
			result.OralAsTop, err = r.convertToPerformerWithSceneCountCached(ctx, topCounts, performerCache)
			if err != nil {
				return err
			}

			bottomCounts, err := scene.GetCoPerformersWithCountsByStudio(ctx, r.repository.SceneMarker, r.repository.Scene, studioIDInt, depth, performerIDInt, roleTagIDs.oralTagID, "bottom", -1)
			if err != nil {
				return err
			}
			result.OralAsBottom, err = r.convertToPerformerWithSceneCountCached(ctx, bottomCounts, performerCache)
			if err != nil {
				return err
			}
		}

		if roleTagIDs.facialTagID != 0 {
			topCounts, err := scene.GetCoPerformersWithCountsByStudio(ctx, r.repository.SceneMarker, r.repository.Scene, studioIDInt, depth, performerIDInt, roleTagIDs.facialTagID, "top", -1)
			if err != nil {
				return err
			}
			result.FacialAsTop, err = r.convertToPerformerWithSceneCountCached(ctx, topCounts, performerCache)
			if err != nil {
				return err
			}

			bottomCounts, err := scene.GetCoPerformersWithCountsByStudio(ctx, r.repository.SceneMarker, r.repository.Scene, studioIDInt, depth, performerIDInt, roleTagIDs.facialTagID, "bottom", -1)
			if err != nil {
				return err
			}
			result.FacialAsBottom, err = r.convertToPerformerWithSceneCountCached(ctx, bottomCounts, performerCache)
			if err != nil {
				return err
			}
		}

		uniqueIDs := make(map[int]struct{})
		for _, p := range result.SexAsTop {
			uniqueIDs[p.Performer.ID] = struct{}{}
		}
		for _, p := range result.SexAsBottom {
			uniqueIDs[p.Performer.ID] = struct{}{}
		}
		for _, p := range result.OralAsTop {
			uniqueIDs[p.Performer.ID] = struct{}{}
		}
		for _, p := range result.OralAsBottom {
			uniqueIDs[p.Performer.ID] = struct{}{}
		}
		for _, p := range result.FacialAsTop {
			uniqueIDs[p.Performer.ID] = struct{}{}
		}
		for _, p := range result.FacialAsBottom {
			uniqueIDs[p.Performer.ID] = struct{}{}
		}
		result.UniqueCount = len(uniqueIDs)

		return nil
	}); err != nil {
		return nil, err
	}

	return result, nil
}

// PerformerRoleStats returns all performer-card role stats for the provided performers in one batch.
// CUSTOM
func (r *queryResolver) PerformerRoleStats(ctx context.Context, performerIDs []string) ([]*PerformerRoleStats, error) {
	ids := make([]int, 0, len(performerIDs))
	for _, id := range performerIDs {
		parsed, err := strconv.Atoi(id)
		if err != nil {
			return nil, err
		}
		ids = append(ids, parsed)
	}

	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, oralTagID, soloTagID, facialTagID, orgasmTagID, feetTagID, secondCameraTagID := getRoleTagIDs(uiConfig)

	var statsByPerformer map[int]*scene.PerformerRoleStatsData
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		var err error
		statsByPerformer, err = scene.GetPerformerRoleStatsBatch(ctx, r.repository.SceneMarker, r.repository.Tag, ids, sexTagID, oralTagID, soloTagID, facialTagID, orgasmTagID, feetTagID, secondCameraTagID)
		return err
	}); err != nil {
		return nil, err
	}

	ret := make([]*PerformerRoleStats, 0, len(ids))
	added := make(map[int]bool, len(ids))
	for _, id := range ids {
		if added[id] {
			continue
		}
		added[id] = true
		data := statsByPerformer[id]
		if data == nil {
			data = &scene.PerformerRoleStatsData{PerformerID: id}
		}
		ret = append(ret, &PerformerRoleStats{
			PerformerID:                 strconv.Itoa(data.PerformerID),
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
			FacialMarkerWithTopCount:    data.FacialMarkerWithTopCount,
			FacialMarkerWithBottomCount: data.FacialMarkerWithBottomCount,
			SexUniquePartnerCount:       data.SexUniquePartnerCount,
			OralUniquePartnerCount:      data.OralUniquePartnerCount,
			FacialUniquePartnerCount:    data.FacialUniquePartnerCount,
			OrgasmTopCount:              data.OrgasmTopCount,
			FacialMarkerCount:           data.FacialMarkerCount,
			FeetTopCount:                data.FeetTopCount,
		})
	}

	return ret, nil
}

// roleTagIDsConfig holds the configured role tag IDs
type roleTagIDsConfig struct {
	sexTagID    int
	oralTagID   int
	soloTagID   int
	facialTagID int
	orgasmTagID int
}

// getRoleTagIDsFromUIConfig extracts role tag IDs from UI configuration
func getRoleTagIDsFromUIConfig(uiConfig map[string]interface{}) roleTagIDsConfig {
	result := roleTagIDsConfig{}
	if uiConfig == nil {
		return result
	}

	roleTagIDs, ok := uiConfig["roleTagIds"].(map[string]interface{})
	if !ok {
		return result
	}

	if sexTagID, ok := roleTagIDs["sexTagId"].(string); ok {
		result.sexTagID, _ = strconv.Atoi(sexTagID)
	}
	if oralTagID, ok := roleTagIDs["oralTagId"].(string); ok {
		result.oralTagID, _ = strconv.Atoi(oralTagID)
	}
	if soloTagID, ok := roleTagIDs["soloTagId"].(string); ok {
		result.soloTagID, _ = strconv.Atoi(soloTagID)
	}
	if facialTagID, ok := roleTagIDs["facialTagId"].(string); ok {
		result.facialTagID, _ = strconv.Atoi(facialTagID)
	}
	if orgasmTagID, ok := roleTagIDs["orgasmTagId"].(string); ok {
		result.orgasmTagID, _ = strconv.Atoi(orgasmTagID)
	}

	return result
}

// getCoPerformers gets co-performers for a given performer based on tag and role
// Returns a map of performer ID to scene count
// depth: 0 for exact tag match, -1 for including all subtags
func (r *queryResolver) getCoPerformersWithCounts(ctx context.Context, performerID int, tagID int, performerRole string, depth int) (map[int]int, error) {
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

	markers, _, err := r.repository.SceneMarker.Query(ctx, filter, nil)
	if err != nil {
		return nil, err
	}

	// CUSTOM: begin - batch-fetch performer associations to eliminate N+1 queries
	markerIDs := make([]int, len(markers))
	for i, m := range markers {
		markerIDs[i] = m.ID
	}
	allMarkerPerformers, err := r.repository.SceneMarker.GetPerformersForMarkers(ctx, markerIDs)
	if err != nil {
		return nil, err
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
	sceneCountsByPerformer := make(map[int]int)
	for performerID, scenes := range coPerformerScenes {
		sceneCountsByPerformer[performerID] = len(scenes)
	}

	return sceneCountsByPerformer, nil
}

// convertToPerformerWithSceneCount converts a map of performer IDs to scene counts to a slice of PerformerWithSceneCount
func (r *queryResolver) convertToPerformerWithSceneCount(ctx context.Context, counts map[int]int) ([]*PerformerWithSceneCount, error) {
	return r.convertToPerformerWithSceneCountCached(ctx, counts, make(map[int]*models.Performer))
}

func (r *queryResolver) convertToPerformerWithSceneCountCached(ctx context.Context, counts map[int]int, performerCache map[int]*models.Performer) ([]*PerformerWithSceneCount, error) {
	var result []*PerformerWithSceneCount
	var missingIDs []int

	for performerID := range counts {
		if _, ok := performerCache[performerID]; !ok {
			missingIDs = append(missingIDs, performerID)
		}
	}

	if len(missingIDs) > 0 {
		performers, err := r.repository.Performer.FindMany(ctx, missingIDs)
		if err != nil {
			return nil, err
		}

		for _, performer := range performers {
			if performer != nil {
				performerCache[performer.ID] = performer
			}
		}
	}

	for performerID, count := range counts {
		if p := performerCache[performerID]; p != nil {
			result = append(result, &PerformerWithSceneCount{
				Performer:  p,
				SceneCount: count,
			})
		}
	}

	return result, nil
}
