package sqlite

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/require"
)

func studioActivityFixtureCustom(t *testing.T) *sql.DB {
	db := sceneActivityFixtureCustom(t)
	_, err := db.Exec(`CREATE TABLE studios(id INTEGER PRIMARY KEY, name TEXT);
INSERT INTO studios VALUES(1,'One'),(2,'Two'),(3,'Three'),(4,'Empty');
ALTER TABLE scenes ADD COLUMN studio_id INTEGER;
UPDATE scenes SET studio_id = CASE WHEN id <= 2 THEN 1 WHEN id=3 THEN 2 ELSE 3 END;
CREATE TABLE studio_aliases(studio_id INTEGER, alias TEXT);
INSERT INTO studio_aliases VALUES(1,'match'),(1,'match again'),(3,'match');`)
	require.NoError(t, err)
	return db
}

func TestStudioQualityQueryMatchesScalarCustom(t *testing.T) {
	db := studioActivityFixtureCustom(t)
	for _, profile := range []map[string]interface{}{
		{"sexTagId": "10", "oralTagId": "20", "soloTagId": "30", "goatTagId": "50", "orgasmTagId": "60", "reallyHotTagId": "70"},
		{"sexTagId": "10", "oralTagId": "10"}, {},
	} {
		sceneSortTestConfigCustom(t, profile)
		for _, category := range []activityPercentCategoryCustom{activityPercentOtherCustom, activityPercentOutstandingCustom, activityPercentStandardCustom, activityPercentUnclassifiedCustom} {
			for _, direction := range []string{"ASC", "DESC"} {
				t.Run(fmt.Sprint(profile)+string(category)+direction, func(t *testing.T) {
					base := studioRepository.newQuery()
					distinctIDs(&base, studioTable)
					base.addWith(true, "fixture_studios(id) AS (SELECT ? UNION ALL SELECT id+1 FROM fixture_studios WHERE id < 4)")
					base.withArgs = append(base.withArgs, 1)
					base.addJoins(join{table: "studio_aliases", as: "fixture_alias", onClause: "fixture_alias.studio_id = studios.id AND fixture_alias.alias != ?", args: []interface{}{"absent"}})
					base.addWhere("studios.id IN (SELECT id FROM fixture_studios) AND studios.id <= ?")
					base.addArg(4)
					base.addHaving("COUNT(fixture_alias.alias) >= ?")
					base.addHavingArg(0)
					old := base
					old.columns = []string{"studios.id", activityPercentStudioPercentExprCustom(category)}
					old.sortAndPagination = " ORDER BY 2 " + direction + ", studios.id"
					want := readSceneSortValuesCustom(t, db, old.toSQL(true), old.allArgs())
					expr := studioQualityPercentExpressionCustom(&base, category, true)
					base.columns = []string{"studios.id", expr}
					base.sortAndPagination = " ORDER BY 2 " + direction + ", studios.id"
					got := readSceneSortValuesCustom(t, db, base.toSQL(true), base.allArgs())
					require.Len(t, got, len(want))
					for i := range want {
						require.Equal(t, want[i].ID, got[i].ID)
						require.InDelta(t, want[i].Value, got[i].Value, 1e-9)
					}
					base.sortAndPagination += " LIMIT 2 OFFSET 1"
					require.Equal(t, got[1:3], readSceneSortValuesCustom(t, db, base.toSQL(true), base.allArgs()))
					base.columns = []string{"DISTINCT studios.id"}
					var count int
					require.NoError(t, db.QueryRow("SELECT COUNT(*) FROM ("+base.toSQL(false)+")", base.allArgs()...).Scan(&count))
					require.Equal(t, 4, count)
					// Unused sort metrics must not run for a count-only request.
					rows, err := db.Query("EXPLAIN QUERY PLAN SELECT COUNT(*) FROM ("+base.toSQL(false)+")", base.allArgs()...)
					require.NoError(t, err)
					defer rows.Close()
					for rows.Next() {
						var id, parent, unused int
						var detail string
						require.NoError(t, rows.Scan(&id, &parent, &unused, &detail))
						require.NotContains(t, detail, "studio_quality_")
					}
					require.NoError(t, rows.Err())
				})
			}
		}
	}
}

func TestStudioQualityFilterCompositionCustom(t *testing.T) {
	db := studioActivityFixtureCustom(t)
	sceneSortTestConfigCustom(t, map[string]interface{}{"sexTagId": "10", "oralTagId": "20", "soloTagId": "30", "goatTagId": "50", "orgasmTagId": "60", "reallyHotTagId": "70"})
	for _, category := range []activityPercentCategoryCustom{activityPercentOtherCustom, activityPercentOutstandingCustom, activityPercentStandardCustom, activityPercentUnclassifiedCustom, activityPercentUnusableCustom} {
		values := readSceneSortValuesCustom(t, db, "SELECT studios.id, "+activityPercentStudioPercentExprCustom(category)+" FROM studios ORDER BY studios.id", nil)
		for _, modifier := range []models.CriterionModifier{models.CriterionModifierEquals, models.CriterionModifierNotEquals, models.CriterionModifierGreaterThanEquals, models.CriterionModifierLessThanEquals, models.CriterionModifierBetween, models.CriterionModifierNotBetween, models.CriterionModifierIsNull, models.CriterionModifierNotNull} {
			for _, grouped := range []bool{false, true} {
				for _, operator := range []string{"AND", "OR", "NOT"} {
					t.Run(fmt.Sprintf("%s/%s/%v/%s", category, modifier, grouped, operator), func(t *testing.T) {
						upper := 70
						criterion := &models.IntCriterionInput{Value: 30, Value2: &upper, Modifier: modifier}
						input := map[string]interface{}{string(category) + "_activity_percent": criterion}
						if grouped {
							group := "quality_percentages"
							if category == activityPercentOtherCustom {
								group = "activity_percentages"
							}
							input = map[string]interface{}{group: map[string]interface{}{string(category) + "_percent": criterion}}
						}
						input["name"] = map[string]interface{}{"modifier": "NOT_EQUALS", "value": "Empty"}
						input[operator] = map[string]interface{}{"name": map[string]interface{}{"modifier": "EQUALS", "value": "Empty"}}
						data, err := json.Marshal(input)
						require.NoError(t, err)
						var filter models.StudioFilterType
						require.NoError(t, json.Unmarshal(data, &filter))
						q, err := (&StudioStore{}).makeQuery(context.Background(), &filter, nil)
						require.NoError(t, err)
						q.columns = []string{"DISTINCT studios.id", "0"}
						q.sortAndPagination = " ORDER BY studios.id"
						var want []sceneSortValueCustom
						for _, v := range values {
							clause, args := getIntCriterionWhereClause("?", *criterion)
							args = append([]interface{}{math.Round(v.Value)}, args...)
							var matches bool
							require.NoError(t, db.QueryRow("SELECT "+clause, args...).Scan(&matches))
							matches = matches && v.ID != 4
							switch operator {
							case "AND":
								matches = matches && v.ID == 4
							case "OR":
								matches = matches || v.ID == 4
							case "NOT":
								matches = matches && v.ID != 4
							}
							if matches {
								want = append(want, sceneSortValueCustom{ID: v.ID})
							}
						}
						require.Equal(t, want, readSceneSortValuesCustom(t, db, q.toSQL(true), q.allArgs()))
						var count int
						require.NoError(t, db.QueryRow("SELECT COUNT(*) FROM ("+q.toSQL(false)+")", q.allArgs()...).Scan(&count))
						require.Equal(t, len(want), count)
					})
				}
			}
		}
	}
	var combined models.StudioFilterType
	require.NoError(t, json.Unmarshal([]byte(`{"standard_activity_percent":{"value":0,"modifier":"GREATER_THAN_EQUALS"},"quality_percentages":{"standard_percent":{"value":100,"modifier":"LESS_THAN_EQUALS"},"outstanding_percent":{"value":100,"modifier":"LESS_THAN_EQUALS"}},"OR":{"unusable_activity_percent":{"value":100,"modifier":"EQUALS"}}}`), &combined))
	sortKey := "standard_activity_percent"
	q, err := (&StudioStore{}).makeQuery(context.Background(), &combined, &models.FindFilterType{Sort: &sortKey})
	require.NoError(t, err)
	q.columns = []string{"DISTINCT studios.id", "0"}
	q.sortAndPagination = strings.Split(q.sortAndPagination, " LIMIT ")[0]
	rows := readSceneSortValuesCustom(t, db, q.toSQL(true), q.allArgs())
	require.Len(t, rows, 4)
	q.sortAndPagination += " LIMIT 2 OFFSET 1"
	require.Equal(t, rows[1:3], readSceneSortValuesCustom(t, db, q.toSQL(true), q.allArgs()))
}
