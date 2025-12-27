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

// CountByPerformerMarkerRole counts distinct scenes where a performer participates
// in markers with the given primary tag and optionally a specific role (top/bottom).
// If role is empty, counts all markers with that tag regardless of role.
func CountByPerformerMarkerRole(ctx context.Context, r models.SceneMarkerQueryer, performerID int, tagID int, role string) (int, error) {
	if tagID == 0 {
		return 0, nil
	}

	// Build filter for scene markers
	filter := &models.SceneMarkerFilterType{
		Tags: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(tagID)},
			Modifier: models.CriterionModifierIncludes,
		},
	}

	// Add marker performer filter with role
	topIDs := []string{}
	bottomIDs := []string{}
	performerIDStr := strconv.Itoa(performerID)

	if role == "top" {
		topIDs = append(topIDs, performerIDStr)
	} else if role == "bottom" {
		bottomIDs = append(bottomIDs, performerIDStr)
	} else {
		// Any role - check both
		topIDs = append(topIDs, performerIDStr)
		bottomIDs = append(bottomIDs, performerIDStr)
	}

	mode := "OR"
	filter.MarkerPerformers = &models.MarkerPerformersFilterInput{
		TopPerformerIDs:    topIDs,
		BottomPerformerIDs: bottomIDs,
		Mode:               &mode,
		Modifier:           models.CriterionModifierIncludes,
	}

	// Use PerPage=-1 to get all results, not just the default 25
	allResults := -1
	findFilter := &models.FindFilterType{PerPage: &allResults}

	// Query markers and count distinct scenes
	markers, _, err := r.Query(ctx, filter, findFilter)
	if err != nil {
		return 0, err
	}

	// Count distinct scenes
	sceneSet := make(map[int]bool)
	for _, m := range markers {
		sceneSet[m.SceneID] = true
	}

	return len(sceneSet), nil
}

// CountByPerformerMarkerRoleExcluding counts scenes where performer has markers with tagID
// but excludes scenes that also have markers with excludeTagID.
func CountByPerformerMarkerRoleExcluding(ctx context.Context, r models.SceneMarkerQueryer, performerID int, tagID int, role string, excludeTagID int) (int, error) {
	if tagID == 0 {
		return 0, nil
	}

	// Get scenes with the include tag
	includedScenes, err := getScenesByPerformerMarkerRole(ctx, r, performerID, tagID, role)
	if err != nil {
		return 0, err
	}

	if excludeTagID == 0 {
		return len(includedScenes), nil
	}

	// Get scenes with the exclude tag
	excludedScenes, err := getScenesByPerformerMarkerRole(ctx, r, performerID, excludeTagID, "")
	if err != nil {
		return 0, err
	}

	// Subtract excluded scenes
	count := 0
	for sceneID := range includedScenes {
		if !excludedScenes[sceneID] {
			count++
		}
	}

	return count, nil
}

// CountByPerformerMarkerRoleExcludingMultiple counts scenes where performer has markers with tagID
// but excludes scenes that also have markers with any of the excludeTagIDs.
func CountByPerformerMarkerRoleExcludingMultiple(ctx context.Context, r models.SceneMarkerQueryer, performerID int, tagID int, role string, excludeTagIDs []int) (int, error) {
	if tagID == 0 {
		return 0, nil
	}

	// Get scenes with the include tag
	includedScenes, err := getScenesByPerformerMarkerRole(ctx, r, performerID, tagID, role)
	if err != nil {
		return 0, err
	}

	// Build set of all excluded scenes
	excludedScenes := make(map[int]bool)
	for _, excludeTagID := range excludeTagIDs {
		if excludeTagID == 0 {
			continue
		}
		scenes, err := getScenesByPerformerMarkerRole(ctx, r, performerID, excludeTagID, "")
		if err != nil {
			return 0, err
		}
		for sceneID := range scenes {
			excludedScenes[sceneID] = true
		}
	}

	// Subtract excluded scenes
	count := 0
	for sceneID := range includedScenes {
		if !excludedScenes[sceneID] {
			count++
		}
	}

	return count, nil
}

// Helper function to get scene IDs for a performer's marker participation
func getScenesByPerformerMarkerRole(ctx context.Context, r models.SceneMarkerQueryer, performerID int, tagID int, role string) (map[int]bool, error) {
	if tagID == 0 {
		return make(map[int]bool), nil
	}

	filter := &models.SceneMarkerFilterType{
		Tags: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(tagID)},
			Modifier: models.CriterionModifierIncludes,
		},
	}

	topIDs := []string{}
	bottomIDs := []string{}
	performerIDStr := strconv.Itoa(performerID)

	if role == "top" {
		topIDs = append(topIDs, performerIDStr)
	} else if role == "bottom" {
		bottomIDs = append(bottomIDs, performerIDStr)
	} else {
		topIDs = append(topIDs, performerIDStr)
		bottomIDs = append(bottomIDs, performerIDStr)
	}

	mode := "OR"
	filter.MarkerPerformers = &models.MarkerPerformersFilterInput{
		TopPerformerIDs:    topIDs,
		BottomPerformerIDs: bottomIDs,
		Mode:               &mode,
		Modifier:           models.CriterionModifierIncludes,
	}

	// Use PerPage=-1 to get all results, not just the default 25
	allResults := -1
	findFilter := &models.FindFilterType{PerPage: &allResults}

	markers, _, err := r.Query(ctx, filter, findFilter)
	if err != nil {
		return nil, err
	}

	sceneSet := make(map[int]bool)
	for _, m := range markers {
		sceneSet[m.SceneID] = true
	}

	return sceneSet, nil
}

// GetPerformerMarkerRolesForScene returns the roles a performer has in a specific scene's markers.
// Returns array of strings like "sex_top", "sex_bottom", "oral_top", "oral_bottom",
// "facial_top", "facial_bottom", "solo" based on their participation in markers.
func GetPerformerMarkerRolesForScene(ctx context.Context, r models.SceneMarkerReader, performerID int, sceneID int, sexTagID int, oralTagID int, soloTagID int, facialTagID int) ([]string, error) {
	roles := []string{}

	// Query all markers for this scene using FindBySceneID
	markers, err := r.FindBySceneID(ctx, sceneID)
	if err != nil {
		return nil, err
	}

	if len(markers) == 0 {
		return roles, nil
	}

	// Helper to check if a tag ID matches any role tag and add the role
	addRoleForTag := func(tagID int, role string) {
		if tagID == sexTagID {
			if role == "top" {
				roles = appendIfNotExists(roles, "sex_top")
			} else if role == "bottom" {
				roles = appendIfNotExists(roles, "sex_bottom")
			}
		} else if tagID == oralTagID {
			if role == "top" {
				roles = appendIfNotExists(roles, "oral_top")
			} else if role == "bottom" {
				roles = appendIfNotExists(roles, "oral_bottom")
			}
		} else if tagID == soloTagID {
			roles = appendIfNotExists(roles, "solo")
		} else if tagID == facialTagID {
			if role == "top" {
				roles = appendIfNotExists(roles, "facial_top")
			} else if role == "bottom" {
				roles = appendIfNotExists(roles, "facial_bottom")
			}
		}
	}

	// Check each marker to see if this performer is top or bottom
	for _, marker := range markers {
		performers, err := r.GetPerformers(ctx, marker.ID)
		if err != nil {
			return nil, err
		}

		// Get secondary/additional tag IDs for this marker
		secondaryTagIDs, err := r.GetTagIDs(ctx, marker.ID)
		if err != nil {
			return nil, err
		}

		for _, perf := range performers {
			if perf.PerformerID != performerID {
				continue
			}

			role := perf.Role

			// Check primary tag first
			addRoleForTag(marker.PrimaryTagID, role)

			// Also check secondary/additional tags (e.g., facial as secondary tag on a sex marker)
			for _, tagID := range secondaryTagIDs {
				addRoleForTag(tagID, role)
			}
		}
	}

	return roles, nil
}

// Helper to append string if not already in slice
func appendIfNotExists(slice []string, s string) []string {
	for _, existing := range slice {
		if existing == s {
			return slice
		}
	}
	return append(slice, s)
}

// CountScenesWithMarkerTag counts distinct scenes that have markers with the given tag
func CountScenesWithMarkerTag(ctx context.Context, markerQB models.SceneMarkerQueryer, tagID int) (int, error) {
	if tagID == 0 {
		return 0, nil
	}

	filter := &models.SceneMarkerFilterType{
		Tags: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(tagID)},
			Modifier: models.CriterionModifierIncludes,
		},
	}

	// Use PerPage=-1 to get all results, not just the default 25
	allResults := -1
	findFilter := &models.FindFilterType{PerPage: &allResults}

	markers, _, err := markerQB.Query(ctx, filter, findFilter)
	if err != nil {
		return 0, err
	}

	sceneSet := make(map[int]bool)
	for _, m := range markers {
		sceneSet[m.SceneID] = true
	}

	return len(sceneSet), nil
}

// CountScenesWithMarkerTagExcluding counts distinct scenes that have markers with tagID but not excludeTagID
func CountScenesWithMarkerTagExcluding(ctx context.Context, markerQB models.SceneMarkerQueryer, tagID int, excludeTagID int) (int, error) {
	if tagID == 0 {
		return 0, nil
	}

	// Use PerPage=-1 to get all results, not just the default 25
	allResults := -1
	findFilter := &models.FindFilterType{PerPage: &allResults}

	// Get scenes with the include tag
	filter := &models.SceneMarkerFilterType{
		Tags: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(tagID)},
			Modifier: models.CriterionModifierIncludes,
		},
	}

	markers, _, err := markerQB.Query(ctx, filter, findFilter)
	if err != nil {
		return 0, err
	}

	includeScenes := make(map[int]bool)
	for _, m := range markers {
		includeScenes[m.SceneID] = true
	}

	if excludeTagID == 0 {
		return len(includeScenes), nil
	}

	// Get scenes with the exclude tag
	excludeFilter := &models.SceneMarkerFilterType{
		Tags: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(excludeTagID)},
			Modifier: models.CriterionModifierIncludes,
		},
	}

	excludeMarkers, _, err := markerQB.Query(ctx, excludeFilter, findFilter)
	if err != nil {
		return 0, err
	}

	excludeScenes := make(map[int]bool)
	for _, m := range excludeMarkers {
		excludeScenes[m.SceneID] = true
	}

	// Count scenes that have include tag but not exclude tag
	count := 0
	for sceneID := range includeScenes {
		if !excludeScenes[sceneID] {
			count++
		}
	}

	return count, nil
}

// CountScenesWithMarkerTagExcludingMultiple counts scenes with tagID but none of excludeTagIDs
func CountScenesWithMarkerTagExcludingMultiple(ctx context.Context, markerQB models.SceneMarkerQueryer, tagID int, excludeTagIDs []int) (int, error) {
	if tagID == 0 {
		return 0, nil
	}

	// Use PerPage=-1 to get all results, not just the default 25
	allResults := -1
	findFilter := &models.FindFilterType{PerPage: &allResults}

	// Get scenes with the include tag
	filter := &models.SceneMarkerFilterType{
		Tags: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(tagID)},
			Modifier: models.CriterionModifierIncludes,
		},
	}

	markers, _, err := markerQB.Query(ctx, filter, findFilter)
	if err != nil {
		return 0, err
	}

	includeScenes := make(map[int]bool)
	for _, m := range markers {
		includeScenes[m.SceneID] = true
	}

	if len(excludeTagIDs) == 0 {
		return len(includeScenes), nil
	}

	// Get scenes with any of the exclude tags
	excludeScenes := make(map[int]bool)
	for _, excludeTagID := range excludeTagIDs {
		if excludeTagID == 0 {
			continue
		}
		excludeFilter := &models.SceneMarkerFilterType{
			Tags: &models.HierarchicalMultiCriterionInput{
				Value:    []string{strconv.Itoa(excludeTagID)},
				Modifier: models.CriterionModifierIncludes,
			},
		}

		excludeMarkers, _, err := markerQB.Query(ctx, excludeFilter, findFilter)
		if err != nil {
			return 0, err
		}

		for _, m := range excludeMarkers {
			excludeScenes[m.SceneID] = true
		}
	}

	// Count scenes that have include tag but none of exclude tags
	count := 0
	for sceneID := range includeScenes {
		if !excludeScenes[sceneID] {
			count++
		}
	}

	return count, nil
}

// CountByStudioMarkerRole counts distinct scenes for a studio with markers having the given tag
func CountByStudioMarkerRole(ctx context.Context, markerQB models.SceneMarkerQueryer, sceneQB models.SceneQueryer, studioID int, depth *int, tagID int, role string, performerID *int) (int, error) {
	if tagID == 0 {
		return 0, nil
	}

	// Get all scenes for this studio (with depth)
	studioScenes, err := getStudioSceneIDs(ctx, sceneQB, studioID, depth, performerID)
	if err != nil {
		return 0, err
	}

	if len(studioScenes) == 0 {
		return 0, nil
	}

	// Build filter for markers with the tag
	filter := &models.SceneMarkerFilterType{
		Tags: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(tagID)},
			Modifier: models.CriterionModifierIncludes,
		},
	}

	// Add performer filter if specified
	if performerID != nil {
		topIDs := []string{}
		bottomIDs := []string{}
		performerIDStr := strconv.Itoa(*performerID)

		if role == "top" {
			topIDs = append(topIDs, performerIDStr)
		} else if role == "bottom" {
			bottomIDs = append(bottomIDs, performerIDStr)
		} else {
			topIDs = append(topIDs, performerIDStr)
			bottomIDs = append(bottomIDs, performerIDStr)
		}

		mode := "OR"
		filter.MarkerPerformers = &models.MarkerPerformersFilterInput{
			TopPerformerIDs:    topIDs,
			BottomPerformerIDs: bottomIDs,
			Mode:               &mode,
			Modifier:           models.CriterionModifierIncludes,
		}
	}

	// Use PerPage=-1 to get all results, not just the default 25
	allResults := -1
	findFilter := &models.FindFilterType{PerPage: &allResults}

	markers, _, err := markerQB.Query(ctx, filter, findFilter)
	if err != nil {
		return 0, err
	}

	// Count markers that belong to studio scenes
	count := 0
	for _, m := range markers {
		if studioScenes[m.SceneID] {
			count++
			studioScenes[m.SceneID] = false // Count each scene only once
		}
	}

	return count, nil
}

// CountByStudioMarkerRoleExcluding counts studio scenes with markers having tagID but not excludeTagID
func CountByStudioMarkerRoleExcluding(ctx context.Context, markerQB models.SceneMarkerQueryer, sceneQB models.SceneQueryer, studioID int, depth *int, tagID int, role string, excludeTagID int, performerID *int) (int, error) {
	if tagID == 0 {
		return 0, nil
	}

	studioScenes, err := getStudioSceneIDs(ctx, sceneQB, studioID, depth, performerID)
	if err != nil {
		return 0, err
	}

	if len(studioScenes) == 0 {
		return 0, nil
	}

	// Get scenes with include tag
	includedScenes, err := getStudioScenesWithMarkerTag(ctx, markerQB, studioScenes, tagID, role, performerID)
	if err != nil {
		return 0, err
	}

	if excludeTagID == 0 {
		return len(includedScenes), nil
	}

	// Get scenes with exclude tag
	excludedScenes, err := getStudioScenesWithMarkerTag(ctx, markerQB, studioScenes, excludeTagID, "", performerID)
	if err != nil {
		return 0, err
	}

	// Subtract excluded
	count := 0
	for sceneID := range includedScenes {
		if !excludedScenes[sceneID] {
			count++
		}
	}

	return count, nil
}

// CountByStudioMarkerRoleExcludingMultiple counts studio scenes with markers having tagID but none of excludeTagIDs
func CountByStudioMarkerRoleExcludingMultiple(ctx context.Context, markerQB models.SceneMarkerQueryer, sceneQB models.SceneQueryer, studioID int, depth *int, tagID int, role string, excludeTagIDs []int, performerID *int) (int, error) {
	if tagID == 0 {
		return 0, nil
	}

	studioScenes, err := getStudioSceneIDs(ctx, sceneQB, studioID, depth, performerID)
	if err != nil {
		return 0, err
	}

	if len(studioScenes) == 0 {
		return 0, nil
	}

	// Get scenes with include tag
	includedScenes, err := getStudioScenesWithMarkerTag(ctx, markerQB, studioScenes, tagID, role, performerID)
	if err != nil {
		return 0, err
	}

	// Build set of all excluded scenes
	excludedScenes := make(map[int]bool)
	for _, excludeTagID := range excludeTagIDs {
		if excludeTagID == 0 {
			continue
		}
		scenes, err := getStudioScenesWithMarkerTag(ctx, markerQB, studioScenes, excludeTagID, "", performerID)
		if err != nil {
			return 0, err
		}
		for sceneID := range scenes {
			excludedScenes[sceneID] = true
		}
	}

	// Subtract excluded
	count := 0
	for sceneID := range includedScenes {
		if !excludedScenes[sceneID] {
			count++
		}
	}

	return count, nil
}

// Helper to get studio scene IDs
func getStudioSceneIDs(ctx context.Context, sceneQB models.SceneQueryer, studioID int, depth *int, performerID *int) (map[int]bool, error) {
	filter := &models.SceneFilterType{
		Studios: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(studioID)},
			Modifier: models.CriterionModifierIncludes,
			Depth:    depth,
		},
	}

	if performerID != nil {
		filter.Performers = &models.MultiCriterionInput{
			Value:    []string{strconv.Itoa(*performerID)},
			Modifier: models.CriterionModifierIncludes,
		}
	}

	// Use PerPage=-1 to fetch all studio scenes (avoid default pagination of 25)
	allResults := -1
	findFilter := &models.FindFilterType{PerPage: &allResults}

	result, err := sceneQB.Query(ctx, models.SceneQueryOptions{
		QueryOptions: models.QueryOptions{
			FindFilter: findFilter,
			Count:      false,
		},
		SceneFilter: filter,
	})
	if err != nil {
		return nil, err
	}

	scenes, err := result.Resolve(ctx)
	if err != nil {
		return nil, err
	}

	sceneSet := make(map[int]bool)
	for _, s := range scenes {
		sceneSet[s.ID] = true
	}

	return sceneSet, nil
}

// Helper to get scenes with a marker tag
func getStudioScenesWithMarkerTag(ctx context.Context, markerQB models.SceneMarkerQueryer, studioScenes map[int]bool, tagID int, role string, performerID *int) (map[int]bool, error) {
	filter := &models.SceneMarkerFilterType{
		Tags: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(tagID)},
			Modifier: models.CriterionModifierIncludes,
		},
	}

	if performerID != nil {
		topIDs := []string{}
		bottomIDs := []string{}
		performerIDStr := strconv.Itoa(*performerID)

		if role == "top" {
			topIDs = append(topIDs, performerIDStr)
		} else if role == "bottom" {
			bottomIDs = append(bottomIDs, performerIDStr)
		} else {
			topIDs = append(topIDs, performerIDStr)
			bottomIDs = append(bottomIDs, performerIDStr)
		}

		mode := "OR"
		filter.MarkerPerformers = &models.MarkerPerformersFilterInput{
			TopPerformerIDs:    topIDs,
			BottomPerformerIDs: bottomIDs,
			Mode:               &mode,
			Modifier:           models.CriterionModifierIncludes,
		}
	}

	// Use PerPage=-1 to get all results, not just the default 25
	allResults := -1
	findFilter := &models.FindFilterType{PerPage: &allResults}

	markers, _, err := markerQB.Query(ctx, filter, findFilter)
	if err != nil {
		return nil, err
	}

	sceneSet := make(map[int]bool)
	for _, m := range markers {
		if studioScenes[m.SceneID] {
			sceneSet[m.SceneID] = true
		}
	}

	return sceneSet, nil
}
