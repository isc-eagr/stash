package scene

import (
	"context"
	"fmt"
	"strconv"

	"github.com/stashapp/stash/pkg/models"
)

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

// CountScenesByPerformerMarkerRole counts distinct scenes where a performer participates
// in markers with the given primary tag (including subtags) and optionally a specific role (top/bottom).
// If role is empty, counts all markers with that tag regardless of role.
func CountScenesByPerformerMarkerRole(ctx context.Context, r models.SceneMarkerQueryer, performerID int, tagID int, role string) (int, error) {
	if tagID == 0 {
		return 0, nil
	}

	// Build filter for scene markers with recursive tag matching
	allDepth := -1 // Include all subtags recursively
	filter := &models.SceneMarkerFilterType{
		Tags: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(tagID)},
			Modifier: models.CriterionModifierIncludes,
			Depth:    &allDepth,
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

	group := models.SceneMarkerTagGroupInput{
		TopPerformerIDs:    topIDs,
		BottomPerformerIDs: bottomIDs,
	}
	performerMode := "OR"
	group.PerformerMode = &performerMode
	filter.SceneMarkerTags = &models.SceneMarkerTagsCriterionInput{
		Modifier:       models.CriterionModifierEquals,
		GroupsExtended: []models.SceneMarkerTagGroupInput{group},
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

// CountMarkersByPerformerRole counts the actual number of markers (not scenes)
// where a performer participates with the given tag and role.
func CountMarkersByPerformerRole(ctx context.Context, r models.SceneMarkerQueryer, performerID int, tagID int, role string) (int, error) {
	if tagID == 0 {
		return 0, nil
	}

	// Build filter for scene markers with recursive tag matching
	allDepth := -1 // Include all subtags recursively
	filter := &models.SceneMarkerFilterType{
		Tags: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(tagID)},
			Modifier: models.CriterionModifierIncludes,
			Depth:    &allDepth,
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

	group := models.SceneMarkerTagGroupInput{
		TopPerformerIDs:    topIDs,
		BottomPerformerIDs: bottomIDs,
	}
	performerMode := "OR"
	group.PerformerMode = &performerMode
	filter.SceneMarkerTags = &models.SceneMarkerTagsCriterionInput{
		Modifier:       models.CriterionModifierEquals,
		GroupsExtended: []models.SceneMarkerTagGroupInput{group},
	}

	// Use PerPage=-1 to get all results
	allResults := -1
	findFilter := &models.FindFilterType{PerPage: &allResults}

	// Query markers and return the count
	markers, _, err := r.Query(ctx, filter, findFilter)
	if err != nil {
		return 0, err
	}

	return len(markers), nil
}

// CountMarkersByPerformerRoleWithSecondary counts markers where performer has role and the marker
// has the tagID in either primary or secondary tags (including subtags).
// Optional excludeTagIDs will exclude markers that have any of those tags (or descendants) as secondary tags.
func CountMarkersByPerformerRoleWithSecondary(ctx context.Context, r models.SceneMarkerReader, tagFinder models.TagFinder, performerID int, tagID int, role string, excludeTagIDs ...int) (int, error) {
	if tagID == 0 {
		return 0, nil
	}

	// Build filter for markers where performer has the role (no tag filter yet)
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

	group := models.SceneMarkerTagGroupInput{
		TopPerformerIDs:    topIDs,
		BottomPerformerIDs: bottomIDs,
	}
	performerMode := "OR"
	group.PerformerMode = &performerMode
	filter := &models.SceneMarkerFilterType{
		SceneMarkerTags: &models.SceneMarkerTagsCriterionInput{
			Modifier:       models.CriterionModifierEquals,
			GroupsExtended: []models.SceneMarkerTagGroupInput{group},
		},
	}

	// Use PerPage=-1 to get all results
	allResults := -1
	findFilter := &models.FindFilterType{PerPage: &allResults}

	// Query markers
	markers, _, err := r.Query(ctx, filter, findFilter)
	if err != nil {
		return 0, err
	}

	// Build tag set including all descendants
	tagSet := make(map[int]bool)
	tagSet[tagID] = true
	descendants, err := tagFinder.FindAllDescendants(ctx, tagID, nil)
	if err != nil {
		return 0, err
	}
	for _, d := range descendants {
		tagSet[d.ID] = true
	}

	// Build exclude tag set if excludeTagIDs are provided
	excludeTagSet := make(map[int]bool)
	for _, excludeTagID := range excludeTagIDs {
		if excludeTagID == 0 {
			continue
		}
		excludeTagSet[excludeTagID] = true
		excludeDescendants, err := tagFinder.FindAllDescendants(ctx, excludeTagID, nil)
		if err != nil {
			return 0, err
		}
		for _, d := range excludeDescendants {
			excludeTagSet[d.ID] = true
		}
	}

	// Now filter markers to only include those with tagID in primary OR secondary tags
	// Also exclude markers that have any exclude tag in their secondary tags
	count := 0
	for _, marker := range markers {
		matched := false
		// Check primary tag
		if tagSet[marker.PrimaryTagID] {
			matched = true
		}

		// Check secondary tags for match and exclusion
		secondaryTagIDs, err := r.GetTagIDs(ctx, marker.ID)
		if err != nil {
			return 0, err
		}

		if !matched {
			for _, secondaryTagID := range secondaryTagIDs {
				if tagSet[secondaryTagID] {
					matched = true
					break
				}
			}
		}

		if !matched {
			continue
		}

		// Check if marker should be excluded (has 2nd camera tag or similar)
		if len(excludeTagSet) > 0 {
			excluded := false
			// Check if primary tag is in exclude set
			if excludeTagSet[marker.PrimaryTagID] {
				excluded = true
			}
			if !excluded {
				for _, secondaryTagID := range secondaryTagIDs {
					if excludeTagSet[secondaryTagID] {
						excluded = true
						break
					}
				}
			}
			if excluded {
				continue
			}
		}

		count++
	}

	return count, nil
}

// CountScenesByPerformerMarkerRoleExcluding counts scenes where performer has markers with tagID
// but excludes scenes that also have markers with excludeTagID.
func CountScenesByPerformerMarkerRoleExcluding(ctx context.Context, r models.SceneMarkerQueryer, performerID int, tagID int, role string, excludeTagID int) (int, error) {
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

// CountScenesByPerformerMarkerRoleExcludingMultiple counts scenes where performer has markers with tagID
// but excludes scenes that also have markers with any of the excludeTagIDs.
func CountScenesByPerformerMarkerRoleExcludingMultiple(ctx context.Context, r models.SceneMarkerQueryer, performerID int, tagID int, role string, excludeTagIDs []int) (int, error) {
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

// getScenesByPerformerMarkerRole is a helper function to get scene IDs for a performer's marker participation
func getScenesByPerformerMarkerRole(ctx context.Context, r models.SceneMarkerQueryer, performerID int, tagID int, role string) (map[int]bool, error) {
	if tagID == 0 {
		return make(map[int]bool), nil
	}

	allDepth := -1 // Include all subtags recursively
	filter := &models.SceneMarkerFilterType{
		Tags: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(tagID)},
			Modifier: models.CriterionModifierIncludes,
			Depth:    &allDepth,
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

	group := models.SceneMarkerTagGroupInput{
		TopPerformerIDs:    topIDs,
		BottomPerformerIDs: bottomIDs,
	}
	performerMode := "OR"
	group.PerformerMode = &performerMode
	filter.SceneMarkerTags = &models.SceneMarkerTagsCriterionInput{
		Modifier:       models.CriterionModifierEquals,
		GroupsExtended: []models.SceneMarkerTagGroupInput{group},
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
// "facial_top_X", "facial_bottom_X" (with counts), "facial_unique_X" (unique markers),
// "sex_top_partners_X", "sex_bottom_partners_X" (unique partners per role),
// "oral_top_partners_X", "oral_bottom_partners_X" (unique partners per role),
// "facial_top_partners_X", "facial_bottom_partners_X" (unique partners per role),
// "orgasm_top_X", "feet_top_X", "solo" based on their participation in markers.
// Uses TagFinder to check if marker tags are descendants of the configured role tags.
//
// Note: facial_unique_X represents the actual number of distinct facial markers,
// preventing double-counting when a performer is both top and bottom in the same marker.
// Partner counts represent unique performers (by ID) with opposite role in the same markers.
func GetPerformerMarkerRolesForScene(ctx context.Context, r models.SceneMarkerReader, tagFinder models.TagFinder, performerID int, sceneID int, sexTagID int, oralTagID int, soloTagID int, facialTagID int, orgasmTagID int, feetTagID int, secondCameraTagID int) ([]string, error) {
	roles := []string{}

	// Query all markers for this scene using FindBySceneID
	markers, err := r.FindBySceneID(ctx, sceneID)
	if err != nil {
		return nil, err
	}

	if len(markers) == 0 {
		return roles, nil
	}

	// Build sets of all descendant tag IDs for each role tag (for subtag matching)
	sexTagSet := make(map[int]bool)
	oralTagSet := make(map[int]bool)
	soloTagSet := make(map[int]bool)
	facialTagSet := make(map[int]bool)
	orgasmTagSet := make(map[int]bool)
	feetTagSet := make(map[int]bool)
	secondCameraTagSet := make(map[int]bool)

	// Helper to build descendant set
	buildDescendantSet := func(tagID int, tagSet map[int]bool) error {
		if tagID == 0 {
			return nil
		}
		tagSet[tagID] = true
		descendants, err := tagFinder.FindAllDescendants(ctx, tagID, nil)
		if err != nil {
			return err
		}
		for _, d := range descendants {
			tagSet[d.ID] = true
		}
		return nil
	}

	// Build all descendant sets
	if err := buildDescendantSet(sexTagID, sexTagSet); err != nil {
		return nil, err
	}
	if err := buildDescendantSet(oralTagID, oralTagSet); err != nil {
		return nil, err
	}
	if err := buildDescendantSet(soloTagID, soloTagSet); err != nil {
		return nil, err
	}
	if err := buildDescendantSet(facialTagID, facialTagSet); err != nil {
		return nil, err
	}
	if err := buildDescendantSet(orgasmTagID, orgasmTagSet); err != nil {
		return nil, err
	}
	if err := buildDescendantSet(feetTagID, feetTagSet); err != nil {
		return nil, err
	}
	if err := buildDescendantSet(secondCameraTagID, secondCameraTagSet); err != nil {
		return nil, err
	}

	// Track orgasm, feet, and facial marker counts for this performer (we need count, not just presence)
	orgasmTopCount := 0
	feetTopCount := 0
	facialTopCount := 0
	facialBottomCount := 0

	// Track unique facial marker IDs to avoid double-counting when performer is both top and bottom
	facialMarkerIDs := make(map[int]bool)

	// Track unique partner IDs for each role category (for scene-specific partner counts)
	sexTopPartnerIDs := make(map[int]bool)
	sexBottomPartnerIDs := make(map[int]bool)
	oralTopPartnerIDs := make(map[int]bool)
	oralBottomPartnerIDs := make(map[int]bool)
	facialTopPartnerIDs := make(map[int]bool)
	facialBottomPartnerIDs := make(map[int]bool)

	// Helper to check if a tag ID matches any role tag (including subtags) and add the role
	// Returns matched flags: (matchedSex, matchedOral, matchedOrgasm, matchedFeet, matchedFacialTop, matchedFacialBottom)
	addRoleForTag := func(tagID int, role string) (bool, bool, bool, bool, bool, bool) {
		matchedSex := false
		matchedOral := false
		matchedOrgasm := false
		matchedFeet := false
		matchedFacialTop := false
		matchedFacialBottom := false
		if sexTagSet[tagID] {
			matchedSex = true
			if role == "top" {
				roles = appendIfNotExists(roles, "sex_top")
			} else if role == "bottom" {
				roles = appendIfNotExists(roles, "sex_bottom")
			}
		}
		if oralTagSet[tagID] {
			matchedOral = true
			if role == "top" {
				roles = appendIfNotExists(roles, "oral_top")
			} else if role == "bottom" {
				roles = appendIfNotExists(roles, "oral_bottom")
			}
		}
		if soloTagSet[tagID] {
			roles = appendIfNotExists(roles, "solo")
		}
		if facialTagSet[tagID] {
			if role == "top" {
				matchedFacialTop = true
			} else if role == "bottom" {
				matchedFacialBottom = true
			}
		}
		if orgasmTagSet[tagID] && role == "top" {
			matchedOrgasm = true
		}
		if feetTagSet[tagID] && role == "top" {
			matchedFeet = true
		}
		return matchedSex, matchedOral, matchedOrgasm, matchedFeet, matchedFacialTop, matchedFacialBottom
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

		// Check if this marker has the 2nd camera tag (primary or secondary)
		// If so, skip it from orgasm and facial counting (but sex/oral/solo roles still apply)
		markerIsSecondCamera := false
		if len(secondCameraTagSet) > 0 {
			if secondCameraTagSet[marker.PrimaryTagID] {
				markerIsSecondCamera = true
			}
			if !markerIsSecondCamera {
				for _, tagID := range secondaryTagIDs {
					if secondCameraTagSet[tagID] {
						markerIsSecondCamera = true
						break
					}
				}
			}
		}

		// Track if this marker is a facial marker for unique counting
		markerIsFacial := false

		// Track what tags matched for this marker and the performer's roles (can be both top AND bottom)
		markerMatchedSex := false
		markerMatchedOral := false
		markerMatchedFacial := false
		performerWasTopInMarker := false
		performerWasBottomInMarker := false

		for _, perf := range performers {
			if perf.PerformerID != performerID {
				continue
			}

			role := perf.Role
			// Track ALL roles the performer has in this marker (they can be both top and bottom)
			if role == "top" {
				performerWasTopInMarker = true
			}
			if role == "bottom" {
				performerWasBottomInMarker = true
			}

			// Track if we've already counted this marker for orgasms/feet/facials (to avoid double-counting with primary + secondary tags)
			markerCountedForOrgasm := false
			markerCountedForFeet := false
			markerCountedForFacialTop := false
			markerCountedForFacialBottom := false
			markerCountedForSex := false
			markerCountedForOral := false

			// Check primary tag first
			matchedSex, matchedOral, matchedOrgasm, matchedFeet, matchedFacialTop, matchedFacialBottom := addRoleForTag(marker.PrimaryTagID, role)
			if matchedSex {
				markerCountedForSex = true
				markerMatchedSex = true
			}
			if matchedOral {
				markerCountedForOral = true
				markerMatchedOral = true
			}
			if matchedOrgasm {
				markerCountedForOrgasm = true
			}
			if matchedFeet {
				markerCountedForFeet = true
			}
			if matchedFacialTop {
				markerCountedForFacialTop = true
				markerIsFacial = true
				markerMatchedFacial = true
			}
			if matchedFacialBottom {
				markerCountedForFacialBottom = true
				markerIsFacial = true
				markerMatchedFacial = true
			}

			// Also check secondary/additional tags (e.g., facial as secondary tag on a sex marker)
			for _, tagID := range secondaryTagIDs {
				matchedSex, matchedOral, matchedOrgasm, matchedFeet, matchedFacialTop, matchedFacialBottom := addRoleForTag(tagID, role)
				// Only count sex once per marker
				if matchedSex && !markerCountedForSex {
					markerCountedForSex = true
					markerMatchedSex = true
				}
				// Only count oral once per marker
				if matchedOral && !markerCountedForOral {
					markerCountedForOral = true
					markerMatchedOral = true
				}
				// Only count orgasm once per marker even if multiple orgasm subtags are present
				if matchedOrgasm && !markerCountedForOrgasm {
					markerCountedForOrgasm = true
				}
				// Only count feet once per marker even if multiple feet subtags are present
				if matchedFeet && !markerCountedForFeet {
					markerCountedForFeet = true
				}
				// Only count facial top once per marker
				if matchedFacialTop && !markerCountedForFacialTop {
					markerCountedForFacialTop = true
					markerIsFacial = true
					markerMatchedFacial = true
				}
				// Only count facial bottom once per marker
				if matchedFacialBottom && !markerCountedForFacialBottom {
					markerCountedForFacialBottom = true
					markerIsFacial = true
					markerMatchedFacial = true
				}
			}

			// Increment orgasm count once per marker if any orgasm tag matched
			// Skip markers tagged with 2nd camera (duplicate angle, not a separate orgasm)
			if markerCountedForOrgasm && !markerIsSecondCamera {
				orgasmTopCount++
			}

			// Increment feet count once per marker if any feet tag matched
			if markerCountedForFeet {
				feetTopCount++
			}

			// Increment facial counts once per marker (DEPRECATED - will be replaced by unique count)
			// Skip markers tagged with 2nd camera (duplicate angle, not a separate facial)
			if markerCountedForFacialTop && !markerIsSecondCamera {
				facialTopCount++
			}
			if markerCountedForFacialBottom && !markerIsSecondCamera {
				facialBottomCount++
			}
		}

		// After processing this performer's roles, track unique partners (opposite role performers)
		if markerMatchedSex || markerMatchedOral || markerMatchedFacial {
			for _, perf := range performers {
				if perf.PerformerID == performerID {
					continue // Skip the target performer
				}

				partnerID := perf.PerformerID
				partnerRole := perf.Role

				// Track sex partners (opposite role only)
				// If target was top and partner was bottom, track as sexTopPartner
				// If target was bottom and partner was top, track as sexBottomPartner
				if markerMatchedSex {
					if performerWasTopInMarker && partnerRole == "bottom" {
						sexTopPartnerIDs[partnerID] = true
					}
					if performerWasBottomInMarker && partnerRole == "top" {
						sexBottomPartnerIDs[partnerID] = true
					}
				}

				// Track oral partners (opposite role only)
				if markerMatchedOral {
					if performerWasTopInMarker && partnerRole == "bottom" {
						oralTopPartnerIDs[partnerID] = true
					}
					if performerWasBottomInMarker && partnerRole == "top" {
						oralBottomPartnerIDs[partnerID] = true
					}
				}

				// Track facial partners (opposite role only)
				if markerMatchedFacial {
					if performerWasTopInMarker && partnerRole == "bottom" {
						facialTopPartnerIDs[partnerID] = true
					}
					if performerWasBottomInMarker && partnerRole == "top" {
						facialBottomPartnerIDs[partnerID] = true
					}
				}
			}
		}

		// After processing all performer roles in this marker, track unique facial marker
		// Skip markers tagged with 2nd camera (duplicate angle, not a separate facial)
		if markerIsFacial && !markerIsSecondCamera {
			facialMarkerIDs[marker.ID] = true
		}
	}

	// Add facial roles with count suffix (facial_top_1, facial_bottom_2, etc.)
	if facialTopCount > 0 {
		roles = append(roles, fmt.Sprintf("facial_top_%d", facialTopCount))
	}
	if facialBottomCount > 0 {
		roles = append(roles, fmt.Sprintf("facial_bottom_%d", facialBottomCount))
	}

	// Add unique facial count (number of distinct facial markers, not counting same marker twice)
	facialUniqueCount := len(facialMarkerIDs)
	if facialUniqueCount > 0 {
		roles = append(roles, fmt.Sprintf("facial_unique_%d", facialUniqueCount))
	}

	// Add partner counts for sex, oral, and facial (scene-specific unique partner counts)
	sexTopPartnerCount := len(sexTopPartnerIDs)
	if sexTopPartnerCount > 0 {
		roles = append(roles, fmt.Sprintf("sex_top_partners_%d", sexTopPartnerCount))
	}
	sexBottomPartnerCount := len(sexBottomPartnerIDs)
	if sexBottomPartnerCount > 0 {
		roles = append(roles, fmt.Sprintf("sex_bottom_partners_%d", sexBottomPartnerCount))
	}

	// Calculate unique sex partners (across both top and bottom roles)
	sexAllPartnerIDs := make(map[int]bool)
	for id := range sexTopPartnerIDs {
		sexAllPartnerIDs[id] = true
	}
	for id := range sexBottomPartnerIDs {
		sexAllPartnerIDs[id] = true
	}
	sexAllPartnerCount := len(sexAllPartnerIDs)
	if sexAllPartnerCount > 0 {
		roles = append(roles, fmt.Sprintf("sex_all_partners_%d", sexAllPartnerCount))
	}

	oralTopPartnerCount := len(oralTopPartnerIDs)
	if oralTopPartnerCount > 0 {
		roles = append(roles, fmt.Sprintf("oral_top_partners_%d", oralTopPartnerCount))
	}
	oralBottomPartnerCount := len(oralBottomPartnerIDs)
	if oralBottomPartnerCount > 0 {
		roles = append(roles, fmt.Sprintf("oral_bottom_partners_%d", oralBottomPartnerCount))
	}

	// Calculate unique oral partners (across both top and bottom roles)
	oralAllPartnerIDs := make(map[int]bool)
	for id := range oralTopPartnerIDs {
		oralAllPartnerIDs[id] = true
	}
	for id := range oralBottomPartnerIDs {
		oralAllPartnerIDs[id] = true
	}
	oralAllPartnerCount := len(oralAllPartnerIDs)
	if oralAllPartnerCount > 0 {
		roles = append(roles, fmt.Sprintf("oral_all_partners_%d", oralAllPartnerCount))
	}

	facialTopPartnerCount := len(facialTopPartnerIDs)
	if facialTopPartnerCount > 0 {
		roles = append(roles, fmt.Sprintf("facial_top_partners_%d", facialTopPartnerCount))
	}
	facialBottomPartnerCount := len(facialBottomPartnerIDs)
	if facialBottomPartnerCount > 0 {
		roles = append(roles, fmt.Sprintf("facial_bottom_partners_%d", facialBottomPartnerCount))
	}

	// Calculate unique facial partners (across both top and bottom roles)
	facialAllPartnerIDs := make(map[int]bool)
	for id := range facialTopPartnerIDs {
		facialAllPartnerIDs[id] = true
	}
	for id := range facialBottomPartnerIDs {
		facialAllPartnerIDs[id] = true
	}
	facialAllPartnerCount := len(facialAllPartnerIDs)
	if facialAllPartnerCount > 0 {
		roles = append(roles, fmt.Sprintf("facial_all_partners_%d", facialAllPartnerCount))
	}

	// Add orgasm roles with count suffix (orgasm_top_1, orgasm_top_2, etc.)
	if orgasmTopCount > 0 {
		roles = append(roles, fmt.Sprintf("orgasm_top_%d", orgasmTopCount))
	}

	// Add feet roles with count suffix (feet_top_1, feet_top_2, etc.)
	if feetTopCount > 0 {
		roles = append(roles, fmt.Sprintf("feet_top_%d", feetTopCount))
	}

	return roles, nil
}

// appendIfNotExists is a helper to append string if not already in slice.
func appendIfNotExists(slice []string, s string) []string {
	for _, existing := range slice {
		if existing == s {
			return slice
		}
	}
	return append(slice, s)
}

// CountScenesWithMarkerTag counts distinct scenes that have markers with the given tag or subtags
func CountScenesWithMarkerTag(ctx context.Context, markerQB models.SceneMarkerQueryer, tagID int) (int, error) {
	if tagID == 0 {
		return 0, nil
	}

	allDepth := -1 // Include all subtags recursively
	filter := &models.SceneMarkerFilterType{
		Tags: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(tagID)},
			Modifier: models.CriterionModifierIncludes,
			Depth:    &allDepth,
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

// CountScenesWithMarkerTagExcluding counts distinct scenes that have markers with tagID (or subtags) but not excludeTagID (or subtags)
func CountScenesWithMarkerTagExcluding(ctx context.Context, markerQB models.SceneMarkerReader, tagID int, excludeTagID int) (int, error) {
	if tagID == 0 {
		return 0, nil
	}

	// Use PerPage=-1 to get all results, not just the default 25
	allResults := -1
	findFilter := &models.FindFilterType{PerPage: &allResults}

	// Get scenes with the include tag (including subtags)
	allDepth := -1
	filter := &models.SceneMarkerFilterType{
		Tags: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(tagID)},
			Modifier: models.CriterionModifierIncludes,
			Depth:    &allDepth,
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

	// Get scenes with the exclude tag (including subtags)
	excludeFilter := &models.SceneMarkerFilterType{
		Tags: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(excludeTagID)},
			Modifier: models.CriterionModifierIncludes,
			Depth:    &allDepth,
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

// CountScenesWithMarkerTagExcludingMultiple counts scenes with tagID (or subtags) but none of excludeTagIDs (or subtags)
func CountScenesWithMarkerTagExcludingMultiple(ctx context.Context, markerQB models.SceneMarkerReader, tagID int, excludeTagIDs []int) (int, error) {
	if tagID == 0 {
		return 0, nil
	}

	// Use PerPage=-1 to get all results, not just the default 25
	allResults := -1
	findFilter := &models.FindFilterType{PerPage: &allResults}

	// Get scenes with the include tag (including subtags)
	allDepth := -1
	filter := &models.SceneMarkerFilterType{
		Tags: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(tagID)},
			Modifier: models.CriterionModifierIncludes,
			Depth:    &allDepth,
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
				Depth:    &allDepth,
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

// CountByStudioMarkerRole counts distinct scenes for a studio with markers having the given tag or subtags
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

	// Build filter for markers with the tag (including subtags)
	allDepth := -1
	filter := &models.SceneMarkerFilterType{
		Tags: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(tagID)},
			Modifier: models.CriterionModifierIncludes,
			Depth:    &allDepth,
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

		group := models.SceneMarkerTagGroupInput{
			TopPerformerIDs:    topIDs,
			BottomPerformerIDs: bottomIDs,
		}
		performerMode := "OR"
		group.PerformerMode = &performerMode
		filter.SceneMarkerTags = &models.SceneMarkerTagsCriterionInput{
			Modifier:       models.CriterionModifierEquals,
			GroupsExtended: []models.SceneMarkerTagGroupInput{group},
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

// getStudioSceneIDs is a helper to get studio scene IDs.
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

// getStudioScenesWithMarkerTag is a helper to get scenes with a marker tag (including subtags).
func getStudioScenesWithMarkerTag(ctx context.Context, markerQB models.SceneMarkerQueryer, studioScenes map[int]bool, tagID int, role string, performerID *int) (map[int]bool, error) {
	allDepth := -1 // Include all subtags recursively
	filter := &models.SceneMarkerFilterType{
		Tags: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(tagID)},
			Modifier: models.CriterionModifierIncludes,
			Depth:    &allDepth,
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

		group := models.SceneMarkerTagGroupInput{
			TopPerformerIDs:    topIDs,
			BottomPerformerIDs: bottomIDs,
		}
		performerMode := "OR"
		group.PerformerMode = &performerMode
		filter.SceneMarkerTags = &models.SceneMarkerTagsCriterionInput{
			Modifier:       models.CriterionModifierEquals,
			GroupsExtended: []models.SceneMarkerTagGroupInput{group},
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
