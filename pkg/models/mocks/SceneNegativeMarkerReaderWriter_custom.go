package mocks

import (
	"context"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/mock"
)

// SceneNegativeMarkerReaderWriter is a mock for models.SceneNegativeMarkerReaderWriter.
type SceneNegativeMarkerReaderWriter struct {
	mock.Mock
}

func (_m *SceneNegativeMarkerReaderWriter) Find(ctx context.Context, id int) (*models.SceneNegativeMarker, error) {
	args := _m.Called(ctx, id)
	ret := args.Get(0)
	if ret == nil {
		return nil, args.Error(1)
	}
	return ret.(*models.SceneNegativeMarker), args.Error(1)
}

func (_m *SceneNegativeMarkerReaderWriter) FindByScene(ctx context.Context, sceneID int) ([]*models.SceneNegativeMarker, error) {
	args := _m.Called(ctx, sceneID)
	ret := args.Get(0)
	if ret == nil {
		return nil, args.Error(1)
	}
	return ret.([]*models.SceneNegativeMarker), args.Error(1)
}

func (_m *SceneNegativeMarkerReaderWriter) Create(ctx context.Context, marker *models.SceneNegativeMarker) error {
	args := _m.Called(ctx, marker)
	return args.Error(0)
}

func (_m *SceneNegativeMarkerReaderWriter) Update(ctx context.Context, marker *models.SceneNegativeMarker) error {
	args := _m.Called(ctx, marker)
	return args.Error(0)
}

func (_m *SceneNegativeMarkerReaderWriter) Delete(ctx context.Context, id int) error {
	args := _m.Called(ctx, id)
	return args.Error(0)
}
