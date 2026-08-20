package api

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/stashapp/stash/internal/manager"
	"github.com/stashapp/stash/internal/manager/config"
	"github.com/stashapp/stash/pkg/sqlite"
)

// queryStudioListStatsCustom calculates all studio-card aggregates in a small
// number of page-level queries instead of resolving each field per studio.
func queryStudioListStatsCustom(ctx context.Context, studioIDs []int, activeSort string) ([]*StudioListStats, error) {
	statsByID := make(map[int]*StudioListStats, len(studioIDs))
	for _, studioID := range studioIDs {
		statsByID[studioID] = &StudioListStats{
			StudioID:            fmt.Sprintf("%d", studioID),
			StudioRoleCounts:    &StudioRoleCounts{},
			StudioActivityStats: activityStatsEmptyStudioCustom(),
		}
	}

	if len(studioIDs) == 0 {
		return []*StudioListStats{}, nil
	}

	if err := queryStudioListBasicStatsCustom(ctx, studioIDs, statsByID); err != nil {
		return nil, err
	}

	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, oralTagID, soloTagID, facialTagID, _, _, _ := getRoleTagIDs(uiConfig)
	if err := queryStudioListRoleStatsCustom(ctx, studioIDs, statsByID, sexTagID, oralTagID, soloTagID, facialTagID); err != nil {
		return nil, err
	}

	if err := queryStudioListActivityStatsCustom(ctx, studioIDs, statsByID); err != nil {
		return nil, err
	}
	if err := queryStudioListActiveSortValuesCustom(ctx, studioIDs, activeSort, statsByID); err != nil {
		return nil, err
	}

	ret := make([]*StudioListStats, 0, len(studioIDs))
	for _, studioID := range studioIDs {
		ret = append(ret, statsByID[studioID])
	}

	return ret, nil
}

func queryStudioListActiveSortValuesCustom(ctx context.Context, studioIDs []int, activeSort string, statsByID map[int]*StudioListStats) error {
	expression, ok := sqlite.StudioSortMetricExpressionCustom(activeSort)
	if !ok {
		return nil
	}

	query := fmt.Sprintf(`
WITH requested(id) AS (VALUES %s)
SELECT studios.id, %s
FROM studios
JOIN requested ON requested.id = studios.id`, studioListRequestedValuesCustom(len(studioIDs)), expression)
	_, rows, err := manager.GetInstance().Database.QuerySQL(ctx, query, studioListIDArgsCustom(studioIDs))
	if err != nil {
		return err
	}

	for _, row := range rows {
		if len(row) < 2 || row[1] == nil {
			continue
		}
		stats := statsByID[activityStatsIntCustom(row[0])]
		if stats == nil {
			continue
		}
		value := fmt.Sprint(row[1])
		if bytes, ok := row[1].([]byte); ok {
			value = string(bytes)
		}
		stats.ActiveSortValue = &value
	}

	return nil
}

func studioListRequestedValuesCustom(count int) string {
	return strings.TrimSuffix(strings.Repeat("(?),", count), ",")
}

func studioListIDArgsCustom(studioIDs []int) []interface{} {
	ret := make([]interface{}, len(studioIDs))
	for i, studioID := range studioIDs {
		ret[i] = studioID
	}
	return ret
}

func queryStudioListBasicStatsCustom(ctx context.Context, studioIDs []int, statsByID map[int]*StudioListStats) error {
	query := fmt.Sprintf(`
WITH RECURSIVE requested(id) AS (VALUES %s),
studio_scope(root_id, studio_id) AS (
  SELECT id, id FROM requested
  UNION ALL
  SELECT studio_scope.root_id, studios.id
  FROM studios
  JOIN studio_scope ON studios.parent_id = studio_scope.studio_id
),
scene_counts AS (
  SELECT scenes.studio_id, COUNT(*) AS value
  FROM scenes
  JOIN requested ON requested.id = scenes.studio_id
  GROUP BY scenes.studio_id
),
image_counts AS (
  SELECT images.studio_id, COUNT(*) AS value
  FROM images
  JOIN requested ON requested.id = images.studio_id
  GROUP BY images.studio_id
),
gallery_counts AS (
  SELECT galleries.studio_id, COUNT(*) AS value
  FROM galleries
  JOIN requested ON requested.id = galleries.studio_id
  GROUP BY galleries.studio_id
),
group_counts AS (
  SELECT groups.studio_id, COUNT(*) AS value
  FROM groups
  JOIN requested ON requested.id = groups.studio_id
  GROUP BY groups.studio_id
),
performer_studios AS (
  SELECT scenes.studio_id, performers_scenes.performer_id
  FROM scenes
  JOIN requested ON requested.id = scenes.studio_id
  JOIN performers_scenes ON performers_scenes.scene_id = scenes.id
  UNION
  SELECT images.studio_id, performers_images.performer_id
  FROM images
  JOIN requested ON requested.id = images.studio_id
  JOIN performers_images ON performers_images.image_id = images.id
  UNION
  SELECT galleries.studio_id, performers_galleries.performer_id
  FROM galleries
  JOIN requested ON requested.id = galleries.studio_id
  JOIN performers_galleries ON performers_galleries.gallery_id = galleries.id
),
performer_counts AS (
  SELECT performer_studios.studio_id, COUNT(*) AS value
  FROM performer_studios
  GROUP BY performer_studios.studio_id
),
single_scene_performers AS (
  SELECT performers_scenes.performer_id
  FROM performers_scenes
  GROUP BY performers_scenes.performer_id
  HAVING COUNT(*) = 1
),
unique_performers AS (
  SELECT performer_studios.studio_id, COUNT(*) AS value
  FROM performer_studios
  JOIN single_scene_performers ON single_scene_performers.performer_id = performer_studios.performer_id
  GROUP BY performer_studios.studio_id
),
scene_o_counts AS (
  SELECT studio_scope.root_id, COUNT(*) AS value
  FROM studio_scope
  JOIN scenes ON scenes.studio_id = studio_scope.studio_id
  JOIN scenes_o_dates ON scenes_o_dates.scene_id = scenes.id
  GROUP BY studio_scope.root_id
),
image_o_counts AS (
  SELECT studio_scope.root_id, COALESCE(SUM(images.o_counter), 0) AS value
  FROM studio_scope
  JOIN images ON images.studio_id = studio_scope.studio_id
  GROUP BY studio_scope.root_id
)
SELECT requested.id,
       COALESCE(scene_counts.value, 0),
       COALESCE(image_counts.value, 0),
       COALESCE(gallery_counts.value, 0),
       COALESCE(performer_counts.value, 0),
       COALESCE(group_counts.value, 0),
       COALESCE(scene_o_counts.value, 0) + COALESCE(image_o_counts.value, 0),
       COALESCE(unique_performers.value, 0)
FROM requested
LEFT JOIN scene_counts ON scene_counts.studio_id = requested.id
LEFT JOIN image_counts ON image_counts.studio_id = requested.id
LEFT JOIN gallery_counts ON gallery_counts.studio_id = requested.id
LEFT JOIN performer_counts ON performer_counts.studio_id = requested.id
LEFT JOIN group_counts ON group_counts.studio_id = requested.id
LEFT JOIN scene_o_counts ON scene_o_counts.root_id = requested.id
LEFT JOIN image_o_counts ON image_o_counts.root_id = requested.id
LEFT JOIN unique_performers ON unique_performers.studio_id = requested.id`, studioListRequestedValuesCustom(len(studioIDs)))

	_, rows, err := manager.GetInstance().Database.QuerySQL(ctx, query, studioListIDArgsCustom(studioIDs))
	if err != nil {
		return err
	}

	for _, row := range rows {
		if len(row) < 8 {
			continue
		}
		studioID := activityStatsIntCustom(row[0])
		stats := statsByID[studioID]
		if stats == nil {
			continue
		}
		stats.SceneCount = activityStatsIntCustom(row[1])
		stats.ImageCount = activityStatsIntCustom(row[2])
		stats.GalleryCount = activityStatsIntCustom(row[3])
		stats.PerformerCount = activityStatsIntCustom(row[4])
		stats.GroupCount = activityStatsIntCustom(row[5])
		stats.OCounter = activityStatsIntCustom(row[6])
		stats.UniquePerformerCount = activityStatsIntCustom(row[7])
	}

	return nil
}

func queryStudioListRoleStatsCustom(ctx context.Context, studioIDs []int, statsByID map[int]*StudioListStats, sexTagID, oralTagID, soloTagID, facialTagID int) error {
	if sexTagID == 0 && oralTagID == 0 && soloTagID == 0 && facialTagID == 0 {
		return nil
	}

	query := fmt.Sprintf(`
WITH RECURSIVE requested(id) AS (VALUES %s),
role_tags(role, tag_id) AS (
  SELECT 'sex', ?
  UNION SELECT 'oral', ?
  UNION SELECT 'solo', ?
  UNION SELECT 'facial', ?
  UNION
  SELECT role_tags.role, tags_relations.child_id
  FROM role_tags
  JOIN tags_relations ON tags_relations.parent_id = role_tags.tag_id
),
marker_tags(scene_id, tag_id) AS (
  SELECT scene_markers.scene_id, scene_markers.primary_tag_id
  FROM scene_markers
  UNION
  SELECT scene_markers.scene_id, scene_markers_tags.tag_id
  FROM scene_markers
  JOIN scene_markers_tags ON scene_markers_tags.scene_marker_id = scene_markers.id
),
scene_roles AS (
  SELECT scenes.studio_id,
         scenes.id AS scene_id,
         MAX(CASE WHEN role_tags.role = 'sex' THEN 1 ELSE 0 END) AS has_sex,
         MAX(CASE WHEN role_tags.role = 'oral' THEN 1 ELSE 0 END) AS has_oral,
         MAX(CASE WHEN role_tags.role = 'solo' THEN 1 ELSE 0 END) AS has_solo,
         MAX(CASE WHEN role_tags.role = 'facial' THEN 1 ELSE 0 END) AS has_facial
  FROM scenes
  JOIN requested ON requested.id = scenes.studio_id
  JOIN marker_tags ON marker_tags.scene_id = scenes.id
  JOIN role_tags ON role_tags.tag_id = marker_tags.tag_id
  GROUP BY scenes.studio_id, scenes.id
)
SELECT requested.id,
       COALESCE(SUM(CASE WHEN scene_roles.has_sex = 1 THEN 1 ELSE 0 END), 0),
       COALESCE(SUM(CASE WHEN scene_roles.has_oral = 1 AND scene_roles.has_sex = 0 THEN 1 ELSE 0 END), 0),
       COALESCE(SUM(CASE WHEN scene_roles.has_solo = 1 AND scene_roles.has_sex = 0 AND scene_roles.has_oral = 0 THEN 1 ELSE 0 END), 0),
       COALESCE(SUM(CASE WHEN scene_roles.has_facial = 1 THEN 1 ELSE 0 END), 0)
FROM requested
LEFT JOIN scene_roles ON scene_roles.studio_id = requested.id
GROUP BY requested.id`, studioListRequestedValuesCustom(len(studioIDs)))

	args := studioListIDArgsCustom(studioIDs)
	args = append(args, sexTagID, oralTagID, soloTagID, facialTagID)
	_, rows, err := manager.GetInstance().Database.QuerySQL(ctx, query, args)
	if err != nil {
		return err
	}

	applyStudioListRoleRowsCustom(rows, statsByID)
	return nil
}

func applyStudioListRoleRowsCustom(rows [][]interface{}, statsByID map[int]*StudioListStats) {
	for _, row := range rows {
		if len(row) < 5 {
			continue
		}
		stats := statsByID[activityStatsIntCustom(row[0])]
		if stats == nil {
			continue
		}
		stats.StudioRoleCounts = &StudioRoleCounts{
			SexSceneCount:    activityStatsIntCustom(row[1]),
			OralSceneCount:   activityStatsIntCustom(row[2]),
			SoloSceneCount:   activityStatsIntCustom(row[3]),
			FacialSceneCount: activityStatsIntCustom(row[4]),
		}
	}
}

type studioListActivityMarkerCustom struct {
	sceneID        int
	start          float64
	end            float64
	primaryTagID   int
	secondaryCount int
	isGoat         bool
	isOrgasm       bool
	isReallyHot    bool
}

type studioListNegativeMarkerCustom struct {
	sceneID int
	start   float64
	end     float64
}

func queryStudioListActivityStatsCustom(ctx context.Context, studioIDs []int, statsByID map[int]*StudioListStats) error {
	sexTagID, oralTagID, soloTagID, goatTagID := activityStatsRoleTagIDsCustom()
	uiConfig := config.GetInstance().GetUIConfiguration()
	_, _, _, _, orgasmTagID, _, _ := getRoleTagIDs(uiConfig)
	roleTagIDs, _ := uiConfig["roleTagIds"].(map[string]interface{})
	reallyHotTagID, _ := strconv.Atoi(customStringConfigValue(roleTagIDs["reallyHotTagId"]))
	if sexTagID == 0 && oralTagID == 0 && soloTagID == 0 {
		return nil
	}

	requested := studioListRequestedValuesCustom(len(studioIDs))
	args := studioListIDArgsCustom(studioIDs)
	durationQuery := fmt.Sprintf(`
WITH requested(id) AS (VALUES %s)
SELECT scenes.studio_id, scenes.id, COALESCE(MAX(video_files.duration), 0)
FROM scenes
JOIN requested ON requested.id = scenes.studio_id
LEFT JOIN scenes_files ON scenes_files.scene_id = scenes.id
LEFT JOIN video_files ON video_files.file_id = scenes_files.file_id
GROUP BY scenes.studio_id, scenes.id`, requested)

	_, durationRows, err := manager.GetInstance().Database.QuerySQL(ctx, durationQuery, args)
	if err != nil {
		return err
	}

	markerQuery := fmt.Sprintf(`
WITH requested(id) AS (VALUES %s)
SELECT scenes.studio_id,
       scene_markers.scene_id,
       scene_markers.seconds,
       scene_markers.end_seconds,
       scene_markers.primary_tag_id,
       COUNT(scene_markers_tags.tag_id),
       %s,
       %s,
       %s
FROM scene_markers
JOIN scenes ON scenes.id = scene_markers.scene_id
JOIN requested ON requested.id = scenes.studio_id
LEFT JOIN scene_markers_tags ON scene_markers_tags.scene_marker_id = scene_markers.id
WHERE scene_markers.end_seconds IS NOT NULL
  AND scene_markers.end_seconds > scene_markers.seconds
GROUP BY scenes.studio_id,
         scene_markers.id,
         scene_markers.scene_id,
         scene_markers.seconds,
         scene_markers.end_seconds,
		 scene_markers.primary_tag_id`,
		requested,
		activityStatsGoatMarkerSQLCustom("scene_markers", goatTagID),
		activityStatsMarkerHasTagSQLCustom("scene_markers", orgasmTagID),
		activityStatsMarkerHasTagSQLCustom("scene_markers", reallyHotTagID))

	_, markerRows, err := manager.GetInstance().Database.QuerySQL(ctx, markerQuery, args)
	if err != nil {
		return err
	}

	negativeMarkerQuery := fmt.Sprintf(`
WITH requested(id) AS (VALUES %s)
SELECT scenes.studio_id,
       scene_negative_markers.scene_id,
       scene_negative_markers.start_seconds,
       scene_negative_markers.end_seconds
FROM scene_negative_markers
JOIN scenes ON scenes.id = scene_negative_markers.scene_id
JOIN requested ON requested.id = scenes.studio_id
WHERE scene_negative_markers.end_seconds > scene_negative_markers.start_seconds`, requested)

	_, negativeMarkerRows, err := manager.GetInstance().Database.QuerySQL(ctx, negativeMarkerQuery, args)
	if err != nil {
		return err
	}

	durationsByStudio := make(map[int]map[int]float64, len(studioIDs))
	for _, row := range durationRows {
		if len(row) < 3 {
			continue
		}
		studioID := activityStatsIntCustom(row[0])
		if durationsByStudio[studioID] == nil {
			durationsByStudio[studioID] = make(map[int]float64)
		}
		durationsByStudio[studioID][activityStatsIntCustom(row[1])] = activityStatsFloatCustom(row[2])
	}

	markersByStudio := make(map[int][]studioListActivityMarkerCustom, len(studioIDs))
	for _, row := range markerRows {
		if len(row) < 9 {
			continue
		}
		studioID := activityStatsIntCustom(row[0])
		markersByStudio[studioID] = append(markersByStudio[studioID], studioListActivityMarkerCustom{
			sceneID:        activityStatsIntCustom(row[1]),
			start:          activityStatsFloatCustom(row[2]),
			end:            activityStatsFloatCustom(row[3]),
			primaryTagID:   activityStatsIntCustom(row[4]),
			secondaryCount: activityStatsIntCustom(row[5]),
			isGoat:         activityStatsBoolCustom(row[6]),
			isOrgasm:       activityStatsBoolCustom(row[7]),
			isReallyHot:    activityStatsBoolCustom(row[8]),
		})
	}

	negativeMarkersByStudio := make(map[int][]studioListNegativeMarkerCustom, len(studioIDs))
	for _, row := range negativeMarkerRows {
		if len(row) < 4 {
			continue
		}
		studioID := activityStatsIntCustom(row[0])
		negativeMarkersByStudio[studioID] = append(negativeMarkersByStudio[studioID], studioListNegativeMarkerCustom{
			sceneID: activityStatsIntCustom(row[1]),
			start:   activityStatsFloatCustom(row[2]),
			end:     activityStatsFloatCustom(row[3]),
		})
	}

	for _, studioID := range studioIDs {
		statsByID[studioID].StudioActivityStats = calculateStudioListActivityStatsCustom(
			durationsByStudio[studioID],
			markersByStudio[studioID],
			negativeMarkersByStudio[studioID],
			sexTagID,
			oralTagID,
			soloTagID,
		)
	}

	return nil
}

func calculateStudioListActivityStatsCustom(
	sceneDurations map[int]float64,
	markers []studioListActivityMarkerCustom,
	negativeMarkers []studioListNegativeMarkerCustom,
	sexTagID, oralTagID, soloTagID int,
) *StudioActivityStats {
	if len(sceneDurations) == 0 {
		return activityStatsEmptyStudioCustom()
	}

	byCategory := map[activityCategoryCustom][]activityIntervalCustom{
		activitySexCustom:         {},
		activityOralCustom:        {},
		activitySoloCustom:        {},
		activityOutstandingCustom: {},
		activityUnusableCustom:    {},
	}
	sceneCounts := map[activityCategoryCustom]map[int]bool{
		activitySexCustom:  {},
		activityOralCustom: {},
		activitySoloCustom: {},
	}
	meaningfulSceneIDs := map[int]bool{}

	for _, marker := range markers {
		sceneDuration, ok := sceneDurations[marker.sceneID]
		if !ok || sceneDuration <= 0 {
			continue
		}

		interval, ok := studioListClampedIntervalCustom(marker.sceneID, marker.start, marker.end, sceneDuration)
		if !ok {
			continue
		}

		if category, matched := activityStatsCategoryCustom(marker.primaryTagID, sexTagID, oralTagID, soloTagID); matched {
			byCategory[category] = append(byCategory[category], interval)
			sceneCounts[category][marker.sceneID] = true
			meaningfulSceneIDs[marker.sceneID] = true
		}
		if activityStatsIsOutstandingMarkerCustom(marker.primaryTagID, marker.secondaryCount, marker.isGoat, marker.isOrgasm, marker.isReallyHot, sexTagID, oralTagID, soloTagID) {
			byCategory[activityOutstandingCustom] = append(byCategory[activityOutstandingCustom], interval)
		}
	}

	for _, marker := range negativeMarkers {
		sceneDuration, ok := sceneDurations[marker.sceneID]
		if !ok || sceneDuration <= 0 {
			continue
		}
		interval, ok := studioListClampedIntervalCustom(marker.sceneID, marker.start, marker.end, sceneDuration)
		if ok {
			byCategory[activityUnusableCustom] = append(byCategory[activityUnusableCustom], interval)
		}
	}

	// Match the Studio Stats charts: only scenes containing at least one
	// in-bounds timed sex, oral, or solo primary marker contribute runtime.
	activityStatsRestrictToMeaningfulScenesCustom(sceneDurations, byCategory, meaningfulSceneIDs)

	var totalSeconds float64
	for _, duration := range sceneDurations {
		totalSeconds += duration
	}
	if totalSeconds <= 0 {
		return activityStatsEmptyStudioCustom()
	}

	sexSeconds := activityStatsDurationCustom(byCategory[activitySexCustom])
	oralSeconds := activityStatsDurationCustom(byCategory[activityOralCustom])
	soloSeconds := activityStatsDurationCustom(byCategory[activitySoloCustom])
	unusableSeconds := activityStatsDurationCustom(byCategory[activityUnusableCustom])
	activityIntervals := append(append(
		append([]activityIntervalCustom{}, byCategory[activitySexCustom]...),
		byCategory[activityOralCustom]...),
		byCategory[activitySoloCustom]...,
	)
	activityOtherSeconds := activityStatsActivityOtherSecondsCustom(totalSeconds, activityIntervals)
	outstandingSeconds := activityStatsDurationCustom(activityStatsSubtractIntervalsCustom(
		byCategory[activityOutstandingCustom],
		byCategory[activityUnusableCustom],
	))
	standardSeconds := activityStatsOtherSecondsCustom(
		totalSeconds,
		byCategory[activityOutstandingCustom],
		byCategory[activityUnusableCustom],
	)
	otherSeconds := activityStatsOtherSecondsCustom(totalSeconds, activityIntervals, byCategory[activityUnusableCustom])

	return &StudioActivityStats{
		TotalSeconds:         totalSeconds,
		SexSeconds:           sexSeconds,
		OralSeconds:          oralSeconds,
		SoloSeconds:          soloSeconds,
		OtherSeconds:         otherSeconds,
		ActivityOtherSeconds: activityOtherSeconds,
		OutstandingSeconds:   outstandingSeconds,
		StandardSeconds:      standardSeconds,
		UnusableSeconds:      unusableSeconds,
		SexPercent:           activityStatsPercentCustom(sexSeconds, totalSeconds),
		OralPercent:          activityStatsPercentCustom(oralSeconds, totalSeconds),
		SoloPercent:          activityStatsPercentCustom(soloSeconds, totalSeconds),
		OtherPercent:         activityStatsPercentCustom(otherSeconds, totalSeconds),
		ActivityOtherPercent: activityStatsPercentCustom(activityOtherSeconds, totalSeconds),
		OutstandingPercent:   activityStatsPercentCustom(outstandingSeconds, totalSeconds),
		StandardPercent:      activityStatsPercentCustom(standardSeconds, totalSeconds),
		UnusablePercent:      activityStatsPercentCustom(unusableSeconds, totalSeconds),
		SexSceneCount:        len(sceneCounts[activitySexCustom]),
		OralSceneCount:       len(sceneCounts[activityOralCustom]),
		SoloSceneCount:       len(sceneCounts[activitySoloCustom]),
	}
}

func studioListClampedIntervalCustom(sceneID int, start, end, sceneDuration float64) (activityIntervalCustom, bool) {
	if start < 0 {
		start = 0
	}
	if end > sceneDuration {
		end = sceneDuration
	}
	if end <= start {
		return activityIntervalCustom{}, false
	}
	return activityIntervalCustom{sceneID: sceneID, start: start, end: end}, true
}
