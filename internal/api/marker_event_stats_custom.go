package api

// CUSTOM: Nut Stats and Facial Stats. An event is a nut or facial marker
// counted once per assigned top (minimum one), excluding 2nd-camera markers,
// the same rule as the studio facial count. The UI builds every chart from
// these rows.

import (
	"context"
	"slices"
	"sort"
	"strconv"

	"github.com/stashapp/stash/internal/manager"
	"github.com/stashapp/stash/internal/manager/config"
	"github.com/stashapp/stash/pkg/sqlite"
)

type markerEventStatsTagsCustom struct {
	root         int
	secondCamera int
	reallyHot    int
	goat         int
	sex          int
	oral         int
	solo         int
}

type markerEventStatsRunnerCustom func(query string, args []interface{}) ([][]interface{}, error)

// Activity markers ending or starting this close to an event count when they
// surround it on both sides.
const markerEventStatsActivityLeniencySecondsCustom = 10

type markerEventStatsActivityRowCustom struct {
	category    string
	performerID int
	role        string
	// overlap, before, or after the event marker
	relation string
}

type markerEventStatsMarkerCustom struct {
	id          int
	sceneID     int
	sceneTitle  *string
	sceneRating *int
	sceneDate   *string
	latestODate *string
	duration    float64
	tops        []*MarkerEventStatsVato
	bottoms     []*MarkerEventStatsVato
	oCount      int
	typeIDs     []string
	quality     MarkerEventQuality
	activities  []markerEventStatsActivityRowCustom
}

var markerEventActivityOrderCustom = []MarkerEventActivity{
	MarkerEventActivityGettingFucked,
	MarkerEventActivityFucking,
	MarkerEventActivityGettingSucked,
	MarkerEventActivitySucking,
	MarkerEventActivitySolo,
}

func markerEventStatsTagsFromConfigCustom(kind MarkerEventStatsKind) markerEventStatsTagsCustom {
	uiConfig := config.GetInstance().GetUIConfiguration()
	rootKey := "orgasmTagId"
	if kind == MarkerEventStatsKindFacial {
		rootKey = "facialTagId"
	}
	return markerEventStatsTagsCustom{
		root:         configuredRoleTagIDCustom(uiConfig, rootKey),
		secondCamera: configuredRoleTagIDCustom(uiConfig, "secondCameraTagId"),
		reallyHot:    configuredRoleTagIDCustom(uiConfig, "reallyHotTagId"),
		goat:         configuredRoleTagIDCustom(uiConfig, "goatTagId"),
		sex:          configuredRoleTagIDCustom(uiConfig, "sexTagId"),
		oral:         configuredRoleTagIDCustom(uiConfig, "oralTagId"),
		solo:         configuredRoleTagIDCustom(uiConfig, "soloTagId"),
	}
}

func (r *queryResolver) MarkerEventStats(ctx context.Context, kind MarkerEventStatsKind, studioID *string, depth *int, dateRangeInput *StatsDateRangeInput) (ret *MarkerEventStatsResult, err error) {
	sceneScope, sceneScopeArgs, dateRange, err := sceneStatsInputScopeCustom(studioID, depth, dateRangeInput)
	if err != nil {
		return nil, err
	}
	tags := markerEventStatsTagsFromConfigCustom(kind)
	baseURL, _ := ctx.Value(BaseURLCtxKey).(string)

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		run := func(query string, args []interface{}) ([][]interface{}, error) {
			_, rows, err := db.QuerySQL(ctx, query, args)
			return rows, err
		}
		ret, err = loadMarkerEventStatsCustom(run, sceneScope, sceneScopeArgs, dateRange, tags, baseURL)
		return err
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

// markerEventStatsBaseSQLCustom selects the family's markers in scope as
// event_markers, with the shared 20-second default end.
func markerEventStatsBaseSQLCustom(sceneScope string) string {
	return sceneScope + `,
event_root_tags(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION
  SELECT tr.child_id FROM tags_relations tr JOIN event_root_tags ert ON tr.parent_id = ert.id
),
event_second_camera_tags(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION
  SELECT tr.child_id FROM tags_relations tr JOIN event_second_camera_tags esct ON tr.parent_id = esct.id
),
event_markers(id, scene_id, seconds, end_seconds) AS (
  SELECT sm.id, sm.scene_id, sm.seconds, ` + sqlite.SceneMarkerEndSQLCustom("sm") + `
  FROM scene_markers sm
  WHERE sm.scene_id IN (SELECT id FROM selected_scenes)
    AND (sm.primary_tag_id IN (SELECT id FROM event_root_tags)
      OR EXISTS (
        SELECT 1 FROM scene_markers_tags smt
        WHERE smt.scene_marker_id = sm.id AND smt.tag_id IN (SELECT id FROM event_root_tags)
      ))
    AND sm.primary_tag_id NOT IN (SELECT id FROM event_second_camera_tags)
    AND NOT EXISTS (
      SELECT 1 FROM scene_markers_tags smt2
      WHERE smt2.scene_marker_id = sm.id AND smt2.tag_id IN (SELECT id FROM event_second_camera_tags)
    )
)`
}

func markerEventStatsMarkersSQLCustom() string {
	return `
SELECT em.id, em.scene_id, em.end_seconds - em.seconds, s.title, s.rating, date(` + sceneOStatsEffectiveDateExpr("s") + `)
FROM event_markers em
JOIN scenes s ON s.id = em.scene_id
ORDER BY em.scene_id, em.seconds, em.id`
}

// Sub-types roll up to the family tag's direct child. Really Hot and GOAT
// tags become the quality instead of a type.
const markerEventStatsTagsSQLCustom = `,
event_type_tags(id, type_id) AS (
  SELECT tr.child_id, tr.child_id FROM tags_relations tr WHERE tr.parent_id = ?
  UNION
  SELECT tr.child_id, ett.type_id FROM tags_relations tr JOIN event_type_tags ett ON tr.parent_id = ett.id
),
event_really_hot_tags(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION
  SELECT tr.child_id FROM tags_relations tr JOIN event_really_hot_tags erht ON tr.parent_id = erht.id
),
event_goat_tags(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION
  SELECT tr.child_id FROM tags_relations tr JOIN event_goat_tags egt ON tr.parent_id = egt.id
),
event_marker_tags(marker_id, tag_id) AS (
  SELECT sm.id, sm.primary_tag_id FROM scene_markers sm WHERE sm.id IN (SELECT id FROM event_markers)
  UNION
  SELECT smt.scene_marker_id, smt.tag_id FROM scene_markers_tags smt WHERE smt.scene_marker_id IN (SELECT id FROM event_markers)
)
SELECT
  emt.marker_id,
  CASE
    WHEN emt.tag_id IN (SELECT id FROM event_goat_tags) THEN 'goat'
    WHEN emt.tag_id IN (SELECT id FROM event_really_hot_tags) THEN 'really_hot'
    ELSE 'type'
  END AS kind,
  ett.type_id,
  t.name
FROM event_marker_tags emt
LEFT JOIN event_type_tags ett ON ett.id = emt.tag_id
LEFT JOIN tags t ON t.id = ett.type_id
WHERE emt.tag_id IN (SELECT id FROM event_goat_tags)
   OR emt.tag_id IN (SELECT id FROM event_really_hot_tags)
   OR ett.type_id IS NOT NULL
ORDER BY emt.marker_id, t.name COLLATE NOCASE`

func markerEventStatsVatosSQLCustom() string {
	return `
SELECT DISTINCT
  smp.scene_marker_id,
  smp.role,
  p.id,
  p.name,
  p.rating,
  p.ethnicity,
  p.country,
  CASE WHEN p.image_blob IS NULL OR TRIM(p.image_blob) = '' THEN 0 ELSE 1 END,
  ` + sceneOStatsPerformerAgeExpr("s", "p") + `
FROM scene_marker_performers smp
JOIN scene_markers sm ON sm.id = smp.scene_marker_id
JOIN scenes s ON s.id = sm.scene_id
JOIN performers p ON p.id = smp.performer_id
WHERE smp.scene_marker_id IN (SELECT id FROM event_markers)
  AND smp.role IN ('top', 'bottom')
ORDER BY smp.scene_marker_id, p.name COLLATE NOCASE, p.id`
}

// Your O's count when their video timestamp lands inside the marker.
func markerEventStatsOCountsSQLCustom(oDateWhere string) string {
	return `
SELECT em.id, COUNT(*), strftime('%Y-%m-%dT%H:%M:%SZ', MAX(datetime(od.o_date)))
FROM event_markers em
JOIN scenes_o_dates od ON od.scene_id = em.scene_id
WHERE od.video_timestamp IS NOT NULL
  AND od.video_timestamp >= em.seconds
  AND od.video_timestamp <= em.end_seconds` + oDateWhere + `
GROUP BY em.id`
}

// Sex, Oral, and Solo use their primary-tag family, like the activity stats.
// Overlap matches Marker Match; markers ending or starting within the
// leniency are returned as before/after.
func markerEventStatsActivitiesSQLCustom() string {
	otherEnd := sqlite.SceneMarkerEndSQLCustom("other")
	leniency := strconv.Itoa(markerEventStatsActivityLeniencySecondsCustom)
	return `,
event_activity_roots(id, category) AS (
  VALUES (?, 'sex'), (?, 'oral'), (?, 'solo')
),
event_activity_tags(id, category) AS (
  SELECT id, category FROM event_activity_roots WHERE id > 0
  UNION
  SELECT tr.child_id, eat.category FROM tags_relations tr JOIN event_activity_tags eat ON eat.id = tr.parent_id
)
SELECT DISTINCT em.id, eat.category, smp.performer_id, smp.role,
  CASE
    WHEN other.seconds < em.end_seconds AND ` + otherEnd + ` > em.seconds THEN 'overlap'
    WHEN ` + otherEnd + ` <= em.seconds THEN 'before'
    ELSE 'after'
  END
FROM event_markers em
JOIN scene_markers other ON other.scene_id = em.scene_id
  AND other.id <> em.id
  AND other.seconds <= em.end_seconds + ` + leniency + `
  AND ` + otherEnd + ` >= em.seconds - ` + leniency + `
JOIN event_activity_tags eat ON eat.id = other.primary_tag_id
LEFT JOIN scene_marker_performers smp ON smp.scene_marker_id = other.id`
}

func loadMarkerEventStatsCustom(run markerEventStatsRunnerCustom, sceneScope string, sceneScopeArgs []interface{}, dateRange *statsDateRangeCustom, tags markerEventStatsTagsCustom, baseURL string) (*MarkerEventStatsResult, error) {
	ret := &MarkerEventStatsResult{
		Events:     []*MarkerEventStatsEvent{},
		Performers: []*MarkerEventStatsPerformer{},
		Types:      []*MarkerEventStatsType{},
	}
	if tags.root == 0 {
		return ret, nil
	}

	base := markerEventStatsBaseSQLCustom(sceneScope)
	query := func(sql string, extraArgs ...interface{}) ([][]interface{}, error) {
		args := append(append([]interface{}{}, sceneScopeArgs...), tags.root, tags.secondCamera)
		return run(base+sql, append(args, extraArgs...))
	}

	rows, err := query(markerEventStatsMarkersSQLCustom())
	if err != nil {
		return nil, err
	}
	markers := make([]*markerEventStatsMarkerCustom, 0, len(rows))
	byID := make(map[int]*markerEventStatsMarkerCustom, len(rows))
	for _, row := range rows {
		if len(row) < 6 {
			continue
		}
		marker := &markerEventStatsMarkerCustom{
			id:          customStatsIntValue(row[0]),
			sceneID:     customStatsIntValue(row[1]),
			sceneTitle:  vatoStatsStringPtrValue(row[3]),
			sceneRating: vatoStatsIntPtrValue(row[4]),
			sceneDate:   vatoStatsStringPtrValue(row[5]),
			duration:    customStatsFloatValue(row[2]),
			quality:     MarkerEventQualityRegular,
		}
		markers = append(markers, marker)
		byID[marker.id] = marker
	}
	if len(markers) == 0 {
		return ret, nil
	}

	rows, err = query(markerEventStatsTagsSQLCustom, tags.root, tags.reallyHot, tags.goat)
	if err != nil {
		return nil, err
	}
	typeNames := map[string]string{}
	for _, row := range rows {
		marker := byID[customStatsIntValue(row[0])]
		if marker == nil || len(row) < 4 {
			continue
		}
		switch customStatsStringValue(row[1]) {
		case "goat":
			marker.quality = MarkerEventQualityGoat
		case "really_hot":
			if marker.quality != MarkerEventQualityGoat {
				marker.quality = MarkerEventQualityReallyHot
			}
		default:
			typeID := strconv.Itoa(customStatsIntValue(row[2]))
			typeNames[typeID] = customStatsStringValue(row[3])
			if !slices.Contains(marker.typeIDs, typeID) {
				marker.typeIDs = append(marker.typeIDs, typeID)
			}
		}
	}

	rows, err = query(markerEventStatsVatosSQLCustom())
	if err != nil {
		return nil, err
	}
	performers := map[int]*MarkerEventStatsPerformer{}
	for _, row := range rows {
		marker := byID[customStatsIntValue(row[0])]
		if marker == nil || len(row) < 9 {
			continue
		}
		performerID := customStatsIntValue(row[2])
		if performers[performerID] == nil {
			performers[performerID] = &MarkerEventStatsPerformer{
				ID:        strconv.Itoa(performerID),
				Name:      customStatsStringValue(row[3]),
				Rating100: vatoStatsIntPtrValue(row[4]),
				Ethnicity: vatoStatsStringPtrValue(row[5]),
				Country:   vatoStatsStringPtrValue(row[6]),
				ImagePath: vatoStatsImagePath(baseURL, performerID, customStatsIntValue(row[7]) != 0),
			}
		}
		vato := &MarkerEventStatsVato{PerformerID: strconv.Itoa(performerID)}
		if row[8] != nil {
			if age := customStatsIntValue(row[8]); age >= 18 && age <= 80 {
				vato.Age = &age
			}
		}
		if customStatsStringValue(row[1]) == "top" {
			marker.tops = append(marker.tops, vato)
		} else {
			marker.bottoms = append(marker.bottoms, vato)
		}
	}

	oDateWhere, oDateArgs := dateRange.oDateWhereSQL("od")
	rows, err = query(markerEventStatsOCountsSQLCustom(oDateWhere), oDateArgs...)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		if marker := byID[customStatsIntValue(row[0])]; marker != nil && len(row) > 2 {
			marker.oCount = customStatsIntValue(row[1])
			marker.latestODate = vatoStatsStringPtrValue(row[2])
		}
	}

	if tags.sex > 0 || tags.oral > 0 || tags.solo > 0 {
		rows, err = query(markerEventStatsActivitiesSQLCustom(), tags.sex, tags.oral, tags.solo)
		if err != nil {
			return nil, err
		}
		for _, row := range rows {
			marker := byID[customStatsIntValue(row[0])]
			if marker == nil || len(row) < 5 {
				continue
			}
			activity := markerEventStatsActivityRowCustom{
				category: customStatsStringValue(row[1]),
				relation: customStatsStringValue(row[4]),
			}
			if row[2] != nil {
				activity.performerID = customStatsIntValue(row[2])
				activity.role = customStatsStringValue(row[3])
			}
			marker.activities = append(marker.activities, activity)
		}
	}

	for _, marker := range markers {
		givers := marker.tops
		if len(givers) == 0 {
			givers = []*MarkerEventStatsVato{nil}
		}
		receivers := marker.bottoms
		if receivers == nil {
			receivers = []*MarkerEventStatsVato{}
		}
		typeIDs := marker.typeIDs
		if typeIDs == nil {
			typeIDs = []string{}
		}
		for _, giver := range givers {
			ret.Events = append(ret.Events, &MarkerEventStatsEvent{
				MarkerID:       strconv.Itoa(marker.id),
				SceneID:        strconv.Itoa(marker.sceneID),
				SceneTitle:     marker.sceneTitle,
				SceneRating100: marker.sceneRating,
				SceneDate:      marker.sceneDate,
				Duration:       marker.duration,
				Giver:          giver,
				Receivers:      receivers,
				OCount:         marker.oCount,
				LatestODate:    marker.latestODate,
				TypeTagIds:     typeIDs,
				Quality:        marker.quality,
				Activities:     markerEventActivitiesCustom(giver, marker.activities),
			})
		}
	}

	for _, performer := range performers {
		ret.Performers = append(ret.Performers, performer)
	}
	sort.Slice(ret.Performers, func(i, j int) bool {
		return ret.Performers[i].Name < ret.Performers[j].Name ||
			(ret.Performers[i].Name == ret.Performers[j].Name && ret.Performers[i].ID < ret.Performers[j].ID)
	})
	for id, name := range typeNames {
		ret.Types = append(ret.Types, &MarkerEventStatsType{ID: id, Name: name})
	}
	sort.Slice(ret.Types, func(i, j int) bool { return ret.Types[i].Name < ret.Types[j].Name })

	return ret, nil
}

// markerEventActivitiesCustom reads what the giver was doing from Sex, Oral,
// and Solo markers that overlap the event, or that end just before and start
// just after it (the same activity on both sides). A Solo marker without
// assigned vatos counts for whoever came during it.
func markerEventActivitiesCustom(giver *MarkerEventStatsVato, rows []markerEventStatsActivityRowCustom) []MarkerEventActivity {
	ret := []MarkerEventActivity{}
	if giver == nil {
		return ret
	}
	giverID, _ := strconv.Atoi(giver.PerformerID)
	found := map[string]map[MarkerEventActivity]bool{
		"overlap": {},
		"before":  {},
		"after":   {},
	}
	for _, row := range rows {
		if activity, ok := markerEventActivityForRowCustom(giverID, row); ok && found[row.relation] != nil {
			found[row.relation][activity] = true
		}
	}
	for _, activity := range markerEventActivityOrderCustom {
		if found["overlap"][activity] || (found["before"][activity] && found["after"][activity]) {
			ret = append(ret, activity)
		}
	}
	return ret
}

func markerEventActivityForRowCustom(giverID int, row markerEventStatsActivityRowCustom) (MarkerEventActivity, bool) {
	isGiver := row.performerID == giverID
	switch {
	case row.category == "sex" && isGiver && row.role == "bottom":
		return MarkerEventActivityGettingFucked, true
	case row.category == "sex" && isGiver && row.role == "top":
		return MarkerEventActivityFucking, true
	case row.category == "oral" && isGiver && row.role == "top":
		return MarkerEventActivityGettingSucked, true
	case row.category == "oral" && isGiver && row.role == "bottom":
		return MarkerEventActivitySucking, true
	case row.category == "solo" && (isGiver || row.performerID == 0):
		return MarkerEventActivitySolo, true
	}
	return "", false
}
