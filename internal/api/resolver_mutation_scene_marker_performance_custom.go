package api

import "github.com/stashapp/stash/pkg/models"

func equalSceneMarkerIDSetsCustom(left, right []int) bool {
	if len(left) != len(right) {
		return false
	}

	seen := make(map[int]int, len(left))
	for _, id := range left {
		seen[id]++
	}
	for _, id := range right {
		if seen[id] == 0 {
			return false
		}
		seen[id]--
	}

	return true
}

func markerPerformerIDsForRoleCustom(performers []*models.MarkerPerformer, role string) []int {
	ret := make([]int, 0, len(performers))
	for _, performer := range performers {
		if performer.Role == role {
			ret = append(ret, performer.PerformerID)
		}
	}

	return ret
}
