package mocks

import (
	"context"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/mock"
)

type TaskProgressTrackerReaderWriter struct {
	mock.Mock
}

func (m *TaskProgressTrackerReaderWriter) Events(ctx context.Context, id int, date string, after int) (*models.TaskProgressEventPage, error) {
	a := m.Called(ctx, id, date, after)
	v, _ := a.Get(0).(*models.TaskProgressEventPage)
	return v, a.Error(1)
}
func (m *TaskProgressTrackerReaderWriter) PendingItems(ctx context.Context, id int, typ string, offset int) (*models.TaskProgressEventPage, error) {
	a := m.Called(ctx, id, typ, offset)
	v, _ := a.Get(0).(*models.TaskProgressEventPage)
	return v, a.Error(1)
}

func (m *TaskProgressTrackerReaderWriter) Overall(ctx context.Context) (*models.TaskProgressOverall, error) {
	args := m.Called(ctx)
	overall, _ := args.Get(0).(*models.TaskProgressOverall)
	return overall, args.Error(1)
}

func (m *TaskProgressTrackerReaderWriter) Find(ctx context.Context, id int) (*models.TaskProgressTracker, error) {
	args := m.Called(ctx, id)
	tracker, _ := args.Get(0).(*models.TaskProgressTracker)
	return tracker, args.Error(1)
}

func (m *TaskProgressTrackerReaderWriter) FindAll(ctx context.Context) ([]*models.TaskProgressTracker, error) {
	args := m.Called(ctx)
	trackers, _ := args.Get(0).([]*models.TaskProgressTracker)
	return trackers, args.Error(1)
}

func (m *TaskProgressTrackerReaderWriter) CountDirectlyTaggedItems(ctx context.Context, tagID int, itemTypes []string) (int, error) {
	args := m.Called(ctx, tagID, itemTypes)
	return args.Int(0), args.Error(1)
}

func (m *TaskProgressTrackerReaderWriter) CreateBaseline(ctx context.Context, tracker *models.TaskProgressTracker) error {
	return m.Called(ctx, tracker).Error(0)
}

func (m *TaskProgressTrackerReaderWriter) Create(ctx context.Context, tracker *models.TaskProgressTracker) error {
	return m.Called(ctx, tracker).Error(0)
}

func (m *TaskProgressTrackerReaderWriter) Update(ctx context.Context, tracker *models.TaskProgressTracker) error {
	return m.Called(ctx, tracker).Error(0)
}

func (m *TaskProgressTrackerReaderWriter) Delete(ctx context.Context, id int) error {
	return m.Called(ctx, id).Error(0)
}

func (m *TaskProgressTrackerReaderWriter) Reorder(ctx context.Context, ids []int) error {
	return m.Called(ctx, ids).Error(0)
}
