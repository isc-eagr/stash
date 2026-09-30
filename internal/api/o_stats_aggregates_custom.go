package api

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/stashapp/stash/internal/manager"
)

// sceneOCalendarDayCountsQueryCustom groups reliable O events by local day for
// one calendar year. The heatmap picks its own year, so it ignores date ranges.
func sceneOCalendarDayCountsQueryCustom(scope string) string {
	return `
SELECT date(od.o_date, 'localtime') AS day_date,
  CAST(strftime('%d', od.o_date, 'localtime') AS INT) AS day,
  COUNT(*) AS cnt
FROM scenes_o_dates od
WHERE od.o_date IS NOT NULL
  AND date(od.o_date, 'localtime') >= date(?)
  AND strftime('%Y', od.o_date, 'localtime') = ?` + scope + `
GROUP BY day_date, day
ORDER BY day_date ASC`
}

// SceneOCalendarDayCounts returns per-day O counts for a whole calendar year.
func (r *queryResolver) SceneOCalendarDayCounts(ctx context.Context, year int, studioID *string, depth *int) (ret []*SceneODayCount, err error) {
	if year < 1 || year > 9999 {
		return nil, fmt.Errorf("invalid year: %d", year)
	}
	scope, scopeArgs, err := sceneOStatsScopeCustom(studioID, depth, nil)
	if err != nil {
		return nil, err
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		args := append([]interface{}{sceneODateTrackingStart, fmt.Sprintf("%04d", year)}, scopeArgs...)
		_, rows, err := manager.GetInstance().Database.QuerySQL(ctx, sceneOCalendarDayCountsQueryCustom(scope), args)
		if err != nil {
			return err
		}
		ret = make([]*SceneODayCount, 0, len(rows))
		for _, row := range rows {
			if len(row) < 3 {
				continue
			}
			ret = append(ret, &SceneODayCount{
				Date:  customStringValue(row[0]),
				Day:   customIntValue(row[1]),
				Count: customIntValue(row[2]),
			})
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

// sceneOCountsBySceneQueryCustom counts O events per scene and carries the
// scene fields the UI needs to derive rating and metallic buckets. Ties go to
// the scene that reached its count most recently.
func sceneOCountsBySceneQueryCustom(scope string) string {
	return `
WITH scene_counts AS (
  SELECT od.scene_id, COUNT(*) AS cnt, MAX(datetime(od.o_date)) AS last_o
  FROM scenes_o_dates od
  WHERE od.o_date IS NOT NULL` + scope + `
  GROUP BY od.scene_id
)
SELECT s.id, s.title, s.rating, sc.cnt,
  (SELECT GROUP_CONCAT(st.tag_id) FROM scenes_tags st WHERE st.scene_id = s.id) AS tag_ids,
  CASE WHEN EXISTS (
    SELECT 1 FROM rating_bonus_scores rbs
    WHERE rbs.entity_type = 'scene'
      AND rbs.entity_id = s.id
      AND ((rbs.key = 'goatElement' AND rbs.raw_value IN (0.5, 1, 1.5, 2))
        OR (rbs.key = 'godTierOrgasm' AND rbs.raw_value = 1))
  ) THEN 1 ELSE 0 END AS has_royal_sapphire_bonus
FROM scene_counts sc
JOIN scenes s ON s.id = sc.scene_id
ORDER BY sc.cnt DESC, sc.last_o DESC, s.title COLLATE NOCASE ASC, s.id ASC`
}

func sceneOCountTagIDsCustom(value interface{}) []string {
	raw := strings.TrimSpace(customStringValue(value))
	if raw == "" || strings.EqualFold(raw, "<nil>") {
		return []string{}
	}
	return strings.Split(raw, ",")
}

// SceneOCountsByScene returns O counts for every scene with at least one O.
func (r *queryResolver) SceneOCountsByScene(ctx context.Context, studioID *string, depth *int, dateRange *StatsDateRangeInput) (ret []*SceneOCountByScene, err error) {
	scope, scopeArgs, err := sceneOStatsScopeCustom(studioID, depth, dateRange)
	if err != nil {
		return nil, err
	}

	baseURL, _ := ctx.Value(BaseURLCtxKey).(string)
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		_, rows, err := manager.GetInstance().Database.QuerySQL(ctx, sceneOCountsBySceneQueryCustom(scope), scopeArgs)
		if err != nil {
			return err
		}
		ret = make([]*SceneOCountByScene, 0, len(rows))
		for _, row := range rows {
			if len(row) < 6 {
				continue
			}
			ret = append(ret, &SceneOCountByScene{
				SceneID:               fmt.Sprint(row[0]),
				ScreenshotPath:        fmt.Sprintf("%s/scene/%v/screenshot", baseURL, row[0]),
				Title:                 sceneStatsStringPtrValue(row[1]),
				Rating100:             vatoStatsIntPtrValue(row[2]),
				Count:                 customIntValue(row[3]),
				TagIds:                sceneOCountTagIDsCustom(row[4]),
				HasRoyalSapphireBonus: customIntValue(row[5]) != 0,
			})
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

// sceneOCountsByPerformerQueryCustom attributes each O event once to every
// vato in the O's scene, matching the O Stats vato drilldown. Ties go to the
// vato who reached his count most recently.
func sceneOCountsByPerformerQueryCustom(scope string) string {
	return `
SELECT p.id, p.name, COUNT(DISTINCT od.rowid) AS cnt,
  CASE WHEN p.image_blob IS NULL OR TRIM(p.image_blob) = '' THEN 0 ELSE 1 END AS has_image,
  p.rating
FROM scenes_o_dates od
JOIN performers_scenes ps ON ps.scene_id = od.scene_id
JOIN performers p ON p.id = ps.performer_id
WHERE od.o_date IS NOT NULL` + scope + `
GROUP BY p.id, p.name, p.image_blob, p.rating
ORDER BY cnt DESC, MAX(datetime(od.o_date)) DESC, p.name COLLATE NOCASE ASC, p.id ASC`
}

// SceneOCountsByPerformer returns O counts for every vato with at least one O.
func (r *queryResolver) SceneOCountsByPerformer(ctx context.Context, studioID *string, depth *int, dateRange *StatsDateRangeInput) (ret []*SceneOCountByPerformer, err error) {
	scope, scopeArgs, err := sceneOStatsScopeCustom(studioID, depth, dateRange)
	if err != nil {
		return nil, err
	}

	baseURL, _ := ctx.Value(BaseURLCtxKey).(string)
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		_, rows, err := manager.GetInstance().Database.QuerySQL(ctx, sceneOCountsByPerformerQueryCustom(scope), scopeArgs)
		if err != nil {
			return err
		}
		ret = make([]*SceneOCountByPerformer, 0, len(rows))
		for _, row := range rows {
			if len(row) < 5 {
				continue
			}
			id := customIntValue(row[0])
			ret = append(ret, &SceneOCountByPerformer{
				PerformerID:   strconv.Itoa(id),
				PerformerName: customStringValue(row[1]),
				Count:         customIntValue(row[2]),
				ImagePath:     vatoStatsImagePath(baseURL, id, customIntValue(row[3]) != 0),
				Rating100:     vatoStatsIntPtrValue(row[4]),
			})
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

// sceneOSceneIDsJSONCustom validates scene IDs and encodes them for json_each,
// which avoids SQLite's bound-parameter limit on large rating buckets.
func sceneOSceneIDsJSONCustom(sceneIDs []string) (string, error) {
	ids := make([]int, 0, len(sceneIDs))
	for _, value := range sceneIDs {
		id, err := strconv.Atoi(value)
		if err != nil || id < 1 {
			return "", fmt.Errorf("invalid scene ID: %s", value)
		}
		ids = append(ids, id)
	}
	encoded, err := json.Marshal(ids)
	return string(encoded), err
}

// SceneOEventsByScenes returns recorded O events for a set of scenes, newest first.
func (r *queryResolver) SceneOEventsByScenes(ctx context.Context, sceneIDs []string, studioID *string, depth *int, dateRange *StatsDateRangeInput) (ret []*SceneOEvent, err error) {
	idsJSON, err := sceneOSceneIDsJSONCustom(sceneIDs)
	if err != nil {
		return nil, err
	}
	scope, scopeArgs, err := sceneOStatsScopeCustom(studioID, depth, dateRange)
	if err != nil {
		return nil, err
	}

	query := `
SELECT od.rowid, od.scene_id, od.o_date, od.video_timestamp
FROM scenes_o_dates od
JOIN scenes s ON s.id = od.scene_id
WHERE od.scene_id IN (SELECT value FROM json_each(?))
  AND od.o_date IS NOT NULL` + scope + `
ORDER BY datetime(od.o_date, 'localtime') DESC, COALESCE(od.video_timestamp, -1) DESC, od.rowid DESC, s.title ASC`
	return r.sceneOEventsFromStatsQuery(ctx, query, append([]interface{}{idsJSON}, scopeArgs...))
}
