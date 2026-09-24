package mocks

import "context"

func (_m *SceneReaderWriter) EnsurePrimaryFileCustom(ctx context.Context, sceneID int) error {
	ret := _m.Called(ctx, sceneID)
	if fn, ok := ret.Get(0).(func(context.Context, int) error); ok {
		return fn(ctx, sceneID)
	}
	return ret.Error(0)
}

func (_m *SceneReaderWriter) DetachCoverForConversionCustom(ctx context.Context, sceneID int) error {
	ret := _m.Called(ctx, sceneID)
	if fn, ok := ret.Get(0).(func(context.Context, int) error); ok {
		return fn(ctx, sceneID)
	}
	return ret.Error(0)
}
