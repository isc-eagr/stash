package api

// CUSTOM: Shared duration stats for configured sex/oral/solo marker tags.

import (
	"context"
	"fmt"
	"sort"
	"strconv"

	"github.com/stashapp/stash/internal/manager"
	"github.com/stashapp/stash/internal/manager/config"
	"github.com/stashapp/stash/pkg/models"
)

type activityIntervalCustom struct {
	sceneID int
	start   float64
	end     float64
}

type activityCategoryCustom string

const (
	activitySexCustom         activityCategoryCustom = "sex"
	activityOralCustom        activityCategoryCustom = "oral"
	activitySoloCustom        activityCategoryCustom = "solo"
	activityOutstandingCustom activityCategoryCustom = "outstanding"
	activityUnusableCustom    activityCategoryCustom = "unusable"
)

func activityStatsIntCustom(v interface{}) int {
	switch t := v.(type) {
	case int:
		return t
	case int64:
		return int(t)
	case float64:
		return int(t)
	case []byte:
		i, _ := strconv.Atoi(string(t))
		return i
	case string:
		i, _ := strconv.Atoi(t)
		return i
	default:
		i, _ := strconv.Atoi(fmt.Sprint(t))
		return i
	}
}

func activityStatsFloatCustom(v interface{}) float64 {
	switch t := v.(type) {
	case float64:
		return t
	case float32:
		return float64(t)
	case int:
		return float64(t)
	case int64:
		return float64(t)
	case []byte:
		f, _ := strconv.ParseFloat(string(t), 64)
		return f
	case string:
		f, _ := strconv.ParseFloat(t, 64)
		return f
	default:
		f, _ := strconv.ParseFloat(fmt.Sprint(t), 64)
		return f
	}
}

func activityStatsBoolCustom(v interface{}) bool {
	return activityStatsIntCustom(v) != 0
}

func activityStatsPercentCustom(part float64, total float64) float64 {
	if total <= 0 {
		return 0
	}
	return (part / total) * 100
}

func activityStatsCategoryCustom(primaryTagID int, sexTagID int, oralTagID int, soloTagID int) (activityCategoryCustom, bool) {
	switch primaryTagID {
	case sexTagID:
		return activitySexCustom, sexTagID != 0
	case oralTagID:
		return activityOralCustom, oralTagID != 0
	case soloTagID:
		return activitySoloCustom, soloTagID != 0
	default:
		return "", false
	}
}

func activityStatsIsOutstandingMarkerCustom(primaryTagID int, secondaryTagCount int, isGoat bool, sexTagID int, oralTagID int, soloTagID int) bool {
	_, isRoleMarker := activityStatsCategoryCustom(primaryTagID, sexTagID, oralTagID, soloTagID)
	return isGoat || !isRoleMarker || secondaryTagCount > 0
}

func activityStatsGoatMarkerSQLCustom(markerAlias string, goatTagID int) string {
	if goatTagID == 0 {
		return "0"
	}

	return fmt.Sprintf(`EXISTS (
	WITH RECURSIVE goat_tags(id) AS (
		SELECT %[2]d
		UNION
		SELECT tags_relations.child_id
		FROM tags_relations
		JOIN goat_tags ON goat_tags.id = tags_relations.parent_id
	)
	SELECT 1
	FROM goat_tags
	WHERE goat_tags.id = %[1]s.primary_tag_id
	   OR goat_tags.id IN (
		SELECT scene_markers_tags.tag_id
		FROM scene_markers_tags
		WHERE scene_markers_tags.scene_marker_id = %[1]s.id
	   )
)`, markerAlias, goatTagID)
}

func activityStatsMergedIntervalsCustom(intervals []activityIntervalCustom) []activityIntervalCustom {
	if len(intervals) == 0 {
		return nil
	}

	sorted := append([]activityIntervalCustom{}, intervals...)
	sort.Slice(sorted, func(i, j int) bool {
		if sorted[i].sceneID != sorted[j].sceneID {
			return sorted[i].sceneID < sorted[j].sceneID
		}
		if sorted[i].start != sorted[j].start {
			return sorted[i].start < sorted[j].start
		}
		return sorted[i].end < sorted[j].end
	})

	merged := []activityIntervalCustom{}
	last := sorted[0]
	for _, interval := range sorted[1:] {
		if interval.sceneID != last.sceneID || interval.start > last.end {
			merged = append(merged, last)
			last = interval
			continue
		}
		if interval.end > last.end {
			last.end = interval.end
		}
	}

	merged = append(merged, last)
	return merged
}

func activityStatsDurationCustom(intervals []activityIntervalCustom) float64 {
	var total float64
	for _, interval := range activityStatsMergedIntervalsCustom(intervals) {
		total += interval.end - interval.start
	}
	return total
}

func activityStatsSubtractIntervalsCustom(intervals []activityIntervalCustom, subtractIntervals []activityIntervalCustom) []activityIntervalCustom {
	mergedIntervals := activityStatsMergedIntervalsCustom(intervals)
	mergedSubtractIntervals := activityStatsMergedIntervalsCustom(subtractIntervals)
	if len(mergedIntervals) == 0 || len(mergedSubtractIntervals) == 0 {
		return mergedIntervals
	}

	ret := []activityIntervalCustom{}
	for _, interval := range mergedIntervals {
		cursor := interval.start
		for _, subtractInterval := range mergedSubtractIntervals {
			if subtractInterval.sceneID < interval.sceneID {
				continue
			}
			if subtractInterval.sceneID > interval.sceneID || subtractInterval.start >= interval.end {
				break
			}
			if subtractInterval.end <= cursor {
				continue
			}
			if subtractInterval.start > cursor {
				ret = append(ret, activityIntervalCustom{
					sceneID: interval.sceneID,
					start:   cursor,
					end:     subtractInterval.start,
				})
			}
			if subtractInterval.end > cursor {
				cursor = subtractInterval.end
			}
			if cursor >= interval.end {
				break
			}
		}
		if cursor < interval.end {
			ret = append(ret, activityIntervalCustom{
				sceneID: interval.sceneID,
				start:   cursor,
				end:     interval.end,
			})
		}
	}

	return ret
}

func activityStatsOtherSecondsCustom(totalSeconds float64, activityIntervals []activityIntervalCustom, unusableIntervals []activityIntervalCustom) float64 {
	coveredSeconds := activityStatsDurationCustom(append(append(
		[]activityIntervalCustom{},
		activityIntervals...),
		unusableIntervals...,
	))
	otherSeconds := totalSeconds - coveredSeconds
	if otherSeconds < 0 {
		return 0
	}
	return otherSeconds
}

func activityStatsActivityOtherSecondsCustom(totalSeconds float64, activityIntervals []activityIntervalCustom) float64 {
	otherSeconds := totalSeconds - activityStatsDurationCustom(activityIntervals)
	if otherSeconds < 0 {
		return 0
	}
	return otherSeconds
}

func activityStatsRestrictToMeaningfulScenesCustom(
	sceneDurations map[int]float64,
	byCategory map[activityCategoryCustom][]activityIntervalCustom,
	meaningfulSceneIDs map[int]bool,
) {
	for sceneID := range sceneDurations {
		if !meaningfulSceneIDs[sceneID] {
			delete(sceneDurations, sceneID)
		}
	}

	for category, intervals := range byCategory {
		filtered := intervals[:0]
		for _, interval := range intervals {
			if meaningfulSceneIDs[interval.sceneID] {
				filtered = append(filtered, interval)
			}
		}
		byCategory[category] = filtered
	}
}

func activityStatsRoleTagIDsCustom() (sexTagID int, oralTagID int, soloTagID int, goatTagID int) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, oralTagID, soloTagID, _, _, _, _ = getRoleTagIDs(uiConfig)
	roleTagIDs, _ := uiConfig["roleTagIds"].(map[string]interface{})
	goatTagID, _ = strconv.Atoi(customStringConfigValue(roleTagIDs["goatTagId"]))
	return
}

func activityStatsEmptyPerformerCustom() *PerformerActivityStats {
	return &PerformerActivityStats{}
}

func activityStatsEmptyStudioCustom() *StudioActivityStats {
	return &StudioActivityStats{}
}

func (r *performerResolver) ActivityStats(ctx context.Context, obj *models.Performer) (ret *PerformerActivityStats, err error) {
	sexTagID, oralTagID, soloTagID, _ := activityStatsRoleTagIDsCustom()
	if sexTagID == 0 && oralTagID == 0 && soloTagID == 0 {
		return activityStatsEmptyPerformerCustom(), nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = queryPerformerActivityStatsCustom(ctx, obj.ID, sexTagID, oralTagID, soloTagID)
		return err
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

func queryPerformerActivityStatsCustom(ctx context.Context, performerID int, sexTagID int, oralTagID int, soloTagID int) (*PerformerActivityStats, error) {
	query := `
SELECT
  sm.scene_id,
  sm.seconds,
  sm.end_seconds,
  sm.primary_tag_id,
  EXISTS (
    SELECT 1 FROM scene_marker_performers top_smp
    WHERE top_smp.scene_marker_id = sm.id
      AND top_smp.performer_id = ?
      AND top_smp.role = 'top'
  ) AS is_top,
  EXISTS (
    SELECT 1 FROM scene_marker_performers bottom_smp
    WHERE bottom_smp.scene_marker_id = sm.id
      AND bottom_smp.performer_id = ?
      AND bottom_smp.role = 'bottom'
  ) AS is_bottom
FROM scene_markers sm
WHERE sm.primary_tag_id IN (?, ?, ?)
  AND sm.end_seconds IS NOT NULL
  AND sm.end_seconds > sm.seconds
  AND NOT EXISTS (
    SELECT 1 FROM scene_markers_tags smt
    WHERE smt.scene_marker_id = sm.id
  )
  AND EXISTS (
    SELECT 1 FROM scene_marker_performers smp
    WHERE smp.scene_marker_id = sm.id
      AND smp.performer_id = ?
  )`

	args := []interface{}{performerID, performerID, sexTagID, oralTagID, soloTagID, performerID}
	_, rows, err := manager.GetInstance().Database.QuerySQL(ctx, query, args)
	if err != nil {
		return nil, err
	}

	byCategory := map[activityCategoryCustom][]activityIntervalCustom{
		activitySexCustom:  {},
		activityOralCustom: {},
		activitySoloCustom: {},
	}
	sexTopIntervals := []activityIntervalCustom{}
	sexBottomIntervals := []activityIntervalCustom{}
	oralTopIntervals := []activityIntervalCustom{}
	oralBottomIntervals := []activityIntervalCustom{}

	for _, row := range rows {
		if len(row) < 6 {
			continue
		}

		category, ok := activityStatsCategoryCustom(activityStatsIntCustom(row[3]), sexTagID, oralTagID, soloTagID)
		if !ok {
			continue
		}

		interval := activityIntervalCustom{
			sceneID: activityStatsIntCustom(row[0]),
			start:   activityStatsFloatCustom(row[1]),
			end:     activityStatsFloatCustom(row[2]),
		}
		if interval.end <= interval.start {
			continue
		}

		byCategory[category] = append(byCategory[category], interval)

		isTop := activityStatsBoolCustom(row[4])
		isBottom := activityStatsBoolCustom(row[5])
		switch category {
		case activitySexCustom:
			if isTop {
				sexTopIntervals = append(sexTopIntervals, interval)
			}
			if isBottom {
				sexBottomIntervals = append(sexBottomIntervals, interval)
			}
		case activityOralCustom:
			if isTop {
				oralTopIntervals = append(oralTopIntervals, interval)
			}
			if isBottom {
				oralBottomIntervals = append(oralBottomIntervals, interval)
			}
		}
	}

	ret := &PerformerActivityStats{
		SexSeconds:        activityStatsDurationCustom(byCategory[activitySexCustom]),
		OralSeconds:       activityStatsDurationCustom(byCategory[activityOralCustom]),
		SoloSeconds:       activityStatsDurationCustom(byCategory[activitySoloCustom]),
		SexTopSeconds:     activityStatsDurationCustom(sexTopIntervals),
		SexBottomSeconds:  activityStatsDurationCustom(sexBottomIntervals),
		OralTopSeconds:    activityStatsDurationCustom(oralTopIntervals),
		OralBottomSeconds: activityStatsDurationCustom(oralBottomIntervals),
	}

	ret.TotalActivitySeconds = ret.SexSeconds + ret.OralSeconds + ret.SoloSeconds
	ret.SexPercent = activityStatsPercentCustom(ret.SexSeconds, ret.TotalActivitySeconds)
	ret.OralPercent = activityStatsPercentCustom(ret.OralSeconds, ret.TotalActivitySeconds)
	ret.SoloPercent = activityStatsPercentCustom(ret.SoloSeconds, ret.TotalActivitySeconds)
	ret.SexTopPercent = activityStatsPercentCustom(ret.SexTopSeconds, ret.SexSeconds)
	ret.SexBottomPercent = activityStatsPercentCustom(ret.SexBottomSeconds, ret.SexSeconds)
	ret.OralTopPercent = activityStatsPercentCustom(ret.OralTopSeconds, ret.OralSeconds)
	ret.OralBottomPercent = activityStatsPercentCustom(ret.OralBottomSeconds, ret.OralSeconds)

	return ret, nil
}

func (r *studioResolver) StudioActivityStats(ctx context.Context, obj *models.Studio, depth *int) (ret *StudioActivityStats, err error) {
	sexTagID, oralTagID, soloTagID, goatTagID := activityStatsRoleTagIDsCustom()
	if sexTagID == 0 && oralTagID == 0 && soloTagID == 0 {
		return activityStatsEmptyStudioCustom(), nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = queryStudioActivityStatsCustom(ctx, obj.ID, depth, nil, sexTagID, oralTagID, soloTagID, goatTagID)
		return err
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

func (r *studioResolver) StudioPerformerActivityStats(ctx context.Context, obj *models.Studio, performerID string, depth *int) (ret *StudioActivityStats, err error) {
	perfID, err := strconv.Atoi(performerID)
	if err != nil {
		return nil, err
	}

	sexTagID, oralTagID, soloTagID, goatTagID := activityStatsRoleTagIDsCustom()
	if sexTagID == 0 && oralTagID == 0 && soloTagID == 0 {
		return activityStatsEmptyStudioCustom(), nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = queryStudioActivityStatsCustom(ctx, obj.ID, depth, &perfID, sexTagID, oralTagID, soloTagID, goatTagID)
		return err
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

func activityStatsSceneScopeCustom(studioID *int, depth *int) (string, []interface{}) {
	if studioID == nil {
		return `WITH selected_scenes(id) AS (SELECT id FROM scenes)`, nil
	}

	depthValue := 0
	if depth != nil {
		depthValue = *depth
	}
	return `WITH RECURSIVE selected_studios(id, depth) AS (
  SELECT ?, 0
  UNION ALL
  SELECT s.id, selected_studios.depth + 1
  FROM studios s
  JOIN selected_studios ON s.parent_id = selected_studios.id
  WHERE ? = -1 OR selected_studios.depth < ?
),
selected_scenes(id) AS (
  SELECT id FROM scenes
  WHERE studio_id IN (SELECT id FROM selected_studios)
)`, []interface{}{*studioID, depthValue, depthValue}
}

func queryStudioActivityStatsCustom(ctx context.Context, studioID int, depth *int, performerID *int, sexTagID int, oralTagID int, soloTagID int, goatTagID int) (*StudioActivityStats, error) {
	return queryActivityStatsCustom(ctx, &studioID, depth, performerID, sexTagID, oralTagID, soloTagID, goatTagID)
}

func queryGlobalActivityStatsCustom(ctx context.Context, sexTagID int, oralTagID int, soloTagID int, goatTagID int) (*StudioActivityStats, error) {
	return queryActivityStatsCustom(ctx, nil, nil, nil, sexTagID, oralTagID, soloTagID, goatTagID)
}

func (r *queryResolver) SceneStatsActivity(ctx context.Context, studioID *string, depth *int) (ret *StudioActivityStats, err error) {
	sexTagID, oralTagID, soloTagID, goatTagID := activityStatsRoleTagIDsCustom()
	if sexTagID == 0 && oralTagID == 0 && soloTagID == 0 {
		return activityStatsEmptyStudioCustom(), nil
	}

	var parsedStudioID *int
	if studioID != nil {
		parsed, parseErr := strconv.Atoi(*studioID)
		if parseErr != nil || parsed < 1 {
			return nil, fmt.Errorf("invalid studio ID: %s", *studioID)
		}
		parsedStudioID = &parsed
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = queryActivityStatsCustom(ctx, parsedStudioID, depth, nil, sexTagID, oralTagID, soloTagID, goatTagID)
		return err
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

func queryActivityStatsCustom(ctx context.Context, studioID *int, depth *int, performerID *int, sexTagID int, oralTagID int, soloTagID int, goatTagID int) (*StudioActivityStats, error) {
	sceneScope, sceneScopeArgs := activityStatsSceneScopeCustom(studioID, depth)
	durationQuery := sceneScope + `
SELECT sc.id, COALESCE(MAX(video_files.duration), 0)
FROM scenes sc
LEFT JOIN scenes_files ON scenes_files.scene_id = sc.id
LEFT JOIN video_files ON video_files.file_id = scenes_files.file_id
WHERE sc.id IN (SELECT id FROM selected_scenes)
GROUP BY sc.id`

	durationArgs := append([]interface{}{}, sceneScopeArgs...)
	if performerID != nil {
		durationQuery = sceneScope + `
SELECT sc.id, COALESCE(MAX(video_files.duration), 0)
FROM scenes sc
LEFT JOIN scenes_files ON scenes_files.scene_id = sc.id
LEFT JOIN video_files ON video_files.file_id = scenes_files.file_id
WHERE sc.id IN (SELECT id FROM selected_scenes)
  AND EXISTS (
    SELECT 1 FROM performers_scenes ps
    WHERE ps.scene_id = sc.id
      AND ps.performer_id = ?
  )
GROUP BY sc.id`
		durationArgs = append(durationArgs, *performerID)
	}

	_, durationRows, err := manager.GetInstance().Database.QuerySQL(ctx, durationQuery, durationArgs)
	if err != nil {
		return nil, err
	}

	sceneDurations := make(map[int]float64, len(durationRows))
	for _, row := range durationRows {
		if len(row) < 2 {
			continue
		}
		sceneID := activityStatsIntCustom(row[0])
		duration := activityStatsFloatCustom(row[1])
		sceneDurations[sceneID] = duration
	}

	if len(sceneDurations) == 0 {
		return activityStatsEmptyStudioCustom(), nil
	}

	markerQuery := sceneScope + fmt.Sprintf(`
SELECT sm.scene_id, sm.seconds, sm.end_seconds, sm.primary_tag_id, COUNT(smt.tag_id), %s
FROM scene_markers sm
JOIN scenes sc ON sc.id = sm.scene_id
LEFT JOIN scene_markers_tags smt ON smt.scene_marker_id = sm.id
WHERE sc.id IN (SELECT id FROM selected_scenes)
  AND sm.end_seconds IS NOT NULL
  AND sm.end_seconds > sm.seconds`, activityStatsGoatMarkerSQLCustom("sm", goatTagID))

	args := append([]interface{}{}, sceneScopeArgs...)
	if performerID != nil {
		markerQuery += `
  AND EXISTS (
    SELECT 1 FROM scene_marker_performers smp
    WHERE smp.scene_marker_id = sm.id
      AND smp.performer_id = ?
  )`
		args = append(args, *performerID)
	}
	markerQuery += `
GROUP BY sm.id, sm.scene_id, sm.seconds, sm.end_seconds, sm.primary_tag_id`
	_, markerRows, err := manager.GetInstance().Database.QuerySQL(ctx, markerQuery, args)
	if err != nil {
		return nil, err
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
	for _, row := range markerRows {
		if len(row) < 6 {
			continue
		}

		sceneID := activityStatsIntCustom(row[0])
		sceneDuration, ok := sceneDurations[sceneID]
		if !ok || sceneDuration <= 0 {
			continue
		}

		start := activityStatsFloatCustom(row[1])
		end := activityStatsFloatCustom(row[2])
		if start < 0 {
			start = 0
		}
		if end > sceneDuration {
			end = sceneDuration
		}
		if end <= start {
			continue
		}

		interval := activityIntervalCustom{sceneID: sceneID, start: start, end: end}
		primaryTagID := activityStatsIntCustom(row[3])
		if category, ok := activityStatsCategoryCustom(primaryTagID, sexTagID, oralTagID, soloTagID); ok {
			byCategory[category] = append(byCategory[category], interval)
			sceneCounts[category][sceneID] = true
			meaningfulSceneIDs[sceneID] = true
		}
		if activityStatsIsOutstandingMarkerCustom(primaryTagID, activityStatsIntCustom(row[4]), activityStatsBoolCustom(row[5]), sexTagID, oralTagID, soloTagID) {
			byCategory[activityOutstandingCustom] = append(byCategory[activityOutstandingCustom], interval)
		}
	}

	negativeMarkerQuery := sceneScope + `
SELECT snm.scene_id, snm.start_seconds, snm.end_seconds
FROM scene_negative_markers snm
JOIN scenes sc ON sc.id = snm.scene_id
WHERE sc.id IN (SELECT id FROM selected_scenes)
  AND snm.end_seconds > snm.start_seconds`

	negativeMarkerArgs := append([]interface{}{}, sceneScopeArgs...)
	if performerID != nil {
		negativeMarkerQuery += `
  AND EXISTS (
    SELECT 1 FROM performers_scenes ps
    WHERE ps.scene_id = sc.id
      AND ps.performer_id = ?
  )`
		negativeMarkerArgs = append(negativeMarkerArgs, *performerID)
	}

	_, negativeMarkerRows, err := manager.GetInstance().Database.QuerySQL(ctx, negativeMarkerQuery, negativeMarkerArgs)
	if err != nil {
		return nil, err
	}

	for _, row := range negativeMarkerRows {
		if len(row) < 3 {
			continue
		}

		sceneID := activityStatsIntCustom(row[0])
		sceneDuration, ok := sceneDurations[sceneID]
		if !ok || sceneDuration <= 0 {
			continue
		}
		start := activityStatsFloatCustom(row[1])
		end := activityStatsFloatCustom(row[2])
		if start < 0 {
			start = 0
		}
		if end > sceneDuration {
			end = sceneDuration
		}
		if end <= start {
			continue
		}

		byCategory[activityUnusableCustom] = append(byCategory[activityUnusableCustom], activityIntervalCustom{
			sceneID: sceneID,
			start:   start,
			end:     end,
		})
	}

	// Studio detail charts should only use scenes with an in-bounds oral, solo,
	// or sex marker range. Performer-scoped studio card stats retain their
	// existing performer-filtered denominator.
	if performerID == nil {
		activityStatsRestrictToMeaningfulScenesCustom(sceneDurations, byCategory, meaningfulSceneIDs)
	}

	var totalSeconds float64
	for _, duration := range sceneDurations {
		totalSeconds += duration
	}
	if totalSeconds <= 0 {
		return activityStatsEmptyStudioCustom(), nil
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
	}, nil
}
