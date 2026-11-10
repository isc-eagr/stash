package sqlite

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestSceneCustomFilterSemantics(t *testing.T) {
	db, err := sql.Open(sqlite3Driver, ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })
	_, err = db.Exec(`
CREATE TABLE scenes(id INTEGER PRIMARY KEY);
CREATE TABLE tags(id INTEGER PRIMARY KEY);
CREATE TABLE tags_relations(parent_id INTEGER,child_id INTEGER);
CREATE TABLE scene_markers(id INTEGER PRIMARY KEY,scene_id INTEGER,primary_tag_id INTEGER);
CREATE TABLE scene_markers_tags(scene_marker_id INTEGER,tag_id INTEGER);
CREATE TABLE scene_marker_performers(scene_marker_id INTEGER,performer_id INTEGER,role TEXT);
CREATE TABLE performers_scenes(scene_id INTEGER,performer_id INTEGER);
CREATE TABLE performers(id INTEGER PRIMARY KEY,rating INTEGER);
INSERT INTO scenes VALUES(1),(2),(3),(4),(5),(6),(7),(8);
INSERT INTO tags VALUES(10),(11),(12),(13),(20),(30),(40);
-- A diamond hierarchy and a cycle exercise deduplication and termination.
INSERT INTO tags_relations VALUES(10,11),(10,12),(11,13),(12,13),(13,10);
INSERT INTO scene_markers VALUES(1,1,13),(2,1,10),(3,2,99),(4,3,30),
 (5,4,40),(6,5,10),(7,5,20),(8,7,20),(9,8,20),(10,NULL,10);
INSERT INTO scene_markers_tags VALUES(3,20),(1,13);
INSERT INTO performers VALUES(1,80),(2,20),(3,NULL),(4,90);
INSERT INTO performers_scenes VALUES(1,1),(1,2),(2,1),(3,3),(4,4);
INSERT INTO scene_marker_performers VALUES
 (1,1,'top'),(2,1,'bottom'),(1,2,'bottom'),(2,2,'top'),(1,99,'top'),
 (3,1,'top'),(8,1,'top'),(8,1,'bottom'),(8,2,'top'),(8,2,'bottom'),
 (9,1,'top'),(9,1,'bottom'),(9,2,'top');`)
	require.NoError(t, err)
	cases := []struct {
		name, input string
		want        []int
	}{
		{"sex", `{"scene_type":{"types":["sex"],"sex_tag_id":"10"}}`, []int{1, 5}},
		{"oral", `{"scene_type":{"types":["oral"],"sex_tag_id":"10","oral_tag_id":"20"}}`, []int{2, 7, 8}},
		{"solo", `{"scene_type":{"types":["solo"],"sex_tag_id":"10","oral_tag_id":"20","solo_tag_id":"30"}}`, []int{3}},
		{"facial", `{"scene_type":{"types":["facial"],"facial_tag_id":"40"}}`, []int{4}},
		{"contradictory_types", `{"scene_type":{"types":["sex","oral"],"sex_tag_id":"10","oral_tag_id":"20"}}`, nil},
		{"missing_config", `{"scene_type":{"types":["sex"]}}`, []int{1, 2, 3, 4, 5, 6, 7, 8}},
		{"invalid_tag_is_data", `{"scene_type":{"types":["sex"],"sex_tag_id":"10 OR 1=1"}}`, nil},
		{"versatile", `{"custom_filters":{"type":"versatile_scenes","sex_tag_id":"10"}}`, []int{1}},
		{"circular", `{"custom_filters":{"type":"circular_oral","oral_tag_id":"20"}}`, []int{7}},
		{"invalid_custom_tag", `{"custom_filters":{"type":"circular_oral","oral_tag_id":"20 OR 1=1"}}`, nil},
		{"nested_types", `{"scene_type":{"types":["sex"],"sex_tag_id":"10"},"OR":{"scene_type":{"types":["facial"],"facial_tag_id":"40"}}}`, []int{1, 4, 5}},
		{"all_gte", `{"performer_rating":{"modifier":"GREATER_THAN_EQUALS","value":80}}`, []int{2, 4}},
		{"all_lte", `{"performer_rating":{"modifier":"LESS_THAN_EQUALS","value":80}}`, []int{1, 2}},
		{"any_gte", `{"performer_rating":{"modifier":"GREATER_THAN_EQUALS","value":80},"performer_rating_all":false}`, []int{1, 2, 4}},
		{"any_or_empty_scene", `{"performer_rating":{"modifier":"GREATER_THAN_EQUALS","value":80},"performer_rating_all":false,"OR":{"id":{"modifier":"EQUALS","value":5}}}`, []int{1, 2, 4, 5}},
		{"independent_ratings", `{"performer_rating":{"modifier":"EQUALS","value":80},"performer_rating_all":false,"AND":{"performer_rating":{"modifier":"EQUALS","value":20},"performer_rating_all":false}}`, []int{1}},
		{"marker_includes", `{"scene_marker_tags":{"modifier":"INCLUDES","value":["10"]}}`, []int{1, 5}},
		{"marker_null", `{"scene_marker_tags":{"modifier":"IS_NULL"}}`, []int{1, 3, 4, 5, 6, 7, 8}},
		{"marker_not_null", `{"scene_marker_tags":{"modifier":"NOT_NULL"}}`, []int{1, 2}},
	}
	for _, tc := range cases {
		for _, scoped := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/scoped=%v", tc.name, scoped), func(t *testing.T) {
				var filter models.SceneFilterType
				require.NoError(t, json.Unmarshal([]byte(tc.input), &filter))
				if scoped {
					filter.ID = &models.IntCriterionInput{Value: 4, Modifier: models.CriterionModifierLessThanEquals}
				}
				f := filterBuilderFromHandler(context.Background(), &sceneFilterHandler{&filter})
				q := sceneRepository.newQuery()
				distinctIDs(&q, sceneTable)
				require.NoError(t, q.addFilter(f))
				q.columns = []string{"DISTINCT scenes.id", "0"}
				q.sortAndPagination = " ORDER BY scenes.id"
				rows := readSceneSortValuesCustom(t, db, q.toSQL(true), q.allArgs())
				var ids []int
				for _, r := range rows {
					ids = append(ids, r.ID)
				}
				want := tc.want
				if scoped {
					want = nil
					for _, id := range tc.want {
						if id <= 4 || (filter.Or != nil && filter.Or.ID != nil && id == filter.Or.ID.Value) {
							want = append(want, id)
						}
					}
				}
				require.Equal(t, want, ids)
			})
		}
	}
	for _, count := range []int{1, 2, 3} {
		clause, args := sceneMarkerMultiplicityClauseCustom("scenes", "sm.primary_tag_id IN (10,13)", count)
		rows := readSceneSortValuesCustom(t, db, "SELECT id,0 FROM scenes WHERE "+clause+" ORDER BY id", args)
		var ids []int
		for _, r := range rows {
			ids = append(ids, r.ID)
		}
		want := map[int][]int{1: {1, 5}, 2: {1}, 3: nil}[count]
		require.Equal(t, want, ids)
	}
}
