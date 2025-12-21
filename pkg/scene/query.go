package scene

import (
	"context"
	"fmt"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/stashapp/stash/pkg/job"
	"github.com/stashapp/stash/pkg/models"
)

// QueryOptions returns a SceneQueryOptions populated with the provided filters.
func QueryOptions(sceneFilter *models.SceneFilterType, findFilter *models.FindFilterType, count bool) models.SceneQueryOptions {
	return models.SceneQueryOptions{
		QueryOptions: models.QueryOptions{
			FindFilter: findFilter,
			Count:      count,
		},
		SceneFilter: sceneFilter,
	}
}

// QueryWithCount queries for scenes, returning the scene objects and the total count.
func QueryWithCount(ctx context.Context, qb models.SceneQueryer, sceneFilter *models.SceneFilterType, findFilter *models.FindFilterType) ([]*models.Scene, int, error) {
	// this was moved from the queryBuilder code
	// left here so that calling functions can reference this instead
	result, err := qb.Query(ctx, QueryOptions(sceneFilter, findFilter, true))
	if err != nil {
		return nil, 0, err
	}

	scenes, err := result.Resolve(ctx)
	if err != nil {
		return nil, 0, err
	}

	return scenes, result.Count, nil
}

// Query queries for scenes using the provided filters.
func Query(ctx context.Context, qb models.SceneQueryer, sceneFilter *models.SceneFilterType, findFilter *models.FindFilterType) ([]*models.Scene, error) {
	result, err := qb.Query(ctx, QueryOptions(sceneFilter, findFilter, false))
	if err != nil {
		return nil, err
	}

	scenes, err := result.Resolve(ctx)
	if err != nil {
		return nil, err
	}

	return scenes, nil
}

func BatchProcess(ctx context.Context, reader models.SceneQueryer, sceneFilter *models.SceneFilterType, findFilter *models.FindFilterType, fn func(scene *models.Scene) error) error {
	const batchSize = 1000

	if findFilter == nil {
		findFilter = &models.FindFilterType{}
	}

	page := 1
	perPage := batchSize
	findFilter.Page = &page
	findFilter.PerPage = &perPage

	for more := true; more; {
		if job.IsCancelled(ctx) {
			return nil
		}

		scenes, err := Query(ctx, reader, sceneFilter, findFilter)
		if err != nil {
			return fmt.Errorf("error querying for scenes: %w", err)
		}

		for _, scene := range scenes {
			if err := fn(scene); err != nil {
				return err
			}
		}

		if len(scenes) != batchSize {
			more = false
		} else {
			*findFilter.Page++
		}
	}

	return nil
}

// FilterFromPaths creates a SceneFilterType that filters using the provided
// paths.
func FilterFromPaths(paths []string) *models.SceneFilterType {
	ret := &models.SceneFilterType{}
	or := ret
	sep := string(filepath.Separator)

	for _, p := range paths {
		if !strings.HasSuffix(p, sep) {
			p += sep
		}

		if ret.Path == nil {
			or = ret
		} else {
			newOr := &models.SceneFilterType{}
			or.Or = newOr
			or = newOr
		}

		or.Path = &models.StringCriterionInput{
			Modifier: models.CriterionModifierEquals,
			Value:    p + "%",
		}
	}

	return ret
}

func CountByStudioID(ctx context.Context, r models.SceneQueryer, id int, depth *int, performerID *string) (int, error) {
	filter := &models.SceneFilterType{
		Studios: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(id)},
			Modifier: models.CriterionModifierIncludes,
			Depth:    depth,
		},
	}

	// Add performer filter if specified
	if performerID != nil && *performerID != "" {
		filter.Performers = &models.MultiCriterionInput{
			Value:    []string{*performerID},
			Modifier: models.CriterionModifierIncludes,
		}
	}

	return r.QueryCount(ctx, filter, nil)
}

func CountByTagID(ctx context.Context, r models.SceneQueryer, id int, depth *int) (int, error) {
	filter := &models.SceneFilterType{
		Tags: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(id)},
			Modifier: models.CriterionModifierIncludes,
			Depth:    depth,
		},
	}

	return r.QueryCount(ctx, filter, nil)
}

// CountByTagIDAndPerformerID returns the number of scenes that have the given
// tag and include the given performer. Depth applies to the tag hierarchy.
func CountByTagIDAndPerformerID(ctx context.Context, r models.SceneQueryer, tagID int, performerID int, depth *int) (int, error) {
	filter := &models.SceneFilterType{
		Tags: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(tagID)},
			Modifier: models.CriterionModifierIncludes,
			Depth:    depth,
		},
		Performers: &models.MultiCriterionInput{
			Value:    []string{strconv.Itoa(performerID)},
			Modifier: models.CriterionModifierIncludes,
		},
	}

	return r.QueryCount(ctx, filter, nil)
}

func CountByGroupID(ctx context.Context, r models.SceneQueryer, id int, depth *int) (int, error) {
	filter := &models.SceneFilterType{
		Groups: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(id)},
			Modifier: models.CriterionModifierIncludes,
			Depth:    depth,
		},
	}

	return r.QueryCount(ctx, filter, nil)
}

// CountByStudioIDAndPerformerSceneTags counts scenes for a studio that have any of the specified performer_scene_tags
func CountByStudioIDAndPerformerSceneTags(ctx context.Context, r models.SceneQueryer, tagReader models.TagReader, studioID int, depth *int, tagNames []string, matchAll bool, performerID *string) (int, error) {
	// Get all tags to map names to IDs
	tags, err := tagReader.All(ctx)
	if err != nil {
		return 0, err
	}

	tagIDs := []string{}
	for _, tag := range tags {
		for _, name := range tagNames {
			if strings.EqualFold(tag.Name, name) {
				tagIDs = append(tagIDs, strconv.Itoa(tag.ID))
				break
			}
		}
	}

	if len(tagIDs) == 0 {
		return 0, nil
	}

	modifier := models.CriterionModifierIncludes
	if matchAll {
		modifier = models.CriterionModifierIncludesAll
	}

	filter := &models.SceneFilterType{
		Studios: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(studioID)},
			Modifier: models.CriterionModifierIncludes,
			Depth:    depth,
		},
		PerformerSceneTags: &models.HierarchicalMultiCriterionInput{
			Value:    tagIDs,
			Modifier: modifier,
		},
	}

	// Add performer filter if specified
	if performerID != nil && *performerID != "" {
		filter.Performers = &models.MultiCriterionInput{
			Value:    []string{*performerID},
			Modifier: models.CriterionModifierIncludes,
		}
	}

	return r.QueryCount(ctx, filter, nil)
}

// CountByStudioIDAndPerformerSceneTagsWithExclusions counts scenes for a studio that have
// any of the included tags but none of the excluded tags in performer_scene_tags
func CountByStudioIDAndPerformerSceneTagsWithExclusions(ctx context.Context, r models.SceneQueryer, tagReader models.TagReader, studioID int, depth *int, includeTagNames []string, excludeTagNames []string, performerID *string) (int, error) {
	// Get all tags
	tags, err := tagReader.All(ctx)
	if err != nil {
		return 0, err
	}

	// Map tag names to IDs (case-insensitive)
	includeTagIDs := []string{}
	excludeTagIDs := []string{}

	for _, tag := range tags {
		for _, name := range includeTagNames {
			if strings.EqualFold(tag.Name, name) {
				includeTagIDs = append(includeTagIDs, strconv.Itoa(tag.ID))
				break
			}
		}
		for _, name := range excludeTagNames {
			if strings.EqualFold(tag.Name, name) {
				excludeTagIDs = append(excludeTagIDs, strconv.Itoa(tag.ID))
				break
			}
		}
	}

	if len(includeTagIDs) == 0 {
		return 0, nil
	}

	filter := &models.SceneFilterType{
		Studios: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(studioID)},
			Modifier: models.CriterionModifierIncludes,
			Depth:    depth,
		},
		PerformerSceneTags: &models.HierarchicalMultiCriterionInput{
			Value:    includeTagIDs,
			Modifier: models.CriterionModifierIncludes,
			Excludes: excludeTagIDs,
		},
	}

	// Add performer filter if specified
	if performerID != nil && *performerID != "" {
		filter.Performers = &models.MultiCriterionInput{
			Value:    []string{*performerID},
			Modifier: models.CriterionModifierIncludes,
		}
	}

	return r.QueryCount(ctx, filter, nil)
}

// CountByPerformerSceneTags counts all scenes that have any of the specified performer_scene_tags
func CountByPerformerSceneTags(ctx context.Context, r models.SceneQueryer, tagReader models.TagReader, tagNames []string, matchAll bool) (int, error) {
	// Get all tags from database
	allTags, err := tagReader.All(ctx)
	if err != nil {
		return 0, err
	}

	// Build list of tag IDs matching the provided names (case-insensitive)
	var tagIDs []string
	for _, tag := range allTags {
		for _, name := range tagNames {
			if strings.EqualFold(tag.Name, name) {
				tagIDs = append(tagIDs, strconv.Itoa(tag.ID))
				break
			}
		}
	}

	if len(tagIDs) == 0 {
		return 0, nil
	}

	modifier := models.CriterionModifierIncludes
	if matchAll {
		modifier = models.CriterionModifierIncludesAll
	}

	filter := &models.SceneFilterType{
		PerformerSceneTags: &models.HierarchicalMultiCriterionInput{
			Value:    tagIDs,
			Modifier: modifier,
		},
	}

	return r.QueryCount(ctx, filter, nil)
}

// CountByPerformerSceneTagsWithExclusions counts all scenes that have the include tags but not the exclude tags
func CountByPerformerSceneTagsWithExclusions(ctx context.Context, r models.SceneQueryer, tagReader models.TagReader, includeTagNames []string, excludeTagNames []string) (int, error) {
	// Get all tags from database
	allTags, err := tagReader.All(ctx)
	if err != nil {
		return 0, err
	}

	// Build lists of tag IDs
	var includeTagIDs []string
	var excludeTagIDs []string
	for _, tag := range allTags {
		for _, name := range includeTagNames {
			if strings.EqualFold(tag.Name, name) {
				includeTagIDs = append(includeTagIDs, strconv.Itoa(tag.ID))
				break
			}
		}
		for _, name := range excludeTagNames {
			if strings.EqualFold(tag.Name, name) {
				excludeTagIDs = append(excludeTagIDs, strconv.Itoa(tag.ID))
				break
			}
		}
	}

	if len(includeTagIDs) == 0 {
		return 0, nil
	}

	filter := &models.SceneFilterType{
		PerformerSceneTags: &models.HierarchicalMultiCriterionInput{
			Value:    includeTagIDs,
			Modifier: models.CriterionModifierIncludes,
			Excludes: excludeTagIDs,
		},
	}

	return r.QueryCount(ctx, filter, nil)
}

// CountByPerformerIDAndPerformerSceneTags counts scenes for a performer that have any of the specified performer_scene_tags
func CountByPerformerIDAndPerformerSceneTags(ctx context.Context, r models.SceneQueryer, tagReader models.TagReader, performerID int, tagNames []string, matchAll bool) (int, error) {
	// Get all tags to map names to IDs
	tags, err := tagReader.All(ctx)
	if err != nil {
		return 0, err
	}

	tagIDs := []string{}
	for _, tag := range tags {
		for _, name := range tagNames {
			if strings.EqualFold(tag.Name, name) {
				tagIDs = append(tagIDs, strconv.Itoa(tag.ID))
				break
			}
		}
	}

	if len(tagIDs) == 0 {
		return 0, nil
	}

	modifier := models.CriterionModifierIncludes
	if matchAll {
		modifier = models.CriterionModifierIncludesAll
	}

	filter := &models.SceneFilterType{
		Performers: &models.MultiCriterionInput{
			Value:    []string{strconv.Itoa(performerID)},
			Modifier: models.CriterionModifierIncludes,
		},
		PerformerSceneTags: &models.HierarchicalMultiCriterionInput{
			Value:    tagIDs,
			Modifier: modifier,
		},
	}

	return r.QueryCount(ctx, filter, nil)
}

// CountByPerformerIDAndPerformerSceneTagsWithExclusions counts scenes for a performer that have
// any of the included tags but none of the excluded tags in performer_scene_tags
func CountByPerformerIDAndPerformerSceneTagsWithExclusions(ctx context.Context, r models.SceneQueryer, tagReader models.TagReader, performerID int, includeTagNames []string, excludeTagNames []string) (int, error) {
	// Get all tags
	tags, err := tagReader.All(ctx)
	if err != nil {
		return 0, err
	}

	// Map tag names to IDs (case-insensitive)
	includeTagIDs := []string{}
	excludeTagIDs := []string{}

	for _, tag := range tags {
		for _, name := range includeTagNames {
			if strings.EqualFold(tag.Name, name) {
				includeTagIDs = append(includeTagIDs, strconv.Itoa(tag.ID))
				break
			}
		}
		for _, name := range excludeTagNames {
			if strings.EqualFold(tag.Name, name) {
				excludeTagIDs = append(excludeTagIDs, strconv.Itoa(tag.ID))
				break
			}
		}
	}

	if len(includeTagIDs) == 0 {
		return 0, nil
	}

	filter := &models.SceneFilterType{
		Performers: &models.MultiCriterionInput{
			Value:    []string{strconv.Itoa(performerID)},
			Modifier: models.CriterionModifierIncludes,
		},
		PerformerSceneTags: &models.HierarchicalMultiCriterionInput{
			Value:    includeTagIDs,
			Modifier: models.CriterionModifierIncludes,
			Excludes: excludeTagIDs,
		},
	}

	return r.QueryCount(ctx, filter, nil)
}
