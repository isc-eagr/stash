package sqlite

import "github.com/stashapp/stash/pkg/models"

// CUSTOM: begin
func normalizeSceneMarkerTagGroupsSameUnnamedRolesCustom(groups []models.SceneMarkerTagGroupInput) []models.SceneMarkerTagGroupInput {
	if len(groups) == 0 {
		return groups
	}

	ret := make([]models.SceneMarkerTagGroupInput, len(groups))
	copy(ret, groups)

	for i := range ret {
		ret[i] = normalizeSceneMarkerTagGroupSameUnnamedRolesCustom(ret[i])
	}

	return ret
}

func normalizeSceneMarkerTagGroupSameUnnamedRolesCustom(group models.SceneMarkerTagGroupInput) models.SceneMarkerTagGroupInput {
	bottomByID := make(map[string]models.UnnamedPerformerCriterionInput)
	for _, slot := range group.BottomUnnamedPerformers {
		if slot.ID == nil || *slot.ID == "" {
			continue
		}
		bottomByID[*slot.ID] = slot
	}

	bothIDs := make(map[string]struct{})
	for _, slot := range group.BothRolesUnnamedPerformers {
		if slot.ID == nil || *slot.ID == "" {
			continue
		}
		bothIDs[*slot.ID] = struct{}{}
	}

	for _, slot := range group.TopUnnamedPerformers {
		if slot.ID == nil || *slot.ID == "" {
			continue
		}
		id := *slot.ID
		if _, ok := bottomByID[id]; !ok {
			continue
		}
		if _, ok := bothIDs[id]; ok {
			continue
		}

		group.BothRolesUnnamedPerformers = append(group.BothRolesUnnamedPerformers, slot)
		bothIDs[id] = struct{}{}
	}

	if len(bothIDs) == 0 {
		return group
	}

	group.TopUnnamedPerformers = filterUnnamedSlotsNotInSetCustom(group.TopUnnamedPerformers, bothIDs)
	group.BottomUnnamedPerformers = filterUnnamedSlotsNotInSetCustom(group.BottomUnnamedPerformers, bothIDs)

	return group
}

func filterUnnamedSlotsNotInSetCustom(slots []models.UnnamedPerformerCriterionInput, ids map[string]struct{}) []models.UnnamedPerformerCriterionInput {
	if len(slots) == 0 {
		return slots
	}

	ret := make([]models.UnnamedPerformerCriterionInput, 0, len(slots))
	for _, slot := range slots {
		if slot.ID == nil || *slot.ID == "" {
			ret = append(ret, slot)
			continue
		}
		if _, ok := ids[*slot.ID]; !ok {
			ret = append(ret, slot)
		}
	}

	return ret
}

// CUSTOM: end
