package scene

import (
	"sort"
	"strconv"

	"github.com/stashapp/stash/pkg/models"
)

// Restrict marker retrieval before hydration. An empty scope must match nothing,
// because an empty INCLUDES criterion would otherwise mean no restriction.
func studioMarkerSceneCriterionCustom(sceneIDs map[int]bool) *models.MultiCriterionInput {
	ids := make([]string, 0, len(sceneIDs))
	for id, included := range sceneIDs {
		if included {
			ids = append(ids, strconv.Itoa(id))
		}
	}
	if len(ids) == 0 {
		ids = []string{"-1"}
	}
	sort.Strings(ids)
	return &models.MultiCriterionInput{Value: ids, Modifier: models.CriterionModifierIncludes}
}
