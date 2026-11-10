package sqlite

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestSceneActivityFilterCustom(t *testing.T) {
	db := sceneActivityFixtureCustom(t)
	sceneSortTestConfigCustom(t, map[string]interface{}{"sexTagId": "10", "oralTagId": "20", "soloTagId": "30", "goatTagId": "50", "orgasmTagId": "60", "reallyHotTagId": "70"})
	for _, category := range sceneActivitySortCategoriesCustom {
		values := readSceneSortValuesCustom(t, db, "SELECT scenes.id, "+activityPercentScenePercentExprCustom(category)+" FROM scenes ORDER BY scenes.id", nil)
		for _, mod := range []models.CriterionModifier{models.CriterionModifierEquals, models.CriterionModifierNotEquals, models.CriterionModifierGreaterThan, models.CriterionModifierGreaterThanEquals, models.CriterionModifierLessThan, models.CriterionModifierLessThanEquals, models.CriterionModifierBetween, models.CriterionModifierNotBetween, models.CriterionModifierIsNull, models.CriterionModifierNotNull} {
			for _, grouped := range []bool{false, true} {
				for _, operator := range []string{"AND", "OR", "NOT"} {
					t.Run(fmt.Sprintf("%s/%s/grouped=%v/%s", category, mod, grouped, operator), func(t *testing.T) {
						criterion := &models.IntCriterionInput{Value: 30, Value2: new(int), Modifier: mod}
						*criterion.Value2 = 70
						input := map[string]interface{}{string(category) + "_activity_percent": criterion}
						if grouped {
							group := "activity_percentages"
							if category == activityPercentOutstandingCustom || category == activityPercentStandardCustom || category == activityPercentUnclassifiedCustom {
								group = "quality_percentages"
							}
							input = map[string]interface{}{group: map[string]interface{}{string(category) + "_percent": criterion}}
						}
						input["id"] = &models.IntCriterionInput{Value: 4, Modifier: models.CriterionModifierLessThanEquals}
						input[operator] = map[string]interface{}{"id": map[string]interface{}{"value": 5, "modifier": "EQUALS"}}
						data, err := json.Marshal(input)
						require.NoError(t, err)
						var filter models.SceneFilterType
						require.NoError(t, json.Unmarshal(data, &filter))
						f := filterBuilderFromHandler(context.Background(), &sceneFilterHandler{&filter})
						query := sceneRepository.newQuery()
						distinctIDs(&query, sceneTable)
						require.NoError(t, query.addFilter(f))
						query.columns = []string{"DISTINCT scenes.id", "0"}
						query.sortAndPagination = " ORDER BY scenes.id"
						var want []sceneSortValueCustom
						for _, v := range values {
							// Compare the scalar's rounded value outside its deeply nested SQL.
							clause, args := getIntCriterionWhereClause("?", *criterion)
							args = append([]interface{}{math.Round(v.Value)}, args...)
							var matches bool
							require.NoError(t, db.QueryRow("SELECT "+clause, args...).Scan(&matches))
							matches = matches && v.ID <= 4
							switch operator {
							case "OR":
								matches = matches || v.ID == 5
							case "AND":
								matches = matches && v.ID == 5
							case "NOT":
								matches = matches && v.ID != 5
							}
							if matches {
								want = append(want, sceneSortValueCustom{ID: v.ID})
							}
						}
						got := readSceneSortValuesCustom(t, db, query.toSQL(true), query.allArgs())
						require.Equal(t, want, got)
						// Counts cannot omit the metric joins as sort-only queries do.
						var count int
						require.NoError(t, db.QueryRow("SELECT COUNT(*) FROM ("+query.toSQL(false)+")", query.allArgs()...).Scan(&count))
						require.Equal(t, len(want), count)
					})
				}
			}
		}
	}
}

func BenchmarkSceneEmptyFilterCustom(b *testing.B) {
	for i := 0; i < b.N; i++ {
		filterBuilderFromHandler(context.Background(), &sceneFilterHandler{&models.SceneFilterType{}})
	}
}

func TestSceneActivityFilterCombinedCustom(t *testing.T) {
	db := sceneActivityFixtureCustom(t)
	sceneSortTestConfigCustom(t, map[string]interface{}{"sexTagId": "10", "oralTagId": "20", "soloTagId": "30"})
	var filter models.SceneFilterType
	require.NoError(t, json.Unmarshal([]byte(`{
 "standard_activity_percent":{"value":0,"modifier":"GREATER_THAN_EQUALS"},
 "quality_percentages":{"standard_percent":{"value":100,"modifier":"LESS_THAN_EQUALS"},"outstanding_percent":{"value":100,"modifier":"LESS_THAN_EQUALS"}},
 "OR":{"unusable_activity_percent":{"value":100,"modifier":"EQUALS"}}
}`), &filter))
	f := filterBuilderFromHandler(context.Background(), &sceneFilterHandler{&filter})
	q := sceneRepository.newQuery()
	distinctIDs(&q, sceneTable)
	require.NoError(t, q.addFilter(f))
	// Duplicate-category aliases, multiple metrics, nested metric branches and
	// a percentage sort must coexist without leaking or colliding CTE names.
	q.sortAndPagination = (&SceneStore{}).sortByBatchedActivityPercentCustom(&q, activityPercentStandardCustom, "ASC") + ", scenes.id"
	q.columns = []string{"DISTINCT scenes.id", "0"}
	rows := readSceneSortValuesCustom(t, db, q.toSQL(true), q.allArgs())
	require.Len(t, rows, 5)
	q.sortAndPagination += " LIMIT 2 OFFSET 1"
	require.Equal(t, rows[1:3], readSceneSortValuesCustom(t, db, q.toSQL(true), q.allArgs()))
	var count int
	require.NoError(t, db.QueryRow("SELECT COUNT(*) FROM ("+q.toSQL(false)+")", q.allArgs()...).Scan(&count))
	require.Equal(t, 5, count)

	// HAVING branches are independent of WHERE branches in the repository.
	// Do not silently turn this branch's false HAVING into a metric restriction.
	f = &filterBuilder{}
	f.addRecursiveWith("filter_scope(id) AS (SELECT ? UNION ALL SELECT id+1 FROM filter_scope WHERE id < 5)", 1)
	f.addLeftJoin("scene_markers", "fm", "fm.scene_id = scenes.id AND fm.primary_tag_id != ?", 999)
	f.addWhere("scenes.id IN (SELECT id FROM filter_scope) AND scenes.id <= ?", 3)
	f.addHaving("COUNT(fm.id) > ?", 100)
	sub := &filterBuilder{}
	sub.addWhere("scenes.id = ?", 5)
	sub.addHaving("COUNT(fm.id) >= ?", 0)
	f.or(sub)
	c := models.SceneFilterType{StandardActivityPercent: &models.IntCriterionInput{Value: 0, Modifier: models.CriterionModifierGreaterThanEquals}}
	(&sceneFilterHandler{&c}).activityPercentagesCriterionHandlerCustom()(context.Background(), f)
	q = sceneRepository.newQuery()
	distinctIDs(&q, sceneTable)
	require.NoError(t, q.addFilter(f))
	q.columns = []string{"DISTINCT scenes.id", "0"}
	q.sortAndPagination = " ORDER BY scenes.id"
	require.Equal(t, []sceneSortValueCustom{{ID: 1}, {ID: 2}, {ID: 3}, {ID: 5}}, readSceneSortValuesCustom(t, db, q.toSQL(true), q.allArgs()))
}
