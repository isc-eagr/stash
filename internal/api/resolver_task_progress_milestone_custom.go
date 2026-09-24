package api

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/stashapp/stash/pkg/models"
)

func taskProgressMilestoneTargetCustom(value *string) (*string, error) {
	if value == nil || strings.TrimSpace(*value) == "" {
		return nil, nil
	}
	date := strings.TrimSpace(*value)
	parsed, err := time.Parse(taskProgressDateLayoutCustom, date)
	if err != nil || parsed.Format(taskProgressDateLayoutCustom) != date {
		return nil, fmt.Errorf("%w: target_date must be a valid YYYY-MM-DD date", ErrInput)
	}
	return &date, nil
}

func taskProgressMilestoneMembersCustom(ctx context.Context, repository models.TaskProgressTrackerReaderWriter, raw []string, existing []int) ([]int, error) {
	ids := make([]int, 0, len(raw))
	seen := map[int]bool{}
	allowedDeleted := map[int]bool{}
	for _, id := range existing {
		allowedDeleted[id] = true
	}
	for _, value := range raw {
		id, err := strconv.Atoi(value)
		if err != nil || id <= 0 {
			return nil, fmt.Errorf("%w: invalid tracker id %q", ErrInput, value)
		}
		if seen[id] {
			return nil, fmt.Errorf("%w: duplicate tracker %d", ErrInput, id)
		}
		seen[id] = true
		tracker, err := repository.Find(ctx, id)
		if err != nil {
			return nil, err
		}
		if tracker == nil || (tracker.Status == models.TaskProgressTrackerStatusDeleted && !allowedDeleted[id]) {
			return nil, fmt.Errorf("%w: tracker %d is unavailable", ErrInput, id)
		}
		ids = append(ids, id)
	}
	return ids, nil
}

func (r *queryResolver) FindTaskProgressMilestones(ctx context.Context) (ret []*models.TaskProgressMilestone, err error) {
	err = r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.TaskProgressTracker.FindMilestones(ctx)
		return err
	})
	return
}

func (r *queryResolver) TaskProgressMilestone(ctx context.Context, id string) (ret *models.TaskProgressMilestone, err error) {
	milestoneID, err := strconv.Atoi(id)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid milestone id", ErrInput)
	}
	err = r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.TaskProgressTracker.FindMilestone(ctx, milestoneID)
		return err
	})
	return
}

func (r *mutationResolver) TaskProgressMilestoneCreate(ctx context.Context, input TaskProgressMilestoneCreateInput) (ret *models.TaskProgressMilestone, err error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, fmt.Errorf("%w: name must not be empty", ErrInput)
	}
	date, err := taskProgressMilestoneTargetCustom(input.TargetDate)
	if err != nil {
		return nil, err
	}
	if input.GoalPerDay != nil && *input.GoalPerDay <= 0 {
		return nil, fmt.Errorf("%w: goal per day must be positive", ErrInput)
	}
	m := &models.TaskProgressMilestone{Name: name, TargetDate: date, GoalPerDay: input.GoalPerDay}
	err = r.withTxn(ctx, func(ctx context.Context) error {
		m.TrackerIDs, err = taskProgressMilestoneMembersCustom(ctx, r.repository.TaskProgressTracker, input.TrackerIds, nil)
		if err != nil {
			return err
		}
		if err := r.repository.TaskProgressTracker.CreateMilestone(ctx, m); err != nil {
			return err
		}
		ret, err = r.repository.TaskProgressTracker.FindMilestone(ctx, m.ID)
		return err
	})
	return
}

func (r *mutationResolver) TaskProgressMilestoneUpdate(ctx context.Context, input TaskProgressMilestoneUpdateInput) (ret *models.TaskProgressMilestone, err error) {
	id, err := strconv.Atoi(input.ID)
	if err != nil || id <= 0 {
		return nil, fmt.Errorf("%w: invalid milestone id", ErrInput)
	}
	err = r.withTxn(ctx, func(ctx context.Context) error {
		m, err := r.repository.TaskProgressTracker.FindMilestone(ctx, id)
		if err != nil {
			return err
		}
		if m == nil {
			return fmt.Errorf("%w: milestone %d not found", ErrInput, id)
		}
		if m.Version != input.ExpectedVersion {
			return fmt.Errorf("%w: milestone changed; refresh before editing", ErrInput)
		}
		if input.Name != nil {
			m.Name = strings.TrimSpace(*input.Name)
			if m.Name == "" {
				return fmt.Errorf("%w: name must not be empty", ErrInput)
			}
		}
		if input.TargetDate != nil {
			m.TargetDate, err = taskProgressMilestoneTargetCustom(input.TargetDate)
			if err != nil {
				return err
			}
		}
		if input.GoalPerDay != nil {
			if *input.GoalPerDay < 0 {
				return fmt.Errorf("%w: goal per day must be positive or zero to clear", ErrInput)
			}
			m.GoalPerDay = input.GoalPerDay
			if *input.GoalPerDay == 0 {
				m.GoalPerDay = nil
			}
		}
		if input.TrackerIds != nil {
			m.TrackerIDs, err = taskProgressMilestoneMembersCustom(ctx, r.repository.TaskProgressTracker, input.TrackerIds, m.TrackerIDs)
			if err != nil {
				return err
			}
		}
		if err := r.repository.TaskProgressTracker.UpdateMilestone(ctx, m, input.TrackerIds != nil); err != nil {
			return err
		}
		ret, err = r.repository.TaskProgressTracker.FindMilestone(ctx, id)
		return err
	})
	return
}

func (r *mutationResolver) TaskProgressMilestoneDestroy(ctx context.Context, id string) (bool, error) {
	milestoneID, err := strconv.Atoi(id)
	if err != nil || milestoneID <= 0 {
		return false, fmt.Errorf("%w: invalid milestone id", ErrInput)
	}
	if err := r.withTxn(ctx, func(ctx context.Context) error {
		m, err := r.repository.TaskProgressTracker.FindMilestone(ctx, milestoneID)
		if err != nil {
			return err
		}
		if m == nil {
			return fmt.Errorf("%w: milestone %d not found", ErrInput, milestoneID)
		}
		return r.repository.TaskProgressTracker.DeleteMilestone(ctx, milestoneID)
	}); err != nil {
		return false, err
	}
	return true, nil
}
