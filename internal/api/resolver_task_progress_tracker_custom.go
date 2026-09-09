package api

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/stashapp/stash/internal/manager/config"
	"github.com/stashapp/stash/pkg/logger"
	"github.com/stashapp/stash/pkg/models"
)

const taskProgressTrackersUIConfigKey = "taskProgressTrackers"

const taskProgressDateLayoutCustom = "2006-01-02"
const taskProgressHistoryEpochCustom = "2026-09-07"

func taskProgressItemTypesCustom(values []string) ([]string, error) {
	if len(values) == 0 {
		return append([]string(nil), models.TaskProgressItemTypes...), nil
	}
	allowed := make(map[string]struct{}, len(models.TaskProgressItemTypes))
	for _, value := range models.TaskProgressItemTypes {
		allowed[value] = struct{}{}
	}
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if _, ok := allowed[value]; !ok {
			return nil, fmt.Errorf("%w: unsupported task progress item type %q", ErrInput, value)
		}
		seen[value] = struct{}{}
	}
	ret := make([]string, 0, len(seen))
	for _, value := range models.TaskProgressItemTypes {
		if _, ok := seen[value]; ok {
			ret = append(ret, value)
		}
	}
	return ret, nil
}

func taskProgressStatusCustom(value string) (string, error) {
	value = strings.ToUpper(strings.TrimSpace(value))
	switch value {
	case models.TaskProgressTrackerStatusActive, models.TaskProgressTrackerStatusPaused, models.TaskProgressTrackerStatusArchived, models.TaskProgressTrackerStatusCompleted:
		return value, nil
	default:
		return "", fmt.Errorf("%w: status must be ACTIVE, PAUSED, COMPLETED, or ARCHIVED", ErrInput)
	}
}

func taskProgressStartedOnCustom(value string) (string, error) {
	value = strings.TrimSpace(value)
	for _, layout := range []string{taskProgressDateLayoutCustom, "02/01/2006"} {
		date, err := time.Parse(layout, value)
		if err == nil {
			return date.Format(taskProgressDateLayoutCustom), nil
		}
	}

	return "", fmt.Errorf("%w: started_on must be a valid date in YYYY-MM-DD or DD/MM/YYYY format", ErrInput)
}

type legacyTaskProgressTrackerCustom struct {
	Title        string      `json:"title"`
	Name         string      `json:"name"`
	Description  string      `json:"description"`
	Goal         interface{} `json:"goal"`
	InitialValue interface{} `json:"initialValue"`
	TagID        string      `json:"tagId"`
	TagName      string      `json:"tagName"`
	IsWorkingOn  bool        `json:"isWorkingOn"`
}

func legacyTaskProgressTrackersCustom(uiConfig map[string]interface{}) ([]legacyTaskProgressTrackerCustom, error) {
	stored, found := uiConfig[taskProgressTrackersUIConfigKey]
	if !found || stored == nil {
		return nil, nil
	}

	encoded, err := json.Marshal(stored)
	if err != nil {
		return nil, fmt.Errorf("encoding legacy task progress trackers: %w", err)
	}

	var trackers []legacyTaskProgressTrackerCustom
	if err := json.Unmarshal(encoded, &trackers); err != nil {
		return nil, fmt.Errorf("decoding legacy task progress trackers: %w", err)
	}
	return trackers, nil
}

func legacyTaskProgressGoalCustom(tracker legacyTaskProgressTrackerCustom) int {
	if goal, ok := legacyTaskProgressIntCustom(tracker.Goal); ok {
		return goal
	}
	if goal, ok := legacyTaskProgressIntCustom(tracker.InitialValue); ok {
		return goal
	}
	return 0
}

func legacyTaskProgressIntCustom(value interface{}) (int, bool) {
	switch typed := value.(type) {
	case float64:
		if typed >= 0 && typed <= math.MaxInt && math.Trunc(typed) == typed {
			return int(typed), true
		}
	case string:
		parsed, err := strconv.Atoi(strings.TrimSpace(typed))
		if err == nil && parsed >= 0 {
			return parsed, true
		}
	}
	return 0, false
}

func (r *queryResolver) FindTaskProgressTrackers(ctx context.Context) (ret []*models.TaskProgressTracker, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.TaskProgressTracker.FindAll(ctx)
		return err
	}); err != nil {
		return nil, err
	}
	if len(ret) > 0 {
		return ret, nil
	}

	uiConfig := config.GetInstance().GetUIConfiguration()
	legacy, err := legacyTaskProgressTrackersCustom(uiConfig)
	if err != nil || len(legacy) == 0 {
		return ret, err
	}

	if err := r.withTxn(ctx, func(ctx context.Context) error {
		existing, err := r.repository.TaskProgressTracker.FindAll(ctx)
		if err != nil {
			return err
		}
		if len(existing) > 0 {
			ret = existing
			return nil
		}

		for position, stored := range legacy {
			tagID, err := strconv.Atoi(stored.TagID)
			if err != nil {
				return fmt.Errorf("converting legacy task progress tag id %q: %w", stored.TagID, err)
			}

			tag, err := r.repository.Tag.Find(ctx, tagID)
			if err != nil {
				return err
			}
			if tag == nil {
				logger.Warnf("Skipping legacy task progress tracker %q because tag %d no longer exists", stored.Title, tagID)
				continue
			}

			title := strings.TrimSpace(stored.Title)
			if title == "" {
				title = strings.TrimSpace(stored.Name)
			}
			if title == "" {
				title = tag.Name
			}

			tracker := models.TaskProgressTracker{
				Title:            title,
				Description:      strings.TrimSpace(stored.Description),
				Goal:             legacyTaskProgressGoalCustom(stored),
				TagID:            tagID,
				Position:         position,
				IsWorkingOn:      stored.IsWorkingOn,
				StartedOn:        taskProgressHistoryEpochCustom,
				HistoryStartedOn: taskProgressHistoryEpochCustom,
				Status:           models.TaskProgressTrackerStatusActive,
				ItemTypes:        append([]string(nil), models.TaskProgressItemTypes...),
			}
			tracker.Goal, err = r.repository.TaskProgressTracker.CountDirectlyTaggedItems(ctx, tagID, tracker.ItemTypes)
			if err != nil {
				return err
			}
			if err := r.repository.TaskProgressTracker.Create(ctx, &tracker); err != nil {
				return err
			}
			if err := r.repository.TaskProgressTracker.CreateBaseline(ctx, &tracker); err != nil {
				return err
			}
		}

		ret, err = r.repository.TaskProgressTracker.FindAll(ctx)
		return err
	}); err != nil {
		return nil, err
	}

	delete(uiConfig, taskProgressTrackersUIConfigKey)
	config.GetInstance().SetUIConfiguration(uiConfig)
	if err := config.GetInstance().Write(); err != nil {
		return nil, fmt.Errorf("removing imported task progress UI configuration: %w", err)
	}

	return ret, nil
}

func (r *mutationResolver) TaskProgressTrackerCreate(ctx context.Context, input TaskProgressTrackerCreateInput) (ret *models.TaskProgressTracker, err error) {
	title := strings.TrimSpace(input.Title)
	if title == "" {
		return nil, fmt.Errorf("%w: title must not be empty", ErrInput)
	}
	tagID, err := strconv.Atoi(input.TagID)
	if err != nil {
		return nil, fmt.Errorf("converting tag id: %w", err)
	}
	startedOn := ""
	if input.StartedOn != nil {
		startedOn, err = taskProgressStartedOnCustom(*input.StartedOn)
		if err != nil {
			return nil, err
		}
	}
	itemTypes, err := taskProgressItemTypesCustom(input.ItemTypes)
	if err != nil {
		return nil, err
	}
	tracker := &models.TaskProgressTracker{
		Title:       title,
		Description: strings.TrimSpace(input.Description),
		TagID:       tagID,
		StartedOn:   startedOn,
		Status:      models.TaskProgressTrackerStatusActive,
		IsWorkingOn: true,
		ItemTypes:   itemTypes,
		Mode:        "BACKLOG",
	}
	if input.Mode != nil {
		if *input.Mode != "FIXED" && *input.Mode != "BACKLOG" {
			return nil, fmt.Errorf("%w: mode must be FIXED or BACKLOG", ErrInput)
		}
		tracker.Mode = *input.Mode
	}
	if err := r.withTxn(ctx, func(ctx context.Context) error {
		tag, err := r.repository.Tag.Find(ctx, tagID)
		if err != nil {
			return err
		}
		if tag == nil {
			return fmt.Errorf("%w: tag %d not found", ErrInput, tagID)
		}

		tracker.Goal, err = r.repository.TaskProgressTracker.CountDirectlyTaggedItems(ctx, tagID, tracker.ItemTypes)
		if err != nil {
			return err
		}
		if err := r.repository.TaskProgressTracker.Create(ctx, tracker); err != nil {
			return err
		}
		if err := r.repository.TaskProgressTracker.CreateBaseline(ctx, tracker); err != nil {
			return err
		}
		ret, err = r.repository.TaskProgressTracker.Find(ctx, tracker.ID)
		return err
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

func (r *mutationResolver) TaskProgressTrackerUpdate(ctx context.Context, input TaskProgressTrackerUpdateInput) (ret *models.TaskProgressTracker, err error) {
	id, err := strconv.Atoi(input.ID)
	if err != nil {
		return nil, fmt.Errorf("converting task progress tracker id: %w", err)
	}

	if err := r.withTxn(ctx, func(ctx context.Context) error {
		tracker, err := r.repository.TaskProgressTracker.Find(ctx, id)
		if err != nil {
			return err
		}
		if tracker == nil {
			return fmt.Errorf("%w: task progress tracker %d not found", ErrInput, id)
		}
		if input.ExpectedVersion != nil && *input.ExpectedVersion != tracker.Version {
			return fmt.Errorf("%w: tracker changed in another window; refresh and try again", ErrInput)
		}
		previousStatus := tracker.Status

		if input.Title != nil {
			title := strings.TrimSpace(*input.Title)
			if title == "" {
				return fmt.Errorf("%w: title must not be empty", ErrInput)
			}
			tracker.Title = title
		}
		if input.Description != nil {
			tracker.Description = strings.TrimSpace(*input.Description)
		}
		if input.StartedOn != nil {
			startedOn, err := taskProgressStartedOnCustom(*input.StartedOn)
			if err != nil {
				return err
			}
			tracker.StartedOn = startedOn
		}

		tagChanged := false
		if input.TagID != nil {
			tagID, err := strconv.Atoi(*input.TagID)
			if err != nil {
				return fmt.Errorf("converting tag id: %w", err)
			}
			tag, err := r.repository.Tag.Find(ctx, tagID)
			if err != nil {
				return err
			}
			if tag == nil {
				return fmt.Errorf("%w: tag %d not found", ErrInput, tagID)
			}
			tagChanged = tracker.TagID != tagID
			tracker.TagID = tagID
		}
		if input.Status != nil {
			status, err := taskProgressStatusCustom(*input.Status)
			if err != nil {
				return err
			}
			tracker.Status = status
		}
		scopeChanged := false
		if input.Mode != nil {
			if *input.Mode != "FIXED" && *input.Mode != "BACKLOG" {
				return fmt.Errorf("%w: mode must be FIXED or BACKLOG", ErrInput)
			}
			scopeChanged = tracker.Mode != *input.Mode
			tracker.Mode = *input.Mode
		}
		if input.ItemTypes != nil {
			itemTypes, err := taskProgressItemTypesCustom(input.ItemTypes)
			if err != nil {
				return err
			}
			scopeChanged = scopeChanged || strings.Join(itemTypes, ",") != strings.Join(tracker.ItemTypes, ",")
			tracker.ItemTypes = itemTypes
		}

		resetGoal := input.ResetGoal != nil && *input.ResetGoal
		if input.Status != nil && previousStatus == "ARCHIVED" && tracker.Status != "ARCHIVED" {
			resetGoal = true
		}
		if tagChanged || scopeChanged || resetGoal {
			tracker.Goal, err = r.repository.TaskProgressTracker.CountDirectlyTaggedItems(ctx, tracker.TagID, tracker.ItemTypes)
			if err != nil {
				return err
			}
			tracker.StartedOn = models.TaskProgressReportingDate(time.Now())
			tracker.CurrentCount = tracker.Goal
		}
		if tracker.Status == models.TaskProgressTrackerStatusCompleted && tracker.CurrentCount > 0 {
			if input.Status != nil && previousStatus != models.TaskProgressTrackerStatusDeleted {
				return fmt.Errorf("%w: complete the remaining items before marking this tracker completed", ErrInput)
			}
			tracker.Status = models.TaskProgressTrackerStatusActive
		}
		tracker.IsWorkingOn = tracker.Status == models.TaskProgressTrackerStatusActive

		if err := r.repository.TaskProgressTracker.Update(ctx, tracker); err != nil {
			return err
		}
		if tagChanged || scopeChanged || resetGoal {
			if err := r.repository.TaskProgressTracker.CreateBaseline(ctx, tracker); err != nil {
				return err
			}
		}
		ret, err = r.repository.TaskProgressTracker.Find(ctx, id)
		return err
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

func (r *mutationResolver) TaskProgressTrackerDestroy(ctx context.Context, id string) (bool, error) {
	trackerID, err := strconv.Atoi(id)
	if err != nil {
		return false, fmt.Errorf("converting task progress tracker id: %w", err)
	}
	if err := r.withTxn(ctx, func(ctx context.Context) error {
		return r.repository.TaskProgressTracker.Delete(ctx, trackerID)
	}); err != nil {
		return false, err
	}
	return true, nil
}

func (r *mutationResolver) TaskProgressTrackersReorder(ctx context.Context, ids []string) (ret []*models.TaskProgressTracker, err error) {
	trackerIDs := make([]int, len(ids))
	requested := make(map[int]struct{}, len(ids))
	for index, value := range ids {
		id, err := strconv.Atoi(value)
		if err != nil {
			return nil, fmt.Errorf("converting task progress tracker id: %w", err)
		}
		if _, found := requested[id]; found {
			return nil, fmt.Errorf("%w: duplicate task progress tracker id %d", ErrInput, id)
		}
		requested[id] = struct{}{}
		trackerIDs[index] = id
	}

	if err := r.withTxn(ctx, func(ctx context.Context) error {
		existing, err := r.repository.TaskProgressTracker.FindAll(ctx)
		if err != nil {
			return err
		}
		if len(existing) != len(trackerIDs) {
			return fmt.Errorf("%w: reorder must include every task progress tracker", ErrInput)
		}
		for _, tracker := range existing {
			if _, found := requested[tracker.ID]; !found {
				return fmt.Errorf("%w: task progress tracker %d missing from reorder", ErrInput, tracker.ID)
			}
		}

		if err := r.repository.TaskProgressTracker.Reorder(ctx, trackerIDs); err != nil {
			return err
		}
		ret, err = r.repository.TaskProgressTracker.FindAll(ctx)
		return err
	}); err != nil {
		return nil, err
	}
	return ret, nil
}
