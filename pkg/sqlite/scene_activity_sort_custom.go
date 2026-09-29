package sqlite

import (
	"fmt"
	"strconv"
	"strings"
)

// sceneActivitySortMergedSQLCustom preserves the scalar interval-union algorithm,
// but calculates all matching scenes in one window pass instead of one per row.
func sceneActivitySortMergedSQLCustom(source string) string {
	return fmt.Sprintf(`SELECT scene_id, SUM(CASE
  WHEN end_seconds > COALESCE(prev_end, seconds)
  THEN end_seconds - CASE WHEN prev_end > seconds THEN prev_end ELSE seconds END
  ELSE 0 END) AS seconds
FROM (
  SELECT scene_id, seconds, end_seconds,
    MAX(end_seconds) OVER (PARTITION BY scene_id ORDER BY seconds, end_seconds
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev_end
  FROM (%s)
)
GROUP BY scene_id`, source)
}

// sortByBatchedActivityPercentCustom keeps metric joins out of count queries.
func (qb *SceneStore) sortByBatchedActivityPercentCustom(query *queryBuilder, category activityPercentCategoryCustom, direction string) string {
	return " ORDER BY " + sceneActivityPercentExpressionCustom(query, category, true) + " " + getSortDirection(direction)
}

// sceneActivityPercentExpressionCustom batches one metric over the supplied scene
// scope. Filter callers keep its joins in count queries as well as result queries.
func sceneActivityPercentExpressionCustom(query *queryBuilder, category activityPercentCategoryCustom, sortOnly bool) string {
	// Capture the existing filters (including search, recursive CTEs and HAVING)
	// before adding sort-only joins. Unreferenced sort CTEs are not evaluated by
	// count/duration queries, which omit these joins.
	scope, args := query.toSQL(false), query.allArgs()
	query.addWith(false, "scene_sort_candidates_custom(id) AS MATERIALIZED ("+scope+")")
	query.withArgs = append(query.withArgs, args...)

	query.addWith(false, `scene_sort_duration_custom AS MATERIALIZED (
  SELECT c.id AS scene_id, COALESCE(MAX(v.duration), 0) AS duration
  FROM scene_sort_candidates_custom c
  LEFT JOIN scenes_files f ON f.scene_id = c.id
  LEFT JOIN video_files v ON v.file_id = f.file_id
  GROUP BY c.id
)`)

	addMerged := func(name, source string) string {
		query.addWith(false, name+" AS MATERIALIZED ("+sceneActivitySortMergedSQLCustom(source)+")")
		query.addJoins(join{table: name, onClause: name + ".scene_id = scenes.id", sort: sortOnly})
		return "COALESCE(" + name + ".seconds, 0)"
	}
	strictSource := func(condition string) string {
		return `SELECT sm.scene_id, sm.seconds, sm.end_seconds FROM scene_markers sm
WHERE sm.scene_id IN (SELECT id FROM scene_sort_candidates_custom) AND ` + condition
	}
	if activityPercentIsClassifiedTypeCustom(category) {
		values := make(map[activityPercentCategoryCustom]string)
		for _, role := range []activityPercentCategoryCustom{activityPercentSexCustom, activityPercentOralCustom, activityPercentSoloCustom} {
			id := activityPercentTagIDCustom(role)
			if id == 0 {
				values[role] = "0"
				continue
			}
			values[role] = addMerged("scene_sort_"+string(role)+"_custom", strictSource(activityPercentStrictMarkerConditionCustom("sm", id)))
		}
		total := values[activityPercentSexCustom] + " + " + values[activityPercentOralCustom] + " + " + values[activityPercentSoloCustom]
		return activityPercentExprCustom(values[category], total)
	}

	tags := GetRoleTagIDs()
	ids := activityPercentConfiguredTagIDsCustom()
	idStrings := []string{"NULL"}
	for _, id := range ids {
		idStrings = append(idStrings, strconv.Itoa(id))
	}
	// Quality sources intentionally retain the existing clipping and tag rules.
	// In particular, strict role shares above use un-clipped, untagged intervals.
	// Keep the scoped duration rows first so expensive quality predicates are
	// never evaluated for markers outside the filtered scene set.
	query.addWith(false, `scene_sort_activity_custom AS MATERIALIZED (
  SELECT sm.scene_id, MAX(0, sm.seconds) AS seconds,
    MIN(d.duration, sm.end_seconds) AS end_seconds
  FROM scene_sort_duration_custom d CROSS JOIN scene_markers sm ON sm.scene_id = d.scene_id
  WHERE sm.end_seconds > sm.seconds AND sm.primary_tag_id IN (`+strings.Join(idStrings, ",")+`)
)`, `scene_sort_negative_custom AS MATERIALIZED (
  SELECT n.scene_id, MAX(0, n.start_seconds) AS seconds,
    MIN(d.duration, n.end_seconds) AS end_seconds
  FROM scene_negative_markers n JOIN scene_sort_duration_custom d ON d.scene_id = n.scene_id
  WHERE n.end_seconds > n.start_seconds
)`, `scene_sort_outstanding_custom AS MATERIALIZED (
  SELECT sm.scene_id, MAX(0, sm.seconds) AS seconds,
    MIN(d.duration, sm.end_seconds) AS end_seconds
  FROM scene_sort_duration_custom d CROSS JOIN scene_markers sm ON sm.scene_id = d.scene_id
  WHERE `+activityPercentOutstandingMarkerConditionForTagIDsCustom("sm", ids, tags.GoatTagID, tags.OrgasmTagID, tags.ReallyHotTagID)+`
)`)
	a := "SELECT scene_id, seconds, end_seconds FROM scene_sort_activity_custom"
	n := "SELECT scene_id, seconds, end_seconds FROM scene_sort_negative_custom"
	o := "SELECT scene_id, seconds, end_seconds FROM scene_sort_outstanding_custom"
	query.addJoins(join{table: "scene_sort_duration_custom", onClause: "scene_sort_duration_custom.scene_id = scenes.id", sort: sortOnly})
	duration := "COALESCE(scene_sort_duration_custom.duration, 0)"
	var numerator string
	switch category {
	case activityPercentOutstandingCustom:
		outstanding := addMerged("scene_sort_total_custom", o)
		excluded := addMerged("scene_sort_excluded_custom", activityPercentIntersectionSourceSQLCustom(o, n))
		numerator = "MAX(" + outstanding + " - " + excluded + ", 0)"
	case activityPercentStandardCustom:
		activity := addMerged("scene_sort_total_custom", a)
		covered := addMerged("scene_sort_excluded_custom", activityPercentIntersectionSourceSQLCustom(a, o)+" UNION ALL "+activityPercentIntersectionSourceSQLCustom(a, n))
		numerator = "MAX(" + activity + " - " + covered + ", 0)"
	case activityPercentUnclassifiedCustom:
		covered := addMerged("scene_sort_total_custom", a+" UNION ALL "+n+" UNION ALL "+o)
		numerator = "MAX(" + duration + " - " + covered + ", 0)"
	case activityPercentOtherCustom:
		covered := addMerged("scene_sort_total_custom", strictSource(activityPercentStrictAnyMarkerConditionCustom("sm"))+" UNION ALL "+n)
		numerator = "MAX(" + duration + " - " + covered + ", 0)"
	case activityPercentUnusableCustom:
		numerator = addMerged("scene_sort_total_custom", n)
	}
	return activityPercentExprCustom(numerator, duration)
}
