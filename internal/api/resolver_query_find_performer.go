package api

import (
	"context"
	"strconv"

	"github.com/stashapp/stash/internal/manager/config"
	"github.com/stashapp/stash/pkg/models"
)

func (r *queryResolver) FindPerformer(ctx context.Context, id string) (ret *models.Performer, err error) {
	idInt, err := strconv.Atoi(id)
	if err != nil {
		return nil, err
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.Performer.Find(ctx, idInt)
		return err
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

func (r *queryResolver) FindPerformers(ctx context.Context, performerFilter *models.PerformerFilterType, filter *models.FindFilterType, performerIDs []int, ids []string) (ret *FindPerformersResultType, err error) {
	if len(ids) > 0 {
		performerIDs, err = handleIDList(ids, "ids")
		if err != nil {
			return nil, err
		}
	}

	// #5682 - convert JSON numbers to float64 or int64
	if performerFilter != nil {
		performerFilter.CustomFields = convertCustomFieldCriterionInputJSONNumbers(performerFilter.CustomFields)
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		var performers []*models.Performer
		var err error
		var total int

		if len(performerIDs) > 0 {
			performers, err = r.repository.Performer.FindMany(ctx, performerIDs)
			total = len(performers)
		} else {
			performers, total, err = r.repository.Performer.Query(ctx, performerFilter, filter)
		}

		if err != nil {
			return err
		}

		ret = &FindPerformersResultType{
			Count:      total,
			Performers: performers,
		}

		return nil
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

func (r *queryResolver) AllPerformers(ctx context.Context) (ret []*models.Performer, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.Performer.All(ctx)
		return err
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

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

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		// Get sex co-performers
		if roleTagIDs.sexTagID != 0 {
			sexAsTopCounts, err := r.getCoPerformersWithCounts(ctx, performerIDInt, roleTagIDs.sexTagID, "top")
			if err != nil {
				return err
			}
			result.SexAsTop, err = r.convertToPerformerWithSceneCount(ctx, sexAsTopCounts)
			if err != nil {
				return err
			}

			sexAsBottomCounts, err := r.getCoPerformersWithCounts(ctx, performerIDInt, roleTagIDs.sexTagID, "bottom")
			if err != nil {
				return err
			}
			result.SexAsBottom, err = r.convertToPerformerWithSceneCount(ctx, sexAsBottomCounts)
			if err != nil {
				return err
			}
		}

		// Get oral co-performers
		if roleTagIDs.oralTagID != 0 {
			oralAsTopCounts, err := r.getCoPerformersWithCounts(ctx, performerIDInt, roleTagIDs.oralTagID, "top")
			if err != nil {
				return err
			}
			result.OralAsTop, err = r.convertToPerformerWithSceneCount(ctx, oralAsTopCounts)
			if err != nil {
				return err
			}

			oralAsBottomCounts, err := r.getCoPerformersWithCounts(ctx, performerIDInt, roleTagIDs.oralTagID, "bottom")
			if err != nil {
				return err
			}
			result.OralAsBottom, err = r.convertToPerformerWithSceneCount(ctx, oralAsBottomCounts)
			if err != nil {
				return err
			}
		}

		// Get facial co-performers
		if roleTagIDs.facialTagID != 0 {
			facialAsTopCounts, err := r.getCoPerformersWithCounts(ctx, performerIDInt, roleTagIDs.facialTagID, "top")
			if err != nil {
				return err
			}
			result.FacialAsTop, err = r.convertToPerformerWithSceneCount(ctx, facialAsTopCounts)
			if err != nil {
				return err
			}

			facialAsBottomCounts, err := r.getCoPerformersWithCounts(ctx, performerIDInt, roleTagIDs.facialTagID, "bottom")
			if err != nil {
				return err
			}
			result.FacialAsBottom, err = r.convertToPerformerWithSceneCount(ctx, facialAsBottomCounts)
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

// roleTagIDsConfig holds the configured role tag IDs
type roleTagIDsConfig struct {
	sexTagID    int
	oralTagID   int
	soloTagID   int
	facialTagID int
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

	return result
}

// getCoPerformers gets co-performers for a given performer based on tag and role
// Returns a map of performer ID to scene count
func (r *queryResolver) getCoPerformersWithCounts(ctx context.Context, performerID int, tagID int, performerRole string) (map[int]int, error) {
	// Find markers with this tag where the performer has the given role
	// Then find other performers in those markers with the opposite role
	oppositeRole := "bottom"
	if performerRole == "bottom" {
		oppositeRole = "top"
	}

	filter := &models.SceneMarkerFilterType{
		Tags: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(tagID)},
			Modifier: models.CriterionModifierIncludes,
		},
	}

	// Filter to markers where our performer has the specified role
	performerIDStr := strconv.Itoa(performerID)
	topIDs := []string{}
	bottomIDs := []string{}

	if performerRole == "top" {
		topIDs = append(topIDs, performerIDStr)
	} else {
		bottomIDs = append(bottomIDs, performerIDStr)
	}

	mode := "OR"
	filter.MarkerPerformers = &models.MarkerPerformersFilterInput{
		TopPerformerIDs:    topIDs,
		BottomPerformerIDs: bottomIDs,
		Mode:               &mode,
		Modifier:           models.CriterionModifierIncludes,
	}

	markers, _, err := r.repository.SceneMarker.Query(ctx, filter, nil)
	if err != nil {
		return nil, err
	}

	// Collect performer IDs with the opposite role from these markers
	// Map of performer ID to scene IDs they appeared in
	coPerformerScenes := make(map[int]map[int]bool)

	for _, marker := range markers {
		markerPerformers, err := r.repository.SceneMarker.GetPerformers(ctx, marker.ID)
		if err != nil {
			return nil, err
		}

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
	var result []*PerformerWithSceneCount

	for performerID, count := range counts {
		p, err := r.repository.Performer.Find(ctx, performerID)
		if err != nil {
			return nil, err
		}
		if p != nil {
			result = append(result, &PerformerWithSceneCount{
				Performer:  p,
				SceneCount: count,
			})
		}
	}

	return result, nil
}
