package loaders

import (
	"context"

	"github.com/stashapp/stash/pkg/models"
)

func (m Middleware) fetchSceneReleaseTotalsCustom(ctx context.Context) func([]int) ([]models.SceneReleaseTotalsCustom, []error) {
	return func(keys []int) ([]models.SceneReleaseTotalsCustom, []error) {
		ret := make([]models.SceneReleaseTotalsCustom, len(keys))
		err := m.Repository.WithDB(ctx, func(ctx context.Context) error {
			totals, err := m.Repository.SceneRelease.GetSceneTotalsCustom(ctx, keys)
			if err != nil {
				return err
			}
			for i, key := range keys {
				ret[i] = totals[key]
			}
			return nil
		})
		return ret, toErrorSlice(err)
	}
}
