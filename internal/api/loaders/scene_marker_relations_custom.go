package loaders

import (
	"context"

	"github.com/stashapp/stash/pkg/models"
)

// SceneMarkerRelationsCustom contains relationship IDs shared by multiple
// SceneMarker GraphQL fields.
type SceneMarkerRelationsCustom struct {
	TagIDs     []int
	Performers []*models.MarkerPerformer
}

func (m Middleware) fetchSceneMarkerRelationsCustom(ctx context.Context) func([]int) ([]SceneMarkerRelationsCustom, []error) {
	return func(keys []int) ([]SceneMarkerRelationsCustom, []error) {
		ret := make([]SceneMarkerRelationsCustom, len(keys))
		err := m.Repository.WithDB(ctx, func(ctx context.Context) error {
			tagIDsByMarker, err := m.Repository.SceneMarker.GetTagIDsForMarkers(ctx, keys)
			if err != nil {
				return err
			}

			performersByMarker, err := m.Repository.SceneMarker.GetPerformersForMarkers(ctx, keys)
			if err != nil {
				return err
			}

			for i, key := range keys {
				ret[i] = SceneMarkerRelationsCustom{
					TagIDs:     tagIDsByMarker[key],
					Performers: performersByMarker[key],
				}
			}
			return nil
		})

		return ret, toErrorSlice(err)
	}
}
