package api

// CUSTOM: Shared role-specific durations for performer partner cards.

import "github.com/stashapp/stash/pkg/models"

type coPerformerRoleStatsCustom struct {
	sceneCount      int
	durationSeconds float64
}

func calculateCoPerformerRoleStatsCustom(
	performerID int,
	oppositeRole string,
	markers []*models.SceneMarker,
	performersByMarker map[int][]*models.MarkerPerformer,
) map[int]coPerformerRoleStatsCustom {
	scenesByPerformer := make(map[int]map[int]struct{})
	intervalsByPerformer := make(map[int][]activityIntervalCustom)

	for _, marker := range markers {
		if marker == nil {
			continue
		}

		for _, markerPerformer := range performersByMarker[marker.ID] {
			if markerPerformer.PerformerID == performerID || markerPerformer.Role != oppositeRole {
				continue
			}

			partnerID := markerPerformer.PerformerID
			if scenesByPerformer[partnerID] == nil {
				scenesByPerformer[partnerID] = make(map[int]struct{})
			}
			scenesByPerformer[partnerID][marker.SceneID] = struct{}{}

			if marker.EndSeconds != nil && *marker.EndSeconds > marker.Seconds {
				intervalsByPerformer[partnerID] = append(
					intervalsByPerformer[partnerID],
					activityIntervalCustom{
						sceneID: marker.SceneID,
						start:   marker.Seconds,
						end:     *marker.EndSeconds,
					},
				)
			}
		}
	}

	result := make(map[int]coPerformerRoleStatsCustom, len(scenesByPerformer))
	for partnerID, scenes := range scenesByPerformer {
		result[partnerID] = coPerformerRoleStatsCustom{
			sceneCount:      len(scenes),
			durationSeconds: activityStatsDurationCustom(intervalsByPerformer[partnerID]),
		}
	}

	return result
}
