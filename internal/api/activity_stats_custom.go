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
	activitySexCustom      activityCategoryCustom = "sex"
	activityOralCustom     activityCategoryCustom = "oral"
	activitySoloCustom     activityCategoryCustom = "solo"
	activityUnusableCustom activityCategoryCustom = "unusable"
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

func activityStatsDurationCustom(intervals []activityIntervalCustom) float64 {
	if len(intervals) == 0 {
		return 0
	}

	sort.Slice(intervals, func(i, j int) bool {
		if intervals[i].sceneID != intervals[j].sceneID {
			return intervals[i].sceneID < intervals[j].sceneID
		}
		if intervals[i].start != intervals[j].start {
			return intervals[i].start < intervals[j].start
		}
		return intervals[i].end < intervals[j].end
	})

	var total float64
	last := intervals[0]
	for _, interval := range intervals[1:] {
		if interval.sceneID != last.sceneID || interval.start > last.end {
			total += last.end - last.start
			last = interval
			continue
		}
		if interval.end > last.end {
			last.end = interval.end
		}
	}

	total += last.end - last.start
	return total
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

func activityStatsRoleTagIDsCustom() (sexTagID int, oralTagID int, soloTagID int) {
	uiConfig := config.GetInstance().GetUIConfiguration()
	sexTagID, oralTagID, soloTagID, _, _, _, _ = getRoleTagIDs(uiConfig)
	return
}

func activityStatsEmptyPerformerCustom() *PerformerActivityStats {
	return &PerformerActivityStats{}
}

func activityStatsEmptyStudioCustom() *StudioActivityStats {
	return &StudioActivityStats{}
}

func (r *performerResolver) ActivityStats(ctx context.Context, obj *models.Performer) (ret *PerformerActivityStats, err error) {
	sexTagID, oralTagID, soloTagID := activityStatsRoleTagIDsCustom()
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
	sexTagID, oralTagID, soloTagID := activityStatsRoleTagIDsCustom()
	if sexTagID == 0 && oralTagID == 0 && soloTagID == 0 {
		return activityStatsEmptyStudioCustom(), nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = queryStudioActivityStatsCustom(ctx, obj.ID, depth, nil, sexTagID, oralTagID, soloTagID)
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

	sexTagID, oralTagID, soloTagID := activityStatsRoleTagIDsCustom()
	if sexTagID == 0 && oralTagID == 0 && soloTagID == 0 {
		return activityStatsEmptyStudioCustom(), nil
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = queryStudioActivityStatsCustom(ctx, obj.ID, depth, &perfID, sexTagID, oralTagID, soloTagID)
		return err
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

func queryStudioActivityStatsCustom(ctx context.Context, studioID int, depth *int, performerID *int, sexTagID int, oralTagID int, soloTagID int) (*StudioActivityStats, error) {
	depthValue := 0
	if depth != nil {
		depthValue = *depth
	}

	durationQuery := `
WITH RECURSIVE selected_studios(id, depth) AS (
  SELECT ?, 0
  UNION ALL
  SELECT s.id, selected_studios.depth + 1
  FROM studios s
  JOIN selected_studios ON s.parent_id = selected_studios.id
  WHERE ? = -1 OR selected_studios.depth < ?
)
SELECT sc.id, COALESCE(MAX(video_files.duration), 0)
FROM scenes sc
LEFT JOIN scenes_files ON scenes_files.scene_id = sc.id
LEFT JOIN video_files ON video_files.file_id = scenes_files.file_id
WHERE sc.studio_id IN (SELECT id FROM selected_studios)
GROUP BY sc.id`

	_, durationRows, err := manager.GetInstance().Database.QuerySQL(ctx, durationQuery, []interface{}{studioID, depthValue, depthValue})
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

	markerQuery := `
WITH RECURSIVE selected_studios(id, depth) AS (
  SELECT ?, 0
  UNION ALL
  SELECT s.id, selected_studios.depth + 1
  FROM studios s
  JOIN selected_studios ON s.parent_id = selected_studios.id
  WHERE ? = -1 OR selected_studios.depth < ?
)
SELECT sm.scene_id, sm.seconds, sm.end_seconds, sm.primary_tag_id
FROM scene_markers sm
JOIN scenes sc ON sc.id = sm.scene_id
WHERE sc.studio_id IN (SELECT id FROM selected_studios)
  AND sm.primary_tag_id IN (?, ?, ?)
  AND sm.end_seconds IS NOT NULL
  AND sm.end_seconds > sm.seconds
  AND NOT EXISTS (
    SELECT 1 FROM scene_markers_tags smt
    WHERE smt.scene_marker_id = sm.id
  )`

	args := []interface{}{studioID, depthValue, depthValue, sexTagID, oralTagID, soloTagID}
	if performerID != nil {
		markerQuery += `
  AND EXISTS (
    SELECT 1 FROM scene_marker_performers smp
    WHERE smp.scene_marker_id = sm.id
      AND smp.performer_id = ?
  )`
		args = append(args, *performerID)
	}
	_, markerRows, err := manager.GetInstance().Database.QuerySQL(ctx, markerQuery, args)
	if err != nil {
		return nil, err
	}

	byCategory := map[activityCategoryCustom][]activityIntervalCustom{
		activitySexCustom:      {},
		activityOralCustom:     {},
		activitySoloCustom:     {},
		activityUnusableCustom: {},
	}
	sceneCounts := map[activityCategoryCustom]map[int]bool{
		activitySexCustom:  {},
		activityOralCustom: {},
		activitySoloCustom: {},
	}
	qualifyingScenes := map[int]bool{}

	for _, row := range markerRows {
		if len(row) < 4 {
			continue
		}

		sceneID := activityStatsIntCustom(row[0])
		sceneDuration, ok := sceneDurations[sceneID]
		if !ok || sceneDuration <= 0 {
			continue
		}

		category, ok := activityStatsCategoryCustom(activityStatsIntCustom(row[3]), sexTagID, oralTagID, soloTagID)
		if !ok {
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
		byCategory[category] = append(byCategory[category], interval)
		sceneCounts[category][sceneID] = true
		qualifyingScenes[sceneID] = true
	}

	negativeMarkerQuery := `
WITH RECURSIVE selected_studios(id, depth) AS (
  SELECT ?, 0
  UNION ALL
  SELECT s.id, selected_studios.depth + 1
  FROM studios s
  JOIN selected_studios ON s.parent_id = selected_studios.id
  WHERE ? = -1 OR selected_studios.depth < ?
)
SELECT snm.scene_id, snm.start_seconds, snm.end_seconds
FROM scene_negative_markers snm
JOIN scenes sc ON sc.id = snm.scene_id
WHERE sc.studio_id IN (SELECT id FROM selected_studios)
  AND snm.end_seconds > snm.start_seconds`

	_, negativeMarkerRows, err := manager.GetInstance().Database.QuerySQL(ctx, negativeMarkerQuery, []interface{}{studioID, depthValue, depthValue})
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
		if performerID != nil && !qualifyingScenes[sceneID] {
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
		if performerID == nil {
			qualifyingScenes[sceneID] = true
		}
	}

	var totalSeconds float64
	for sceneID := range qualifyingScenes {
		totalSeconds += sceneDurations[sceneID]
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
	otherSeconds := activityStatsOtherSecondsCustom(totalSeconds, activityIntervals, byCategory[activityUnusableCustom])

	return &StudioActivityStats{
		TotalSeconds:    totalSeconds,
		SexSeconds:      sexSeconds,
		OralSeconds:     oralSeconds,
		SoloSeconds:     soloSeconds,
		OtherSeconds:    otherSeconds,
		UnusableSeconds: unusableSeconds,
		SexPercent:      activityStatsPercentCustom(sexSeconds, totalSeconds),
		OralPercent:     activityStatsPercentCustom(oralSeconds, totalSeconds),
		SoloPercent:     activityStatsPercentCustom(soloSeconds, totalSeconds),
		OtherPercent:    activityStatsPercentCustom(otherSeconds, totalSeconds),
		UnusablePercent: activityStatsPercentCustom(unusableSeconds, totalSeconds),
		SexSceneCount:   len(sceneCounts[activitySexCustom]),
		OralSceneCount:  len(sceneCounts[activityOralCustom]),
		SoloSceneCount:  len(sceneCounts[activitySoloCustom]),
	}, nil
}
