package sqlite

import (
	"database/sql"
	"fmt"
	"math/rand"
	"strings"
	"testing"

	"github.com/stashapp/stash/internal/manager/config"
	"github.com/stretchr/testify/require"
)

var sceneActivitySortCategoriesCustom = []activityPercentCategoryCustom{
	activityPercentSexCustom, activityPercentOralCustom, activityPercentSoloCustom,
	activityPercentOtherCustom, activityPercentOutstandingCustom, activityPercentStandardCustom,
	activityPercentUnclassifiedCustom, activityPercentUnusableCustom,
}

func sceneSortTestConfigCustom(t *testing.T, ids map[string]interface{}) {
	cfg := config.InitializeEmpty()
	previous := cfg.GetUIConfiguration()
	t.Cleanup(func() { cfg.SetUIConfiguration(previous) })
	cfg.SetUIConfiguration(map[string]interface{}{"roleTagIds": ids})
}

func sceneActivityFixtureCustom(t *testing.T) *sql.DB {
	db, err := sql.Open(sqlite3Driver, ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })
	_, err = db.Exec(`
CREATE TABLE scenes(id INTEGER PRIMARY KEY, title TEXT);
CREATE TABLE scenes_files(scene_id INTEGER, file_id INTEGER);
CREATE TABLE video_files(file_id INTEGER, duration REAL);
CREATE TABLE scene_markers(id INTEGER PRIMARY KEY, scene_id INTEGER, primary_tag_id INTEGER, seconds REAL, end_seconds REAL);
CREATE TABLE scene_markers_tags(scene_marker_id INTEGER, tag_id INTEGER);
CREATE TABLE scene_negative_markers(scene_id INTEGER, start_seconds REAL, end_seconds REAL);
CREATE TABLE tags_relations(parent_id INTEGER, child_id INTEGER);
INSERT INTO tags_relations VALUES(50, 51), (51, 52), (60, 61), (70, 71);
INSERT INTO scenes VALUES(1, 'One'), (2, 'Two'), (3, 'Three'), (4, 'Four'), (5, 'Five');
INSERT INTO scenes_files VALUES(1, 1), (1, 2), (2, 3), (3, 4), (5, 5);
INSERT INTO video_files VALUES(1, 100), (2, 80), (3, 200), (4, 0), (5, NULL);
INSERT INTO scene_markers VALUES(1, 1, 10, 0, 25), (2, 1, 20, 25, 70),
 (3, 1, 30, 50, 80), (4, 1, 99, 10, 30), (5, 1, 10, 70, 130),
 (6, 1, 10, -5, 5), (7, 2, 20, 10, 10), (8, 2, 10, 10, NULL),
 (9, 2, 30, 30, 10), (10, 2, 10, 0, 50), (11, 2, 52, 0, 50),
 (12, 2, 10, 60, 80), (13, 2, 61, 60, 80), (14, 2, 71, 60, 80),
 (15, NULL, 10, 0, 50);
INSERT INTO scene_markers_tags VALUES(5, 51), (10, 61), (10, 71);
INSERT INTO scene_negative_markers VALUES(1, 15, 35), (1, 25, 45),
 (1, -10, 5), (1, 95, 120), (2, 0, 15), (2, 210, 250), (3, 0, 10);`)
	require.NoError(t, err)
	// Fractional, nested, equal-start and overlapping ranges exercise union
	// arithmetic and clipping more broadly than hand-picked integer examples.
	rng := rand.New(rand.NewSource(42))
	for id := 20; id < 100; id++ {
		start := float64(rng.Intn(130)-10) / 1.7
		end := start + float64(rng.Intn(70)-10)/1.3
		_, err = db.Exec("INSERT INTO scene_markers VALUES(?, ?, ?, ?, ?)", id, id%5+1, []int{10, 20, 30, 51, 61, 71, 99}[id%7], start, end)
		require.NoError(t, err)
	}
	return db
}

func TestSceneActivityPercentCustomScene9836(t *testing.T) {
	db := sceneActivityFixtureCustom(t)
	sceneSortTestConfigCustom(t, map[string]interface{}{
		"sexTagId": "268", "oralTagId": "196", "soloTagId": "24",
		"goatTagId": "10", "orgasmTagId": "15", "reallyHotTagId": "9",
	})
	_, err := db.Exec(`
INSERT INTO scenes VALUES (9836, 'Regression');
INSERT INTO scenes_files VALUES (9836, 9836);
INSERT INTO video_files VALUES (9836, 561.45);
INSERT INTO scene_markers VALUES
  (30710, 9836, 24, 65.521034, 480.17501),
  (30711, 9836, 15, 447.626705, 460.807515);`)
	require.NoError(t, err)
	for _, sortOnly := range []bool{false, true} {
		for _, qualityTagID := range []int{0, 9, 10} {
			_, err := db.Exec("DELETE FROM scene_markers_tags WHERE scene_marker_id = 30711")
			require.NoError(t, err)
			if qualityTagID != 0 {
				_, err = db.Exec("INSERT INTO scene_markers_tags VALUES (30711, ?)", qualityTagID)
				require.NoError(t, err)
			}
			outstandingSeconds := 0.0
			if qualityTagID != 0 {
				outstandingSeconds = 460.807515 - 447.626705
			}
			for category, want := range map[activityPercentCategoryCustom]float64{
				activityPercentOutstandingCustom:  100 * outstandingSeconds / 561.45,
				activityPercentStandardCustom:     100 * (480.17501 - 65.521034 - outstandingSeconds) / 561.45,
				activityPercentUnclassifiedCustom: 100 * (561.45 - (480.17501 - 65.521034)) / 561.45,
			} {
				query := sceneRepository.newQuery()
				distinctIDs(&query, sceneTable)
				query.addWhere("scenes.id = 9836")
				expr := sceneActivityPercentExpressionCustom(&query, category, sortOnly)
				query.columns = []string{"scenes.id", expr}
				got := readSceneSortValuesCustom(t, db, query.toSQL(true), query.allArgs())
				require.Len(t, got, 1)
				require.InDelta(t, want, got[0].Value, 0.000001, "category=%s sort=%v qualifier=%d", category, sortOnly, qualityTagID)
			}
		}
	}
}

func TestSceneActivitySortCustomMatchesScalarMetrics(t *testing.T) {
	db := sceneActivityFixtureCustom(t)
	for _, profile := range []map[string]interface{}{
		{"sexTagId": "10", "oralTagId": "20", "soloTagId": "30", "goatTagId": "50", "orgasmTagId": "60", "reallyHotTagId": "70"},
		{"sexTagId": "10", "oralTagId": "10"},
		{},
	} {
		sceneSortTestConfigCustom(t, profile)
		for _, category := range sceneActivitySortCategoriesCustom {
			for _, direction := range []string{"ASC", "DESC"} {
				t.Run(fmt.Sprint(profile)+string(category)+direction, func(t *testing.T) {
					base := sceneRepository.newQuery()
					distinctIDs(&base, sceneTable)
					// Exercise parameter placement in WITH, joins, WHERE and HAVING,
					// with duplicate join matches and a deliberately restricted scope.
					base.addWith(true, "fixture_scope(id) AS (SELECT ? UNION ALL SELECT id + 1 FROM fixture_scope WHERE id < 5)")
					base.withArgs = append(base.withArgs, 1)
					base.addJoins(join{table: "scene_markers", as: "filter_markers", joinType: "LEFT", onClause: "filter_markers.scene_id = scenes.id AND filter_markers.primary_tag_id != ?", args: []interface{}{999}})
					base.addWhere("scenes.id IN (SELECT id FROM fixture_scope) AND scenes.id <= ?")
					base.addArg(4)
					base.addHaving("COUNT(filter_markers.id) >= ?")
					base.addHavingArg(0)
					old := base
					old.columns = []string{"scenes.id", activityPercentScenePercentExprCustom(category)}
					old.sortAndPagination = " ORDER BY 2 " + direction + ", scenes.id"
					order := (&SceneStore{}).sortByBatchedActivityPercentCustom(&base, category, direction)
					expr := strings.TrimSuffix(strings.TrimPrefix(order, " ORDER BY "), " "+direction)
					base.columns = []string{"scenes.id", expr}
					base.sortAndPagination = order + ", scenes.id"
					want := readSceneSortValuesCustom(t, db, old.toSQL(true), old.allArgs())
					got := readSceneSortValuesCustom(t, db, base.toSQL(true), base.allArgs())
					require.Equal(t, want, got)
					// Sort-only joins must not contaminate count/total queries.
					base.columns = []string{"DISTINCT scenes.id"}
					rows, err := db.Query(base.toSQL(false), base.allArgs()...)
					require.NoError(t, err)
					count := 0
					for rows.Next() {
						count++
					}
					require.NoError(t, rows.Err())
					require.NoError(t, rows.Close())
					require.Len(t, want, count)
					plan, err := db.Query("EXPLAIN QUERY PLAN "+base.toSQL(false), base.allArgs()...)
					require.NoError(t, err)
					for plan.Next() {
						var id, parent, unused int
						var detail string
						require.NoError(t, plan.Scan(&id, &parent, &unused, &detail))
						require.NotContains(t, detail, "scene_sort_", "count queries must not evaluate sort aggregates")
					}
					require.NoError(t, plan.Err())
					require.NoError(t, plan.Close())
				})
			}
		}
	}
}

type sceneSortValueCustom struct {
	ID    int
	Value float64
}

func readSceneSortValuesCustom(t *testing.T, db interface {
	Query(string, ...interface{}) (*sql.Rows, error)
}, query string, args []interface{}) []sceneSortValueCustom {
	t.Helper()
	rows, err := db.Query(query, args...)
	require.NoError(t, err)
	defer rows.Close()
	var values []sceneSortValueCustom
	for rows.Next() {
		var value sceneSortValueCustom
		require.NoError(t, rows.Scan(&value.ID, &value.Value))
		values = append(values, value)
	}
	require.NoError(t, rows.Err())
	return values
}
