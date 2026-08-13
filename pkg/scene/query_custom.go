package scene

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/stashapp/stash/pkg/models"
)

// CountScenesByPerformerMarkerRole counts distinct scenes where a performer participates
// in markers with the given primary tag (including subtags) and optionally a specific role (top/bottom).
// If role is empty, counts all markers with that tag regardless of role.
func CountScenesByPerformerMarkerRole(ctx context.Context, r models.SceneMarkerQueryer, performerID int, tagID int, role string) (int, error) {
	sceneSet, err := getScenesByPerformerMarkerRole(ctx, r, performerID, tagID, role)
	if err != nil {
		return 0, err
	}

	return len(sceneSet), nil
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
	// CUSTOM: begin - batch-fetch all secondary tag IDs to eliminate N+1 queries
	markerIDs := make([]int, len(markers))
	for i, m := range markers {
		markerIDs[i] = m.ID
	}
	allSecondaryTagIDs, err := r.GetTagIDsForMarkers(ctx, markerIDs)
	if err != nil {
		return 0, err
	}
	// CUSTOM: end

	count := 0
	for _, marker := range markers {
		matched := false
		// Check primary tag
		if tagSet[marker.PrimaryTagID] {
			matched = true
		}

		// Check secondary tags for match and exclusion
		secondaryTagIDs := allSecondaryTagIDs[marker.ID] // CUSTOM: use batched result

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

// CountMarkersByStudioRoleWithSecondary counts markers in studio scenes where performer has role and the marker
// has the tagID in either primary or secondary tags (including subtags).
// Optional excludeTagIDs will exclude markers that have any of those tags (or descendants).
func CountMarkersByStudioRoleWithSecondary(ctx context.Context, markerQB models.SceneMarkerReader, sceneQB models.SceneQueryer, tagFinder models.TagFinder, studioID int, depth *int, performerID int, tagID int, role string, excludeTagIDs ...int) (int, error) {
	if tagID == 0 {
		return 0, nil
	}

	studioScenes, err := getStudioSceneIDs(ctx, sceneQB, studioID, depth, nil)
	if err != nil {
		return 0, err
	}

	if len(studioScenes) == 0 {
		return 0, nil
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
	filter := &models.SceneMarkerFilterType{
		SceneMarkerTags: &models.SceneMarkerTagsCriterionInput{
			Modifier:       models.CriterionModifierEquals,
			GroupsExtended: []models.SceneMarkerTagGroupInput{group},
		},
	}

	allResults := -1
	findFilter := &models.FindFilterType{PerPage: &allResults}

	markers, _, err := markerQB.Query(ctx, filter, findFilter)
	if err != nil {
		return 0, err
	}

	tagSet := make(map[int]bool)
	tagSet[tagID] = true
	descendants, err := tagFinder.FindAllDescendants(ctx, tagID, nil)
	if err != nil {
		return 0, err
	}
	for _, d := range descendants {
		tagSet[d.ID] = true
	}

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

	count := 0
	// CUSTOM: begin - batch-fetch all secondary tag IDs to eliminate N+1 queries
	studioMarkerIDs := make([]int, 0, len(markers))
	for _, marker := range markers {
		if studioScenes[marker.SceneID] {
			studioMarkerIDs = append(studioMarkerIDs, marker.ID)
		}
	}
	allStudioSecondaryTagIDs, err := markerQB.GetTagIDsForMarkers(ctx, studioMarkerIDs)
	if err != nil {
		return 0, err
	}
	// CUSTOM: end

	for _, marker := range markers {
		if !studioScenes[marker.SceneID] {
			continue
		}

		matched := false
		if tagSet[marker.PrimaryTagID] {
			matched = true
		}

		secondaryTagIDs := allStudioSecondaryTagIDs[marker.ID] // CUSTOM: use batched result

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

		if len(excludeTagSet) > 0 {
			excluded := false
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
		if soloTagSet[tagID] && role == "top" { // CUSTOM: only top role counts as jerk/solo
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
	// CUSTOM: begin - batch-fetch performer and tag associations to eliminate N+1 queries
	sceneMarkerIDs := make([]int, len(markers))
	for i, m := range markers {
		sceneMarkerIDs[i] = m.ID
	}
	allScenePerformers, err := r.GetPerformersForMarkers(ctx, sceneMarkerIDs)
	if err != nil {
		return nil, err
	}
	allSceneSecondaryTags, err := r.GetTagIDsForMarkers(ctx, sceneMarkerIDs)
	if err != nil {
		return nil, err
	}
	// CUSTOM: end

	for _, marker := range markers {
		performers := allScenePerformers[marker.ID]         // CUSTOM: use batched result
		secondaryTagIDs := allSceneSecondaryTags[marker.ID] // CUSTOM: use batched result

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

	// CUSTOM: begin - emit partner ID strings so the frontend can show mini performer images
	// Format: "<category>_top_pids:<id1>,<id2>..." and "<category>_bottom_pids:..."
	// Only emitted when there are partners; IDs are sorted for determinism.
	emitSortedPartnerPIDs := func(prefix string, ids map[int]bool) {
		if len(ids) == 0 {
			return
		}
		sorted := make([]int, 0, len(ids))
		for id := range ids {
			sorted = append(sorted, id)
		}
		sort.Ints(sorted)
		parts := make([]string, len(sorted))
		for i, id := range sorted {
			parts[i] = strconv.Itoa(id)
		}
		roles = append(roles, prefix+strings.Join(parts, ","))
	}
	emitSortedPartnerPIDs("sex_top_pids:", sexTopPartnerIDs)
	emitSortedPartnerPIDs("sex_bottom_pids:", sexBottomPartnerIDs)
	emitSortedPartnerPIDs("oral_top_pids:", oralTopPartnerIDs)
	emitSortedPartnerPIDs("oral_bottom_pids:", oralBottomPartnerIDs)
	emitSortedPartnerPIDs("facial_top_pids:", facialTopPartnerIDs)
	emitSortedPartnerPIDs("facial_bottom_pids:", facialBottomPartnerIDs)
	// CUSTOM: end

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
	scenes, err := getScenesWithMarkerTag(ctx, markerQB, tagID)
	if err != nil {
		return 0, err
	}

	return len(scenes), nil
}

// CountScenesWithMarkerTagExcluding counts distinct scenes that have markers with tagID (or subtags) but not excludeTagID (or subtags)
func CountScenesWithMarkerTagExcluding(ctx context.Context, markerQB models.SceneMarkerReader, tagID int, excludeTagID int) (int, error) {
	return CountScenesWithMarkerTagExcludingMultiple(ctx, markerQB, tagID, []int{excludeTagID})
}

// CountScenesWithMarkerTagExcludingMultiple counts scenes with tagID (or subtags) but none of excludeTagIDs (or subtags)
func CountScenesWithMarkerTagExcludingMultiple(ctx context.Context, markerQB models.SceneMarkerReader, tagID int, excludeTagIDs []int) (int, error) {
	includeScenes, err := getScenesWithMarkerTag(ctx, markerQB, tagID)
	if err != nil {
		return 0, err
	}
	if tagID == 0 {
		return 0, nil
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
		scenes, err := getScenesWithMarkerTag(ctx, markerQB, excludeTagID)
		if err != nil {
			return 0, err
		}
		for sceneID := range scenes {
			excludeScenes[sceneID] = true
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

func getScenesWithMarkerTag(ctx context.Context, markerQB models.SceneMarkerQueryer, tagID int) (map[int]bool, error) {
	ret := make(map[int]bool)
	if tagID == 0 {
		return ret, nil
	}

	allDepth := -1 // Include all subtags recursively
	filter := &models.SceneMarkerFilterType{
		Tags: &models.HierarchicalMultiCriterionInput{
			Value:    []string{strconv.Itoa(tagID)},
			Modifier: models.CriterionModifierIncludes,
			Depth:    &allDepth,
		},
	}

	allResults := -1
	findFilter := &models.FindFilterType{PerPage: &allResults}

	markers, _, err := markerQB.Query(ctx, filter, findFilter)
	if err != nil {
		return nil, err
	}

	for _, m := range markers {
		ret[m.SceneID] = true
	}

	return ret, nil
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
	return CountByStudioMarkerRoleExcludingMultiple(ctx, markerQB, sceneQB, studioID, depth, tagID, role, []int{excludeTagID}, performerID)
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

// GetCoPerformersWithCountsByStudio gets co-performers for a given performer based on tag and role,
// filtered to scenes that belong to the given studio/depth. Returns a map of performer ID to distinct scene count.
// tagDepth: 0 for exact tag match, -1 for including all subtags.
func GetCoPerformersWithCountsByStudio(ctx context.Context, markerQB models.SceneMarkerReader, sceneQB models.SceneQueryer, studioID int, studioDepth *int, performerID int, tagID int, performerRole string, tagDepth int) (map[int]int, error) {
	if tagID == 0 {
		return map[int]int{}, nil
	}

	studioScenes, err := getStudioSceneIDs(ctx, sceneQB, studioID, studioDepth, &performerID)
	if err != nil {
		return nil, err
	}

	if len(studioScenes) == 0 {
		return map[int]int{}, nil
	}

	oppositeRole := "bottom"
	if performerRole == "bottom" {
		oppositeRole = "top"
	}

	performerIDStr := strconv.Itoa(performerID)
	tagIDStr := strconv.Itoa(tagID)

	group := models.SceneMarkerTagGroupInput{
		TagIDs: []string{tagIDStr},
		Depth:  &tagDepth,
	}

	if performerRole == "top" {
		group.TopPerformerIDs = []string{performerIDStr}
	} else {
		group.BottomPerformerIDs = []string{performerIDStr}
	}

	performerMode := "OR"
	group.PerformerMode = &performerMode

	filter := &models.SceneMarkerFilterType{
		SceneMarkerTags: &models.SceneMarkerTagsCriterionInput{
			Modifier:       models.CriterionModifierEquals,
			GroupsExtended: []models.SceneMarkerTagGroupInput{group},
		},
	}

	allResults := -1
	findFilter := &models.FindFilterType{PerPage: &allResults}

	markers, _, err := markerQB.Query(ctx, filter, findFilter)
	if err != nil {
		return nil, err
	}

	coPerformerScenes := make(map[int]map[int]bool)
	// CUSTOM: begin - batch-fetch performer associations to eliminate N+1 queries
	studioCoMarkerIDs := make([]int, 0, len(markers))
	for _, marker := range markers {
		if studioScenes[marker.SceneID] {
			studioCoMarkerIDs = append(studioCoMarkerIDs, marker.ID)
		}
	}
	allCoPerformers, err := markerQB.GetPerformersForMarkers(ctx, studioCoMarkerIDs)
	if err != nil {
		return nil, err
	}
	// CUSTOM: end

	for _, marker := range markers {
		if !studioScenes[marker.SceneID] {
			continue
		}

		markerPerformers := allCoPerformers[marker.ID] // CUSTOM: use batched result

		for _, mp := range markerPerformers {
			if mp.PerformerID != performerID && mp.Role == oppositeRole {
				if coPerformerScenes[mp.PerformerID] == nil {
					coPerformerScenes[mp.PerformerID] = make(map[int]bool)
				}
				coPerformerScenes[mp.PerformerID][marker.SceneID] = true
			}
		}
	}

	sceneCountsByPerformer := make(map[int]int)
	for coPerformerID, scenes := range coPerformerScenes {
		sceneCountsByPerformer[coPerformerID] = len(scenes)
	}

	return sceneCountsByPerformer, nil
}

// GetTotalUniqueCoPerformersByStudio gets the total count of unique co-performers for a performer within a studio,
// combining both top and bottom roles. Returns the count of unique performers across both roles.
func GetTotalUniqueCoPerformersByStudio(ctx context.Context, markerQB models.SceneMarkerReader, sceneQB models.SceneQueryer, studioID int, studioDepth *int, performerID int, tagID int, tagDepth int) (int, error) {
	// Get co-performers for top role
	topCoPerformers, err := GetCoPerformersWithCountsByStudio(ctx, markerQB, sceneQB, studioID, studioDepth, performerID, tagID, "top", tagDepth)
	if err != nil {
		return 0, err
	}

	// Get co-performers for bottom role
	bottomCoPerformers, err := GetCoPerformersWithCountsByStudio(ctx, markerQB, sceneQB, studioID, studioDepth, performerID, tagID, "bottom", tagDepth)
	if err != nil {
		return 0, err
	}

	// Combine the two sets (unique performers that appear in either role)
	uniqueSet := make(map[int]bool)
	for performerID := range topCoPerformers {
		uniqueSet[performerID] = true
	}
	for performerID := range bottomCoPerformers {
		uniqueSet[performerID] = true
	}

	return len(uniqueSet), nil
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

// CUSTOM: begin - batched studio role count helpers (eliminate redundant getStudioSceneIDs calls)

// StudioRoleCountsData holds batched non-performer-filtered role counts.
// Returned by GetStudioRoleCounts; the resolver maps it to the generated StudioRoleCounts GQL model.
type StudioRoleCountsData struct {
	SexSceneCount    int
	OralSceneCount   int
	SoloSceneCount   int
	FacialSceneCount int
}

// GetStudioRoleCounts computes sex/oral/solo/facial scene counts in a single batch,
// calling getStudioSceneIDs exactly once instead of once per field.
func GetStudioRoleCounts(
	ctx context.Context,
	markerQB models.SceneMarkerQueryer,
	sceneQB models.SceneQueryer,
	studioID int,
	depth *int,
	sexTagID, oralTagID, soloTagID, facialTagID int,
) (*StudioRoleCountsData, error) {
	result := &StudioRoleCountsData{}

	studioScenes, err := getStudioSceneIDs(ctx, sceneQB, studioID, depth, nil)
	if err != nil {
		return nil, err
	}
	if len(studioScenes) == 0 {
		return result, nil
	}

	var sexScenes, oralScenes map[int]bool

	if sexTagID != 0 {
		sexScenes, err = getStudioScenesWithMarkerTag(ctx, markerQB, studioScenes, sexTagID, "", nil)
		if err != nil {
			return nil, err
		}
		result.SexSceneCount = len(sexScenes)
	}

	if oralTagID != 0 {
		rawOral, err := getStudioScenesWithMarkerTag(ctx, markerQB, studioScenes, oralTagID, "", nil)
		if err != nil {
			return nil, err
		}
		oralScenes = rawOral
		n := 0
		for id := range rawOral {
			if !sexScenes[id] {
				n++
			}
		}
		result.OralSceneCount = n
	}

	if soloTagID != 0 {
		rawSolo, err := getStudioScenesWithMarkerTag(ctx, markerQB, studioScenes, soloTagID, "", nil)
		if err != nil {
			return nil, err
		}
		n := 0
		for id := range rawSolo {
			if !sexScenes[id] && !oralScenes[id] {
				n++
			}
		}
		result.SoloSceneCount = n
	}

	if facialTagID != 0 {
		rawFacial, err := getStudioScenesWithMarkerTag(ctx, markerQB, studioScenes, facialTagID, "", nil)
		if err != nil {
			return nil, err
		}
		result.FacialSceneCount = len(rawFacial)
	}

	return result, nil
}

// StudioPerformerRoleStatsData holds all batched performer-filtered role stats.
// Returned by GetStudioPerformerRoleStats; the resolver maps it to the generated GQL model.
type StudioPerformerRoleStatsData struct {
	SexSceneCount               int
	SexTopCount                 int
	SexBottomCount              int
	SexWithTopCount             int
	SexWithBottomCount          int
	OralSceneCount              int
	OralTopCount                int
	OralBottomCount             int
	OralWithTopCount            int
	OralWithBottomCount         int
	SoloSceneCount              int
	FacialSceneCount            int
	FacialTopCount              int
	FacialBottomCount           int
	FacialWithTopCount          int
	FacialWithBottomCount       int
	FacialMarkerWithTopCount    int
	FacialMarkerWithBottomCount int
	SexUniquePartnerCount       int
	OralUniquePartnerCount      int
	FacialUniquePartnerCount    int
	OrgasmTopCount              int
	FacialMarkerCount           int
	FeetTopCount                int
}

// GetStudioPerformerRoleStats computes all marker-based role stats for a performer within a studio in one batch.
// It calls getStudioSceneIDs at most twice (once with performer filter, once without) instead of once per resolver.
func GetStudioPerformerRoleStats(
	ctx context.Context,
	markerQB models.SceneMarkerReader,
	sceneQB models.SceneQueryer,
	tagFinder models.TagFinder,
	studioID int,
	depth *int,
	performerID int,
	sexTagID, oralTagID, soloTagID, facialTagID, orgasmTagID, feetTagID, secondCameraTagID int,
) (*StudioPerformerRoleStatsData, error) {
	result := &StudioPerformerRoleStatsData{}
	perfIDPtr := &performerID

	// === Groups A + C: performer-filtered studio scenes (called ONCE) ===
	studioPerformerScenes, err := getStudioSceneIDs(ctx, sceneQB, studioID, depth, perfIDPtr)
	if err != nil {
		return nil, err
	}

	if len(studioPerformerScenes) > 0 {
		// --- Group A: scene-level counts via getStudioScenesWithMarkerTag ---
		var rawSexScenes, rawOralScenes map[int]bool

		if sexTagID != 0 {
			rawSexScenes, err = getStudioScenesWithMarkerTag(ctx, markerQB, studioPerformerScenes, sexTagID, "", perfIDPtr)
			if err != nil {
				return nil, err
			}
			result.SexSceneCount = len(rawSexScenes)

			rawSexTop, err := getStudioScenesWithMarkerTag(ctx, markerQB, studioPerformerScenes, sexTagID, "top", perfIDPtr)
			if err != nil {
				return nil, err
			}
			result.SexTopCount = len(rawSexTop)

			rawSexBottom, err := getStudioScenesWithMarkerTag(ctx, markerQB, studioPerformerScenes, sexTagID, "bottom", perfIDPtr)
			if err != nil {
				return nil, err
			}
			result.SexBottomCount = len(rawSexBottom)
		}

		if oralTagID != 0 {
			rawOral, err := getStudioScenesWithMarkerTag(ctx, markerQB, studioPerformerScenes, oralTagID, "", perfIDPtr)
			if err != nil {
				return nil, err
			}
			rawOralScenes = rawOral
			n := 0
			for id := range rawOral {
				if !rawSexScenes[id] {
					n++
				}
			}
			result.OralSceneCount = n

			rawOralTop, err := getStudioScenesWithMarkerTag(ctx, markerQB, studioPerformerScenes, oralTagID, "top", perfIDPtr)
			if err != nil {
				return nil, err
			}
			nTop := 0
			for id := range rawOralTop {
				if !rawSexScenes[id] {
					nTop++
				}
			}
			result.OralTopCount = nTop

			rawOralBottom, err := getStudioScenesWithMarkerTag(ctx, markerQB, studioPerformerScenes, oralTagID, "bottom", perfIDPtr)
			if err != nil {
				return nil, err
			}
			nBottom := 0
			for id := range rawOralBottom {
				if !rawSexScenes[id] {
					nBottom++
				}
			}
			result.OralBottomCount = nBottom
		}

		if soloTagID != 0 {
			rawSolo, err := getStudioScenesWithMarkerTag(ctx, markerQB, studioPerformerScenes, soloTagID, "top", perfIDPtr)
			if err != nil {
				return nil, err
			}
			n := 0
			for id := range rawSolo {
				if !rawSexScenes[id] && !rawOralScenes[id] {
					n++
				}
			}
			result.SoloSceneCount = n
		}

		if facialTagID != 0 {
			rawFacial, err := getStudioScenesWithMarkerTag(ctx, markerQB, studioPerformerScenes, facialTagID, "", perfIDPtr)
			if err != nil {
				return nil, err
			}
			result.FacialSceneCount = len(rawFacial)

			rawFacialTop, err := getStudioScenesWithMarkerTag(ctx, markerQB, studioPerformerScenes, facialTagID, "top", perfIDPtr)
			if err != nil {
				return nil, err
			}
			result.FacialTopCount = len(rawFacialTop)

			rawFacialBottom, err := getStudioScenesWithMarkerTag(ctx, markerQB, studioPerformerScenes, facialTagID, "bottom", perfIDPtr)
			if err != nil {
				return nil, err
			}
			result.FacialBottomCount = len(rawFacialBottom)
		}

		// --- Group C: co-performer counts (reuse studioPerformerScenes) ---
		if sexTagID != 0 {
			sexTop, err := getCoPerformersWithCountsInScenes(ctx, markerQB, studioPerformerScenes, performerID, sexTagID, "top", 0)
			if err != nil {
				return nil, err
			}
			result.SexWithTopCount = len(sexTop)

			sexBottom, err := getCoPerformersWithCountsInScenes(ctx, markerQB, studioPerformerScenes, performerID, sexTagID, "bottom", 0)
			if err != nil {
				return nil, err
			}
			result.SexWithBottomCount = len(sexBottom)

			uniqueSex := make(map[int]bool)
			for id := range sexTop {
				uniqueSex[id] = true
			}
			for id := range sexBottom {
				uniqueSex[id] = true
			}
			result.SexUniquePartnerCount = len(uniqueSex)
		}

		if oralTagID != 0 {
			oralTop, err := getCoPerformersWithCountsInScenes(ctx, markerQB, studioPerformerScenes, performerID, oralTagID, "top", -1)
			if err != nil {
				return nil, err
			}
			result.OralWithTopCount = len(oralTop)

			oralBottom, err := getCoPerformersWithCountsInScenes(ctx, markerQB, studioPerformerScenes, performerID, oralTagID, "bottom", -1)
			if err != nil {
				return nil, err
			}
			result.OralWithBottomCount = len(oralBottom)

			uniqueOral := make(map[int]bool)
			for id := range oralTop {
				uniqueOral[id] = true
			}
			for id := range oralBottom {
				uniqueOral[id] = true
			}
			result.OralUniquePartnerCount = len(uniqueOral)
		}

		if facialTagID != 0 {
			facialTop, err := getCoPerformersWithCountsInScenes(ctx, markerQB, studioPerformerScenes, performerID, facialTagID, "top", -1)
			if err != nil {
				return nil, err
			}
			facialBottom, err := getCoPerformersWithCountsInScenes(ctx, markerQB, studioPerformerScenes, performerID, facialTagID, "bottom", -1)
			if err != nil {
				return nil, err
			}
			result.FacialWithTopCount = len(facialTop)
			result.FacialWithBottomCount = len(facialBottom)
			uniqueFacial := make(map[int]bool)
			for id := range facialTop {
				uniqueFacial[id] = true
			}
			for id := range facialBottom {
				uniqueFacial[id] = true
			}
			result.FacialUniquePartnerCount = len(uniqueFacial)
		}
	}

	// === Group B: marker counts (getStudioSceneIDs WITHOUT performer filter) ===
	allStudioScenes, err := getStudioSceneIDs(ctx, sceneQB, studioID, depth, nil)
	if err != nil {
		return nil, err
	}

	if len(allStudioScenes) > 0 {
		if facialTagID != 0 {
			result.FacialMarkerWithTopCount, err = countMarkersByRoleWithSecondaryInScenes(ctx, markerQB, allStudioScenes, tagFinder, performerID, facialTagID, "top", secondCameraTagID)
			if err != nil {
				return nil, err
			}
			result.FacialMarkerWithBottomCount, err = countMarkersByRoleWithSecondaryInScenes(ctx, markerQB, allStudioScenes, tagFinder, performerID, facialTagID, "bottom", secondCameraTagID)
			if err != nil {
				return nil, err
			}
			result.FacialMarkerCount, err = countMarkersByRoleWithSecondaryInScenes(ctx, markerQB, allStudioScenes, tagFinder, performerID, facialTagID, "", secondCameraTagID)
			if err != nil {
				return nil, err
			}
		}
		if orgasmTagID != 0 {
			result.OrgasmTopCount, err = countMarkersByRoleWithSecondaryInScenes(ctx, markerQB, allStudioScenes, tagFinder, performerID, orgasmTagID, "top", secondCameraTagID)
			if err != nil {
				return nil, err
			}
		}
		if feetTagID != 0 {
			result.FeetTopCount, err = countMarkersByRoleWithSecondaryInScenes(ctx, markerQB, allStudioScenes, tagFinder, performerID, feetTagID, "top", secondCameraTagID)
			if err != nil {
				return nil, err
			}
		}
	}

	return result, nil
}

// getCoPerformersWithCountsInScenes is like GetCoPerformersWithCountsByStudio but accepts
// a pre-fetched studioScenes map, eliminating the redundant getStudioSceneIDs call.
func getCoPerformersWithCountsInScenes(
	ctx context.Context,
	markerQB models.SceneMarkerReader,
	studioScenes map[int]bool,
	performerID int,
	tagID int,
	performerRole string,
	tagDepth int,
) (map[int]int, error) {
	if tagID == 0 {
		return map[int]int{}, nil
	}

	oppositeRole := "bottom"
	if performerRole == "bottom" {
		oppositeRole = "top"
	}

	performerIDStr := strconv.Itoa(performerID)
	tagIDStr := strconv.Itoa(tagID)

	group := models.SceneMarkerTagGroupInput{
		TagIDs: []string{tagIDStr},
		Depth:  &tagDepth,
	}

	if performerRole == "top" {
		group.TopPerformerIDs = []string{performerIDStr}
	} else {
		group.BottomPerformerIDs = []string{performerIDStr}
	}

	performerMode := "OR"
	group.PerformerMode = &performerMode

	filter := &models.SceneMarkerFilterType{
		SceneMarkerTags: &models.SceneMarkerTagsCriterionInput{
			Modifier:       models.CriterionModifierEquals,
			GroupsExtended: []models.SceneMarkerTagGroupInput{group},
		},
	}

	allResults := -1
	findFilter := &models.FindFilterType{PerPage: &allResults}

	markers, _, err := markerQB.Query(ctx, filter, findFilter)
	if err != nil {
		return nil, err
	}

	studioMarkerIDs := make([]int, 0, len(markers))
	for _, marker := range markers {
		if studioScenes[marker.SceneID] {
			studioMarkerIDs = append(studioMarkerIDs, marker.ID)
		}
	}
	allCoPerformers, err := markerQB.GetPerformersForMarkers(ctx, studioMarkerIDs)
	if err != nil {
		return nil, err
	}

	coPerformerScenes := make(map[int]map[int]bool)
	for _, marker := range markers {
		if !studioScenes[marker.SceneID] {
			continue
		}
		for _, mp := range allCoPerformers[marker.ID] {
			if mp.PerformerID != performerID && mp.Role == oppositeRole {
				if coPerformerScenes[mp.PerformerID] == nil {
					coPerformerScenes[mp.PerformerID] = make(map[int]bool)
				}
				coPerformerScenes[mp.PerformerID][marker.SceneID] = true
			}
		}
	}

	result := make(map[int]int, len(coPerformerScenes))
	for coID, scenes := range coPerformerScenes {
		result[coID] = len(scenes)
	}
	return result, nil
}

// countMarkersByRoleWithSecondaryInScenes is like CountMarkersByStudioRoleWithSecondary but
// accepts a pre-fetched allStudioScenes map, eliminating the redundant getStudioSceneIDs call.
func countMarkersByRoleWithSecondaryInScenes(
	ctx context.Context,
	markerQB models.SceneMarkerReader,
	allStudioScenes map[int]bool,
	tagFinder models.TagFinder,
	performerID int,
	tagID int,
	role string,
	excludeTagIDs ...int,
) (int, error) {
	if tagID == 0 {
		return 0, nil
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
	filter := &models.SceneMarkerFilterType{
		SceneMarkerTags: &models.SceneMarkerTagsCriterionInput{
			Modifier:       models.CriterionModifierEquals,
			GroupsExtended: []models.SceneMarkerTagGroupInput{group},
		},
	}

	allResults := -1
	findFilter := &models.FindFilterType{PerPage: &allResults}

	markers, _, err := markerQB.Query(ctx, filter, findFilter)
	if err != nil {
		return 0, err
	}

	tagSet := make(map[int]bool)
	tagSet[tagID] = true
	descendants, err := tagFinder.FindAllDescendants(ctx, tagID, nil)
	if err != nil {
		return 0, err
	}
	for _, d := range descendants {
		tagSet[d.ID] = true
	}

	excludeTagSet := make(map[int]bool)
	for _, excludeTagID := range excludeTagIDs {
		if excludeTagID == 0 {
			continue
		}
		excludeTagSet[excludeTagID] = true
		excDesc, err := tagFinder.FindAllDescendants(ctx, excludeTagID, nil)
		if err != nil {
			return 0, err
		}
		for _, d := range excDesc {
			excludeTagSet[d.ID] = true
		}
	}

	studioMarkerIDs := make([]int, 0, len(markers))
	for _, marker := range markers {
		if allStudioScenes[marker.SceneID] {
			studioMarkerIDs = append(studioMarkerIDs, marker.ID)
		}
	}
	allSecondaryTagIDs, err := markerQB.GetTagIDsForMarkers(ctx, studioMarkerIDs)
	if err != nil {
		return 0, err
	}

	count := 0
	for _, marker := range markers {
		if !allStudioScenes[marker.SceneID] {
			continue
		}

		secondaryTagIDs := allSecondaryTagIDs[marker.ID]

		matched := tagSet[marker.PrimaryTagID]
		if !matched {
			for _, stid := range secondaryTagIDs {
				if tagSet[stid] {
					matched = true
					break
				}
			}
		}
		if !matched {
			continue
		}

		if len(excludeTagSet) > 0 {
			excluded := excludeTagSet[marker.PrimaryTagID]
			if !excluded {
				for _, stid := range secondaryTagIDs {
					if excludeTagSet[stid] {
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

// PerformerRoleStatsData holds all role stats needed by performer cards.
// Returned by GetPerformerRoleStatsBatch so card grids can fetch all stats in one resolver.
type PerformerRoleStatsData struct {
	PerformerID                 int
	SexSceneCount               int
	SexTopCount                 int
	SexBottomCount              int
	SexWithTopCount             int
	SexWithBottomCount          int
	OralSceneCount              int
	OralTopCount                int
	OralBottomCount             int
	OralWithTopCount            int
	OralWithBottomCount         int
	SoloSceneCount              int
	FacialSceneCount            int
	FacialTopCount              int
	FacialBottomCount           int
	FacialWithTopCount          int
	FacialWithBottomCount       int
	FacialMarkerWithTopCount    int
	FacialMarkerWithBottomCount int
	SexUniquePartnerCount       int
	OralUniquePartnerCount      int
	FacialUniquePartnerCount    int
	OrgasmTopCount              int
	FacialMarkerCount           int
	FeetTopCount                int
}

// GetPerformerRoleStatsBatch computes all performer-card role stats for a page of performers.
// It replaces N performers * many field resolvers with a small set of marker queries plus
// batched performer/tag association fetches.
func GetPerformerRoleStatsBatch(
	ctx context.Context,
	markerQB models.SceneMarkerReader,
	tagFinder models.TagFinder,
	performerIDs []int,
	sexTagID, oralTagID, soloTagID, facialTagID, orgasmTagID, feetTagID, secondCameraTagID int,
) (map[int]*PerformerRoleStatsData, error) {
	result := make(map[int]*PerformerRoleStatsData, len(performerIDs))
	targets := make(map[int]bool, len(performerIDs))
	targetIDs := make([]int, 0, len(performerIDs))
	for _, id := range performerIDs {
		if id == 0 || targets[id] {
			continue
		}
		targets[id] = true
		targetIDs = append(targetIDs, id)
		result[id] = &PerformerRoleStatsData{PerformerID: id}
	}
	if len(targetIDs) == 0 {
		return result, nil
	}

	sexScenes, err := collectPrimaryTagScenesForPerformers(ctx, markerQB, tagFinder, targetIDs, targets, sexTagID, "")
	if err != nil {
		return nil, err
	}
	sexTopScenes, err := collectPrimaryTagScenesForPerformers(ctx, markerQB, tagFinder, targetIDs, targets, sexTagID, "top")
	if err != nil {
		return nil, err
	}
	sexBottomScenes, err := collectPrimaryTagScenesForPerformers(ctx, markerQB, tagFinder, targetIDs, targets, sexTagID, "bottom")
	if err != nil {
		return nil, err
	}
	for id, stats := range result {
		stats.SexSceneCount = len(sexScenes[id])
		stats.SexTopCount = len(sexTopScenes[id])
		stats.SexBottomCount = len(sexBottomScenes[id])
	}

	oralScenes, err := collectPrimaryTagScenesForPerformers(ctx, markerQB, tagFinder, targetIDs, targets, oralTagID, "")
	if err != nil {
		return nil, err
	}
	oralTopScenes, err := collectPrimaryTagScenesForPerformers(ctx, markerQB, tagFinder, targetIDs, targets, oralTagID, "top")
	if err != nil {
		return nil, err
	}
	oralBottomScenes, err := collectPrimaryTagScenesForPerformers(ctx, markerQB, tagFinder, targetIDs, targets, oralTagID, "bottom")
	if err != nil {
		return nil, err
	}
	for id, stats := range result {
		stats.OralSceneCount = countScenesExcluding(oralScenes[id], sexScenes[id])
		stats.OralTopCount = countScenesExcluding(oralTopScenes[id], sexScenes[id])
		stats.OralBottomCount = countScenesExcluding(oralBottomScenes[id], sexScenes[id])
	}

	soloScenes, err := collectPrimaryTagScenesForPerformers(ctx, markerQB, tagFinder, targetIDs, targets, soloTagID, "top")
	if err != nil {
		return nil, err
	}
	for id, stats := range result {
		stats.SoloSceneCount = countScenesExcluding(soloScenes[id], sexScenes[id], oralScenes[id])
	}

	facialScenes, err := collectPrimaryTagScenesForPerformers(ctx, markerQB, tagFinder, targetIDs, targets, facialTagID, "")
	if err != nil {
		return nil, err
	}
	for id, stats := range result {
		stats.FacialSceneCount = len(facialScenes[id])
	}

	if err := fillMarkerRoleStatsWithSecondary(ctx, markerQB, tagFinder, targetIDs, targets, result, facialTagID, orgasmTagID, feetTagID, secondCameraTagID); err != nil {
		return nil, err
	}
	if err := fillPartnerStats(ctx, markerQB, tagFinder, targetIDs, targets, result, sexTagID, oralTagID, facialTagID); err != nil {
		return nil, err
	}

	return result, nil
}

func collectPrimaryTagScenesForPerformers(
	ctx context.Context,
	markerQB models.SceneMarkerReader,
	tagFinder models.TagFinder,
	performerIDs []int,
	targets map[int]bool,
	tagID int,
	role string,
) (map[int]map[int]bool, error) {
	ret := make(map[int]map[int]bool, len(targets))
	for id := range targets {
		ret[id] = make(map[int]bool)
	}
	if tagID == 0 {
		return ret, nil
	}

	rows, _, err := queryPerformerMarkerRoleRows(ctx, markerQB, tagFinder, performerIDs, tagID, -1, role)
	if err != nil {
		return nil, err
	}

	for _, row := range rows {
		if !targets[row.PerformerID] || !roleMatches(row.Role, role) {
			continue
		}
		ret[row.PerformerID][row.SceneID] = true
	}

	return ret, nil
}

func fillMarkerRoleStatsWithSecondary(
	ctx context.Context,
	markerQB models.SceneMarkerReader,
	tagFinder models.TagFinder,
	performerIDs []int,
	targets map[int]bool,
	result map[int]*PerformerRoleStatsData,
	facialTagID, orgasmTagID, feetTagID, secondCameraTagID int,
) error {
	facialTags, err := expandedTagSet(ctx, tagFinder, facialTagID)
	if err != nil {
		return err
	}
	orgasmTags, err := expandedTagSet(ctx, tagFinder, orgasmTagID)
	if err != nil {
		return err
	}
	feetTags, err := expandedTagSet(ctx, tagFinder, feetTagID)
	if err != nil {
		return err
	}
	secondCameraTags, err := expandedTagSet(ctx, tagFinder, secondCameraTagID)
	if err != nil {
		return err
	}
	if len(facialTags) == 0 && len(orgasmTags) == 0 && len(feetTags) == 0 {
		return nil
	}

	rows, _, err := queryPerformerMarkerRoleRows(ctx, markerQB, tagFinder, performerIDs, 0, -1, "")
	if err != nil {
		return err
	}
	markerIDs := markerIDsFromRoleRows(rows)
	tagsByMarker, err := markerQB.GetTagIDsForMarkers(ctx, markerIDs)
	if err != nil {
		return err
	}

	countedFacialAny := make(map[int]map[int]bool)
	for _, row := range rows {
		allTagIDs := append([]int{row.PrimaryTagID}, tagsByMarker[row.SceneMarkerID]...)
		if containsAnyTag(allTagIDs, secondCameraTags) {
			continue
		}

		hasFacial := containsAnyTag(allTagIDs, facialTags)
		hasOrgasm := containsAnyTag(allTagIDs, orgasmTags)
		hasFeet := containsAnyTag(allTagIDs, feetTags)
		if !hasFacial && !hasOrgasm && !hasFeet {
			continue
		}

		if !targets[row.PerformerID] {
			continue
		}
		stats := result[row.PerformerID]
		if hasFacial {
			if countedFacialAny[row.SceneMarkerID] == nil {
				countedFacialAny[row.SceneMarkerID] = make(map[int]bool)
			}
			if !countedFacialAny[row.SceneMarkerID][row.PerformerID] && (row.Role == "top" || row.Role == "bottom") {
				stats.FacialMarkerCount++
				countedFacialAny[row.SceneMarkerID][row.PerformerID] = true
			}
			if row.Role == "top" {
				stats.FacialTopCount++
				stats.FacialMarkerWithTopCount++
			}
			if row.Role == "bottom" {
				stats.FacialBottomCount++
				stats.FacialMarkerWithBottomCount++
			}
		}
		if row.Role == "top" {
			if hasOrgasm {
				stats.OrgasmTopCount++
			}
			if hasFeet {
				stats.FeetTopCount++
			}
		}
	}

	return nil
}

func fillPartnerStats(
	ctx context.Context,
	markerQB models.SceneMarkerReader,
	tagFinder models.TagFinder,
	performerIDs []int,
	targets map[int]bool,
	result map[int]*PerformerRoleStatsData,
	sexTagID, oralTagID, facialTagID int,
) error {
	type partnerSets struct {
		asTop    map[int]map[int]bool
		asBottom map[int]map[int]bool
	}

	collect := func(tagID int, depth int) (*partnerSets, error) {
		ret := &partnerSets{
			asTop:    make(map[int]map[int]bool, len(targets)),
			asBottom: make(map[int]map[int]bool, len(targets)),
		}
		for id := range targets {
			ret.asTop[id] = make(map[int]bool)
			ret.asBottom[id] = make(map[int]bool)
		}
		if tagID == 0 {
			return ret, nil
		}

		partnerRows, usedFastPath, err := queryPerformerPartnerRoleRows(ctx, markerQB, tagFinder, performerIDs, tagID, depth)
		if err != nil {
			return nil, err
		}
		if usedFastPath {
			for _, row := range partnerRows {
				if !targets[row.PerformerID] {
					continue
				}
				switch row.Role {
				case "top":
					ret.asTop[row.PerformerID][row.PartnerID] = true
				case "bottom":
					ret.asBottom[row.PerformerID][row.PartnerID] = true
				}
			}
			return ret, nil
		}

		rows, performersByMarker, err := queryPerformerMarkerRoleRows(ctx, markerQB, tagFinder, performerIDs, tagID, depth, "")
		if err != nil {
			return nil, err
		}

		seenMarkers := make(map[int]bool)
		for _, row := range rows {
			if seenMarkers[row.SceneMarkerID] {
				continue
			}
			seenMarkers[row.SceneMarkerID] = true

			tops := make([]int, 0)
			bottoms := make([]int, 0)
			for _, mp := range performersByMarker[row.SceneMarkerID] {
				switch mp.Role {
				case "top":
					tops = append(tops, mp.PerformerID)
				case "bottom":
					bottoms = append(bottoms, mp.PerformerID)
				}
			}
			for _, id := range tops {
				if !targets[id] {
					continue
				}
				for _, partnerID := range bottoms {
					if partnerID != id {
						ret.asTop[id][partnerID] = true
					}
				}
			}
			for _, id := range bottoms {
				if !targets[id] {
					continue
				}
				for _, partnerID := range tops {
					if partnerID != id {
						ret.asBottom[id][partnerID] = true
					}
				}
			}
		}

		return ret, nil
	}

	sexPartners, err := collect(sexTagID, 0)
	if err != nil {
		return err
	}
	oralPartners, err := collect(oralTagID, -1)
	if err != nil {
		return err
	}
	facialPartners, err := collect(facialTagID, -1)
	if err != nil {
		return err
	}

	for id, stats := range result {
		stats.SexWithTopCount = len(sexPartners.asTop[id])
		stats.SexWithBottomCount = len(sexPartners.asBottom[id])
		stats.SexUniquePartnerCount = countUniqueInts(sexPartners.asTop[id], sexPartners.asBottom[id])
		stats.OralWithTopCount = len(oralPartners.asTop[id])
		stats.OralWithBottomCount = len(oralPartners.asBottom[id])
		stats.OralUniquePartnerCount = countUniqueInts(oralPartners.asTop[id], oralPartners.asBottom[id])
		stats.FacialWithTopCount = len(facialPartners.asTop[id])
		stats.FacialWithBottomCount = len(facialPartners.asBottom[id])
		stats.FacialUniquePartnerCount = countUniqueInts(facialPartners.asTop[id], facialPartners.asBottom[id])
	}

	return nil
}

type performerMarkerRoleRowReader interface {
	FindPerformerMarkerRoleRows(ctx context.Context, performerIDs []int, tagIDs []int, role string) ([]*models.PerformerMarkerRoleRow, error)
}

type performerPartnerRoleRowReader interface {
	FindPerformerPartnerRoleRows(ctx context.Context, performerIDs []int, tagIDs []int) ([]*models.PerformerPartnerRoleRow, error)
}

func queryPerformerPartnerRoleRows(
	ctx context.Context,
	markerQB models.SceneMarkerReader,
	tagFinder models.TagFinder,
	performerIDs []int,
	tagID int,
	depth int,
) ([]*models.PerformerPartnerRoleRow, bool, error) {
	fastReader, ok := markerQB.(performerPartnerRoleRowReader)
	if !ok {
		return nil, false, nil
	}

	tagIDs, err := expandedTagIDs(ctx, tagFinder, tagID, depth)
	if err != nil {
		return nil, false, err
	}
	rows, err := fastReader.FindPerformerPartnerRoleRows(ctx, performerIDs, tagIDs)
	if err != nil {
		return nil, false, err
	}
	return rows, true, nil
}

func queryPerformerMarkerRoleRows(
	ctx context.Context,
	markerQB models.SceneMarkerReader,
	tagFinder models.TagFinder,
	performerIDs []int,
	tagID int,
	depth int,
	role string,
) ([]*models.PerformerMarkerRoleRow, map[int][]*models.MarkerPerformer, error) {
	if fastReader, ok := markerQB.(performerMarkerRoleRowReader); ok {
		tagIDs, err := expandedTagIDs(ctx, tagFinder, tagID, depth)
		if err != nil {
			return nil, nil, err
		}
		rows, err := fastReader.FindPerformerMarkerRoleRows(ctx, performerIDs, tagIDs, role)
		if err != nil {
			return nil, nil, err
		}
		performersByMarker, err := markerQB.GetPerformersForMarkers(ctx, markerIDsFromRoleRows(rows))
		if err != nil {
			return nil, nil, err
		}
		return rows, performersByMarker, nil
	}

	performerIDStrings := performerIDStringsFromInts(performerIDs)
	markers, performersByMarker, err := queryMarkersForPerformerBatch(ctx, markerQB, performerIDStrings, tagID, depth, role)
	if err != nil {
		return nil, nil, err
	}

	targets := make(map[int]bool, len(performerIDs))
	for _, id := range performerIDs {
		targets[id] = true
	}

	rows := make([]*models.PerformerMarkerRoleRow, 0)
	for _, marker := range markers {
		for _, mp := range performersByMarker[marker.ID] {
			if !targets[mp.PerformerID] || !roleMatches(mp.Role, role) {
				continue
			}
			rows = append(rows, &models.PerformerMarkerRoleRow{
				SceneMarkerID: marker.ID,
				SceneID:       marker.SceneID,
				PrimaryTagID:  marker.PrimaryTagID,
				PerformerID:   mp.PerformerID,
				Role:          mp.Role,
			})
		}
	}

	return rows, performersByMarker, nil
}

func queryMarkersForPerformerBatch(
	ctx context.Context,
	markerQB models.SceneMarkerReader,
	performerIDStrings []string,
	tagID int,
	depth int,
	role string,
) ([]*models.SceneMarker, map[int][]*models.MarkerPerformer, error) {
	group := models.SceneMarkerTagGroupInput{}
	if tagID != 0 {
		group.TagIDs = []string{strconv.Itoa(tagID)}
		group.Depth = &depth
	}
	switch role {
	case "top":
		group.TopPerformerIDs = performerIDStrings
	case "bottom":
		group.BottomPerformerIDs = performerIDStrings
	default:
		group.TopPerformerIDs = performerIDStrings
		group.BottomPerformerIDs = performerIDStrings
	}
	performerMode := "OR"
	group.PerformerMode = &performerMode

	filter := &models.SceneMarkerFilterType{
		SceneMarkerTags: &models.SceneMarkerTagsCriterionInput{
			Modifier:       models.CriterionModifierEquals,
			GroupsExtended: []models.SceneMarkerTagGroupInput{group},
		},
	}
	allResults := -1
	findFilter := &models.FindFilterType{PerPage: &allResults}

	markers, _, err := markerQB.Query(ctx, filter, findFilter)
	if err != nil {
		return nil, nil, err
	}
	markerIDs := make([]int, len(markers))
	for i, marker := range markers {
		markerIDs[i] = marker.ID
	}
	performersByMarker, err := markerQB.GetPerformersForMarkers(ctx, markerIDs)
	if err != nil {
		return nil, nil, err
	}

	return markers, performersByMarker, nil
}

func expandedTagIDs(ctx context.Context, tagFinder models.TagFinder, tagID int, depth int) ([]int, error) {
	if tagID == 0 {
		return nil, nil
	}

	ret := []int{tagID}
	if depth == 0 {
		return ret, nil
	}

	descendants, err := tagFinder.FindAllDescendants(ctx, tagID, nil)
	if err != nil {
		return nil, err
	}
	for _, tag := range descendants {
		ret = append(ret, tag.ID)
	}
	return ret, nil
}

func expandedTagSet(ctx context.Context, tagFinder models.TagFinder, tagID int) (map[int]bool, error) {
	ret := make(map[int]bool)
	if tagID == 0 {
		return ret, nil
	}
	ret[tagID] = true
	descendants, err := tagFinder.FindAllDescendants(ctx, tagID, nil)
	if err != nil {
		return nil, err
	}
	for _, tag := range descendants {
		ret[tag.ID] = true
	}
	return ret, nil
}

func containsAnyTag(tagIDs []int, tagSet map[int]bool) bool {
	if len(tagSet) == 0 {
		return false
	}
	for _, tagID := range tagIDs {
		if tagSet[tagID] {
			return true
		}
	}
	return false
}

func roleMatches(actual string, expected string) bool {
	return expected == "" || actual == expected
}

func countScenesExcluding(sceneSet map[int]bool, exclusions ...map[int]bool) int {
	count := 0
	for sceneID := range sceneSet {
		excluded := false
		for _, exclusion := range exclusions {
			if exclusion[sceneID] {
				excluded = true
				break
			}
		}
		if !excluded {
			count++
		}
	}
	return count
}

func countUniqueInts(sets ...map[int]bool) int {
	unique := make(map[int]bool)
	for _, set := range sets {
		for id := range set {
			unique[id] = true
		}
	}
	return len(unique)
}

func performerIDStringsFromInts(ids []int) []string {
	ret := make([]string, 0, len(ids))
	for _, id := range ids {
		if id == 0 {
			continue
		}
		ret = append(ret, strconv.Itoa(id))
	}
	return ret
}

func markerIDsFromRoleRows(rows []*models.PerformerMarkerRoleRow) []int {
	ret := make([]int, 0, len(rows))
	seen := make(map[int]bool, len(rows))
	for _, row := range rows {
		if seen[row.SceneMarkerID] {
			continue
		}
		seen[row.SceneMarkerID] = true
		ret = append(ret, row.SceneMarkerID)
	}
	return ret
}

// CUSTOM: end
