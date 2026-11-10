package mocks

import "context"

func (_m *ImageReaderWriter) OCountByStudioIDCustom(ctx context.Context, studioID int, depth *int, performerID *string) (int, error) {
	return mockStudioOCountCustom(_m.Called(ctx, studioID, depth, performerID), ctx, studioID, depth, performerID)
}

func (_m *SceneReaderWriter) OCountByStudioIDCustom(ctx context.Context, studioID int, depth *int, performerID *string) (int, error) {
	return mockStudioOCountCustom(_m.Called(ctx, studioID, depth, performerID), ctx, studioID, depth, performerID)
}

type mockArgumentsCustom interface {
	Get(int) interface{}
	Error(int) error
}

func mockStudioOCountCustom(ret mockArgumentsCustom, ctx context.Context, studioID int, depth *int, performerID *string) (int, error) {
	var r0 int
	if rf, ok := ret.Get(0).(func(context.Context, int, *int, *string) int); ok {
		r0 = rf(ctx, studioID, depth, performerID)
	} else {
		r0 = ret.Get(0).(int)
	}

	var r1 error
	if rf, ok := ret.Get(1).(func(context.Context, int, *int, *string) error); ok {
		r1 = rf(ctx, studioID, depth, performerID)
	} else {
		r1 = ret.Error(1)
	}

	return r0, r1
}
