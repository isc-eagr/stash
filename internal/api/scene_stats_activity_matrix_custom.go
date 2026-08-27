package api

// CUSTOM: Global, studio-scoped, and performer-scoped total-only Activity Matrix aggregation.

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strconv"

	"github.com/stashapp/stash/internal/manager"
	"github.com/stashapp/stash/internal/manager/config"
)

type sceneStatsActivityMatrixMarkerCustom struct {
	sceneID       int
	markerID      int
	seconds       float64
	endSeconds    *float64
	sceneDuration float64
	tagIDs        map[int]struct{}
}

type sceneStatsActivityMatrixTagCustom struct {
	id   int
	name string
}

type sceneStatsActivityMatrixValueCustom struct {
	tagID       int
	tagName     string
	duration    float64
	markerCount int
	percent     float64
}

type sceneStatsActivityMatrixFamiliesCustom struct {
	activity     map[int]struct{}
	event        map[int]struct{}
	feet         map[int]struct{}
	qualifier    map[int]struct{}
	secondCamera map[int]struct{}
}

type sceneStatsActivityMatrixAccumulatorCustom struct {
	intervals []activityIntervalCustom
	markerIDs map[int]struct{}
	tag       sceneStatsActivityMatrixTagCustom
}

func sceneStatsActivityMatrixDescendantsCustom(root int, children map[int][]int) map[int]struct{} {
	ret := map[int]struct{}{}
	if root == 0 {
		return ret
	}

	stack := []int{root}
	for len(stack) > 0 {
		current := stack[len(stack)-1]
		stack = stack[:len(stack)-1]
		if _, exists := ret[current]; exists {
			continue
		}
		ret[current] = struct{}{}
		stack = append(stack, children[current]...)
	}
	return ret
}

func sceneStatsActivityMatrixUnionCustom(sets ...map[int]struct{}) map[int]struct{} {
	ret := map[int]struct{}{}
	for _, set := range sets {
		for id := range set {
			ret[id] = struct{}{}
		}
	}
	return ret
}

func sceneStatsActivityMatrixHasFamilyCustom(tagIDs map[int]struct{}, family map[int]struct{}) bool {
	for id := range tagIDs {
		if _, exists := family[id]; exists {
			return true
		}
	}
	return false
}

func sceneStatsActivityMatrixTargetsCustom(
	tagID int,
	parents map[int][]int,
	includeSubtags bool,
) map[int]struct{} {
	ret := map[int]struct{}{tagID: {}}
	if !includeSubtags {
		return ret
	}

	stack := append([]int(nil), parents[tagID]...)
	for len(stack) > 0 {
		current := stack[len(stack)-1]
		stack = stack[:len(stack)-1]
		if _, exists := ret[current]; exists {
			continue
		}
		ret[current] = struct{}{}
		stack = append(stack, parents[current]...)
	}
	return ret
}

func aggregateSceneStatsActivityMatrixCustom(
	markers []*sceneStatsActivityMatrixMarkerCustom,
	tags map[int]sceneStatsActivityMatrixTagCustom,
	families sceneStatsActivityMatrixFamiliesCustom,
	totalSceneSeconds float64,
	parents map[int][]int,
	includeSubtags bool,
) []sceneStatsActivityMatrixValueCustom {
	groups := map[int]*sceneStatsActivityMatrixAccumulatorCustom{}
	for _, marker := range markers {
		if marker == nil || sceneStatsActivityMatrixHasFamilyCustom(marker.tagIDs, families.secondCamera) {
			continue
		}

		seenTargets := map[int]struct{}{}
		for sourceTagID := range marker.tagIDs {
			_, sourceActivity := families.activity[sourceTagID]
			_, sourceEvent := families.event[sourceTagID]
			_, sourceFeet := families.feet[sourceTagID]
			_, sourceQualifier := families.qualifier[sourceTagID]
			if !sourceFeet && (sourceActivity || sourceEvent || sourceQualifier) {
				continue
			}

			for tagID := range sceneStatsActivityMatrixTargetsCustom(sourceTagID, parents, includeSubtags) {
				if _, seen := seenTargets[tagID]; seen {
					continue
				}
				_, activity := families.activity[tagID]
				_, event := families.event[tagID]
				_, feet := families.feet[tagID]
				_, qualifier := families.qualifier[tagID]
				if !feet && (activity || event || qualifier) {
					continue
				}

				tag, exists := tags[tagID]
				if !exists {
					continue
				}
				seenTargets[tagID] = struct{}{}
				group := groups[tagID]
				if group == nil {
					group = &sceneStatsActivityMatrixAccumulatorCustom{
						markerIDs: map[int]struct{}{},
						tag:       tag,
					}
					groups[tagID] = group
				}
				group.markerIDs[marker.markerID] = struct{}{}

				if marker.endSeconds == nil {
					continue
				}
				start := math.Max(0, marker.seconds)
				end := math.Max(0, *marker.endSeconds)
				if marker.sceneDuration > 0 {
					start = math.Min(start, marker.sceneDuration)
					end = math.Min(end, marker.sceneDuration)
				}
				if end > start {
					group.intervals = append(group.intervals, activityIntervalCustom{
						sceneID: marker.sceneID,
						start:   start,
						end:     end,
					})
				}
			}
		}
	}

	ret := make([]sceneStatsActivityMatrixValueCustom, 0, len(groups))
	for _, group := range groups {
		duration := activityStatsDurationCustom(group.intervals)
		percent := 0.0
		if totalSceneSeconds > 0 {
			percent = math.Min(100, math.Max(0, duration/totalSceneSeconds*100))
		}
		ret = append(ret, sceneStatsActivityMatrixValueCustom{
			tagID:       group.tag.id,
			tagName:     group.tag.name,
			duration:    duration,
			markerCount: len(group.markerIDs),
			percent:     percent,
		})
	}

	sort.Slice(ret, func(i, j int) bool {
		if ret[i].duration != ret[j].duration {
			return ret[i].duration > ret[j].duration
		}
		if ret[i].markerCount != ret[j].markerCount {
			return ret[i].markerCount > ret[j].markerCount
		}
		if ret[i].tagName != ret[j].tagName {
			return ret[i].tagName < ret[j].tagName
		}
		return ret[i].tagID < ret[j].tagID
	})
	return ret
}

func sceneStatsActivityMatrixDurationQueryCustom(sceneScope string) string {
	return sceneScope + `
SELECT s.id, COALESCE(SUM(vf.duration), 0)
FROM scenes s
LEFT JOIN scenes_files sf ON sf.scene_id = s.id
LEFT JOIN video_files vf ON vf.file_id = sf.file_id
WHERE s.id IN (SELECT id FROM selected_scenes)
GROUP BY s.id`
}

func sceneStatsActivityMatrixMarkerQueryCustom(sceneScope string, markerPerformerID *int) string {
	performerFilter := ""
	if markerPerformerID != nil {
		performerFilter = `
  AND EXISTS (
    SELECT 1 FROM scene_marker_performers smp
    WHERE smp.scene_marker_id = sm.id AND smp.performer_id = ?
  )`
	}

	return sceneScope + `
SELECT sm.scene_id, sm.id, sm.seconds, sm.end_seconds, sm.primary_tag_id
FROM scene_markers sm
WHERE sm.scene_id IN (SELECT id FROM selected_scenes)` + performerFilter + `
UNION ALL
SELECT sm.scene_id, sm.id, sm.seconds, sm.end_seconds, smt.tag_id
FROM scene_markers sm
JOIN scene_markers_tags smt ON smt.scene_marker_id = sm.id
WHERE sm.scene_id IN (SELECT id FROM selected_scenes)` + performerFilter
}

func querySceneStatsActivityMatrixCustom(ctx context.Context, sceneScope string, args []interface{}, markerPerformerID *int, includeSubtags bool) ([]*SceneStatsActivityMatrixRow, error) {
	db := manager.GetInstance().Database
	_, tagRows, err := db.QuerySQL(ctx, "SELECT id, name FROM tags", nil)
	if err != nil {
		return nil, err
	}
	tags := make(map[int]sceneStatsActivityMatrixTagCustom, len(tagRows))
	for _, row := range tagRows {
		if len(row) < 2 {
			continue
		}
		id := customStatsIntValue(row[0])
		tags[id] = sceneStatsActivityMatrixTagCustom{id: id, name: customStatsStringValue(row[1])}
	}

	_, relationRows, err := db.QuerySQL(ctx, "SELECT parent_id, child_id FROM tags_relations", nil)
	if err != nil {
		return nil, err
	}
	children := map[int][]int{}
	parents := map[int][]int{}
	for _, row := range relationRows {
		if len(row) >= 2 {
			parentID := customStatsIntValue(row[0])
			childID := customStatsIntValue(row[1])
			children[parentID] = append(children[parentID], childID)
			parents[childID] = append(parents[childID], parentID)
		}
	}

	uiConfig := config.GetInstance().GetUIConfiguration()
	sex := sceneStatsActivityMatrixDescendantsCustom(configuredRoleTagIDCustom(uiConfig, "sexTagId"), children)
	oral := sceneStatsActivityMatrixDescendantsCustom(configuredRoleTagIDCustom(uiConfig, "oralTagId"), children)
	solo := sceneStatsActivityMatrixDescendantsCustom(configuredRoleTagIDCustom(uiConfig, "soloTagId"), children)
	facial := sceneStatsActivityMatrixDescendantsCustom(configuredRoleTagIDCustom(uiConfig, "facialTagId"), children)
	orgasm := sceneStatsActivityMatrixDescendantsCustom(configuredRoleTagIDCustom(uiConfig, "orgasmTagId"), children)
	feet := sceneStatsActivityMatrixDescendantsCustom(configuredRoleTagIDCustom(uiConfig, "feetTagId"), children)
	goat := sceneStatsActivityMatrixDescendantsCustom(configuredRoleTagIDCustom(uiConfig, "goatTagId"), children)
	reallyHot := sceneStatsActivityMatrixDescendantsCustom(configuredRoleTagIDCustom(uiConfig, "reallyHotTagId"), children)
	secondCamera := sceneStatsActivityMatrixDescendantsCustom(configuredRoleTagIDCustom(uiConfig, "secondCameraTagId"), children)
	families := sceneStatsActivityMatrixFamiliesCustom{
		activity:     sceneStatsActivityMatrixUnionCustom(sex, oral, solo),
		event:        sceneStatsActivityMatrixUnionCustom(facial, orgasm),
		feet:         feet,
		qualifier:    sceneStatsActivityMatrixUnionCustom(goat, reallyHot, secondCamera),
		secondCamera: secondCamera,
	}

	_, durationRows, err := db.QuerySQL(ctx, sceneStatsActivityMatrixDurationQueryCustom(sceneScope), args)
	if err != nil {
		return nil, err
	}
	sceneDurations := map[int]float64{}
	totalSceneSeconds := 0.0
	for _, row := range durationRows {
		if len(row) < 2 {
			continue
		}
		duration := customStatsFloatValue(row[1])
		sceneDurations[customStatsIntValue(row[0])] = duration
		totalSceneSeconds += duration
	}

	markerArgs := append([]interface{}{}, args...)
	if markerPerformerID != nil {
		markerArgs = append(markerArgs, *markerPerformerID, *markerPerformerID)
	}
	_, markerRows, err := db.QuerySQL(ctx, sceneStatsActivityMatrixMarkerQueryCustom(sceneScope, markerPerformerID), markerArgs)
	if err != nil {
		return nil, err
	}
	markersByID := map[int]*sceneStatsActivityMatrixMarkerCustom{}
	for _, row := range markerRows {
		if len(row) < 5 {
			continue
		}
		markerID := customStatsIntValue(row[1])
		marker := markersByID[markerID]
		if marker == nil {
			marker = &sceneStatsActivityMatrixMarkerCustom{
				sceneID:       customStatsIntValue(row[0]),
				markerID:      markerID,
				seconds:       customStatsFloatValue(row[2]),
				sceneDuration: sceneDurations[customStatsIntValue(row[0])],
				tagIDs:        map[int]struct{}{},
			}
			if row[3] != nil {
				value := customStatsFloatValue(row[3])
				marker.endSeconds = &value
			}
			markersByID[markerID] = marker
		}
		marker.tagIDs[customStatsIntValue(row[4])] = struct{}{}
	}
	markers := make([]*sceneStatsActivityMatrixMarkerCustom, 0, len(markersByID))
	for _, marker := range markersByID {
		markers = append(markers, marker)
	}

	values := aggregateSceneStatsActivityMatrixCustom(markers, tags, families, totalSceneSeconds, parents, includeSubtags)
	ret := make([]*SceneStatsActivityMatrixRow, 0, len(values))
	for _, value := range values {
		parentIDs := append([]int(nil), parents[value.tagID]...)
		sort.Ints(parentIDs)
		parentTagIDs := make([]string, 0, len(parentIDs))
		for _, parentID := range parentIDs {
			parentTagIDs = append(parentTagIDs, strconv.Itoa(parentID))
		}
		ret = append(ret, &SceneStatsActivityMatrixRow{
			TagID:        strconv.Itoa(value.tagID),
			TagName:      value.tagName,
			ParentTagIds: parentTagIDs,
			Duration:     value.duration,
			MarkerCount:  value.markerCount,
			Percent:      value.percent,
		})
	}
	return ret, nil
}

func sceneStatsActivityMatrixScopeCustom(studioID *string, depth *int, performerID *string) (string, []interface{}, *int, error) {
	if performerID == nil {
		scope, args, err := sceneStatsSceneScopeCustom(studioID, depth)
		return scope, args, nil, err
	}
	if studioID != nil {
		return "", nil, nil, fmt.Errorf("performer_id cannot be combined with studio_id")
	}

	parsedID, err := strconv.Atoi(*performerID)
	if err != nil || parsedID < 1 {
		return "", nil, nil, fmt.Errorf("invalid performer ID: %s", *performerID)
	}

	scope := `WITH selected_scenes(id) AS (
  SELECT DISTINCT scene_id FROM performers_scenes WHERE performer_id = ?
)`
	return scope, []interface{}{parsedID}, &parsedID, nil
}

func (r *queryResolver) SceneStatsActivityMatrix(ctx context.Context, studioID *string, depth *int, performerID *string, includeSubtags bool) (ret []*SceneStatsActivityMatrixRow, err error) {
	sceneScope, args, markerPerformerID, err := sceneStatsActivityMatrixScopeCustom(studioID, depth, performerID)
	if err != nil {
		return nil, err
	}
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = querySceneStatsActivityMatrixCustom(ctx, sceneScope, args, markerPerformerID, includeSubtags)
		return err
	}); err != nil {
		return nil, err
	}
	return ret, nil
}
