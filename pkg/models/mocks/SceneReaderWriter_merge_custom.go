package mocks

import (
	"context"

	"github.com/stashapp/stash/pkg/models"
)

func (_m *SceneReaderWriter) MergeCustomDataCustom(ctx context.Context, sourceIDs []int, destID int, options models.SceneMergeOptionsCustom) (int, error) {
	ret := _m.Called(ctx, sourceIDs, destID, options)
	if fn, ok := ret.Get(0).(func(context.Context, []int, int, models.SceneMergeOptionsCustom) (int, error)); ok {
		return fn(ctx, sourceIDs, destID, options)
	}
	return ret.Int(0), ret.Error(1)
}
