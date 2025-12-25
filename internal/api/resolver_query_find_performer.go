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
			sexAsGiver, err := r.getCoPerformers(ctx, performerIDInt, roleTagIDs.sexTagID, "giver")
			if err != nil {
				return err
			}
			result.SexAsGiver = sexAsGiver

			sexAsReceiver, err := r.getCoPerformers(ctx, performerIDInt, roleTagIDs.sexTagID, "receiver")
			if err != nil {
				return err
			}
			result.SexAsReceiver = sexAsReceiver
		}

		// Get oral co-performers
		if roleTagIDs.oralTagID != 0 {
			oralAsGiver, err := r.getCoPerformers(ctx, performerIDInt, roleTagIDs.oralTagID, "giver")
			if err != nil {
				return err
			}
			result.OralAsGiver = oralAsGiver

			oralAsReceiver, err := r.getCoPerformers(ctx, performerIDInt, roleTagIDs.oralTagID, "receiver")
			if err != nil {
				return err
			}
			result.OralAsReceiver = oralAsReceiver
		}

		// Get facial co-performers
		if roleTagIDs.facialTagID != 0 {
			facialAsGiver, err := r.getCoPerformers(ctx, performerIDInt, roleTagIDs.facialTagID, "giver")
			if err != nil {
				return err
			}
			result.FacialAsGiver = facialAsGiver

			facialAsReceiver, err := r.getCoPerformers(ctx, performerIDInt, roleTagIDs.facialTagID, "receiver")
			if err != nil {
				return err
			}
			result.FacialAsReceiver = facialAsReceiver
		}

		// Calculate unique count across all roles
		uniqueIDs := make(map[int]struct{})
		for _, p := range result.SexAsGiver {
			uniqueIDs[p.ID] = struct{}{}
		}
		for _, p := range result.SexAsReceiver {
			uniqueIDs[p.ID] = struct{}{}
		}
		for _, p := range result.OralAsGiver {
			uniqueIDs[p.ID] = struct{}{}
		}
		for _, p := range result.OralAsReceiver {
			uniqueIDs[p.ID] = struct{}{}
		}
		for _, p := range result.FacialAsGiver {
			uniqueIDs[p.ID] = struct{}{}
		}
		for _, p := range result.FacialAsReceiver {
			uniqueIDs[p.ID] = struct{}{}
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
func (r *queryResolver) getCoPerformers(ctx context.Context, performerID int, tagID int, performerRole string) ([]*models.Performer, error) {
	// Find markers with this tag where the performer has the given role
	// Then find other performers in those markers with the opposite role
	oppositeRole := "receiver"
	if performerRole == "receiver" {
		oppositeRole = "giver"
	}

	filter := &models.SceneMarkerFilterType{
		Tags: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(tagID)},
			Modifier: models.CriterionModifierIncludes,
		},
	}

	// Filter to markers where our performer has the specified role
	performerIDStr := strconv.Itoa(performerID)
	giverIDs := []string{}
	receiverIDs := []string{}

	if performerRole == "giver" {
		giverIDs = append(giverIDs, performerIDStr)
	} else {
		receiverIDs = append(receiverIDs, performerIDStr)
	}

	mode := "OR"
	filter.MarkerPerformers = &models.MarkerPerformersFilterInput{
		GiverPerformerIDs:    giverIDs,
		ReceiverPerformerIDs: receiverIDs,
		Mode:                 &mode,
		Modifier:             models.CriterionModifierIncludes,
	}

	markers, _, err := r.repository.SceneMarker.Query(ctx, filter, nil)
	if err != nil {
		return nil, err
	}

	// Collect performer IDs with the opposite role from these markers
	coPerformerIDs := make(map[int]bool)
	for _, marker := range markers {
		markerPerformers, err := r.repository.SceneMarker.GetPerformers(ctx, marker.ID)
		if err != nil {
			return nil, err
		}

		for _, mp := range markerPerformers {
			if mp.PerformerID != performerID && mp.Role == oppositeRole {
				coPerformerIDs[mp.PerformerID] = true
			}
		}
	}

	// Fetch the performer objects
	var coPerformers []*models.Performer
	for id := range coPerformerIDs {
		p, err := r.repository.Performer.Find(ctx, id)
		if err != nil {
			return nil, err
		}
		if p != nil {
			coPerformers = append(coPerformers, p)
		}
	}

	return coPerformers, nil
}
