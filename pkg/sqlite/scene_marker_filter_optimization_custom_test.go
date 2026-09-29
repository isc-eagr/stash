package sqlite

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/jmoiron/sqlx"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/require"
)

func markerFilterFixtureCustom(t *testing.T) (context.Context, *sqlx.Tx) {
	t.Helper()
	db, err := sqlx.Open(sqlite3Driver, ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })
	_, err = db.Exec(`
CREATE TABLE studios(id INTEGER PRIMARY KEY, parent_id INTEGER);
CREATE TABLE scenes(id INTEGER PRIMARY KEY, studio_id INTEGER);
CREATE TABLE tags(id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE tags_relations(parent_id INTEGER, child_id INTEGER);
CREATE TABLE scene_markers(id INTEGER PRIMARY KEY, scene_id INTEGER, primary_tag_id INTEGER,
 title TEXT DEFAULT '', seconds REAL, end_seconds REAL);
CREATE INDEX marker_scene ON scene_markers(scene_id);
CREATE TABLE scene_markers_tags(scene_marker_id INTEGER, tag_id INTEGER, UNIQUE(scene_marker_id,tag_id));
CREATE TABLE performers(id INTEGER PRIMARY KEY, country TEXT, ethnicity TEXT, rating INTEGER);
CREATE TABLE scene_marker_performers(scene_marker_id INTEGER, performer_id INTEGER, role TEXT,
 UNIQUE(scene_marker_id,performer_id,role));
INSERT INTO studios VALUES(1,NULL),(2,1),(3,2),(4,NULL);
INSERT INTO scenes VALUES(1,1),(2,2),(3,3),(4,4),(5,NULL);
INSERT INTO tags VALUES(10,'Family'),(11,'Child'),(12,'Grandchild'),(20,'Other'),(30,'Unrelated');
INSERT INTO tags_relations VALUES(10,11),(11,12);
INSERT INTO performers VALUES(1,'MX','Latino',80),(2,'US','White',90),(3,'MX','White',NULL);
INSERT INTO scene_markers(id,scene_id,primary_tag_id,seconds,end_seconds) VALUES
 (1,1,10,0,100),(2,1,20,20,40),
 (3,2,10,0,100),(4,2,20,20,40),
 (5,3,11,0,20),
 (6,4,10,0,10),(7,4,20,20,30),
 (8,5,12,0,NULL),(9,5,30,0,0),(10,NULL,10,0,5);
INSERT INTO scene_markers_tags VALUES(5,20),(1,10),(9,12);
INSERT INTO scene_marker_performers VALUES
 (1,1,'top'),(2,1,'bottom'),
 (3,1,'top'),(4,2,'bottom'),
 (5,1,'top'),(5,1,'bottom'),(5,2,'top'),(5,2,'bottom'),
 (6,1,'top'),(7,1,'bottom'),
 (8,1,'top'),(8,1,'bottom'),(8,2,'top'),
 (9,3,'top'),(9,3,'bottom');`)
	require.NoError(t, err)
	tx, err := db.BeginTxx(context.Background(), nil)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, tx.Rollback()) })
	return context.WithValue(context.Background(), txnKey, tx), tx
}

func TestMarkerCustomFilterOptimizations(t *testing.T) {
	ctx, tx := markerFilterFixtureCustom(t)
	for _, tc := range []struct {
		name, input string
		want        []int
	}{
		{"single_direct", `{"scene_marker_tags":{"modifier":"EQUALS","groups_extended":[{"tag_ids":["10"]}]}}`, []int{1, 3, 6, 10}},
		{"inherited_pair", `{"scene_marker_tags":{"modifier":"EQUALS","groups_extended":[{"tag_ids":["10","20"]}]}}`, []int{2, 4}},
		{"single_family", `{"scene_marker_tags":{"modifier":"EQUALS","groups_extended":[{"tag_ids":["10"],"depth":-1}]}}`, []int{1, 3, 5, 6, 8, 9, 10}},
		{"family_with_named", `{"scene_marker_tags":{"modifier":"EQUALS","groups_extended":[{"tag_ids":["10"],"depth":-1,"top_performer_ids":["2"]}]}}`, []int{5, 8}},
		{"single_exclusion", `{"scene_marker_tags":{"modifier":"NOT_EQUALS","groups_extended":[{"tag_ids":["10"]}]}}`, []int{2, 4, 5, 7, 8, 9}},
		{"shared_overlap", `{"scene_marker_tags":{"modifier":"EQUALS","overlap_groups":[{"tag_ids":["10"],"depth":-1,"top_unnamed_performers":[{"id":"a"}]},{"tag_ids":["20"],"bottom_unnamed_performers":[{"id":"a"}]}]}}`, []int{2, 5}},
		{"shared_overlap_attributes", `{"scene_marker_tags":{"modifier":"EQUALS","overlap_groups":[{"tag_ids":["10"],"depth":-1,"top_unnamed_performers":[{"id":"a","countries":["US"]}]},{"tag_ids":["20"],"bottom_unnamed_performers":[{"id":"a"}]}]}}`, []int{5}},
		{"shared_both_roles", `{"scene_marker_tags":{"modifier":"EQUALS","overlap_groups":[{"tag_ids":["10"],"depth":-1,"both_roles_unnamed_performers":[{"id":"a"}]},{"tag_ids":["20"],"bottom_unnamed_performers":[{"id":"a"}]}]}}`, []int{5}},
		{"excluded_overlap", `{"scene_marker_tags":{"modifier":"NOT_EQUALS","overlap_groups":[{"tag_ids":["10"],"depth":-1,"top_unnamed_performers":[{"id":"a"}]},{"tag_ids":["20"],"bottom_unnamed_performers":[{"id":"a"}]}]}}`, []int{1, 3, 4, 6, 7, 8, 9, 10}},
		{"circular", `{"custom_filters":{"type":"circular_oral","oral_tag_id":"10"}}`, []int{5, 9}},
		{"circular_secondary", `{"custom_filters":{"type":"circular_oral","oral_tag_id":"20"}}`, []int{5}},
		{"circular_invalid_id", `{"custom_filters":{"type":"circular_oral","oral_tag_id":"10 OR 1=1"}}`, nil},
		{"circular_combined", `{"custom_filters":{"type":"circular_oral","oral_tag_id":"10"},"has_roles":{"has_tops":true,"has_bottoms":true},"marker_length":{"value":10,"modifier":"GREATER_THAN_EQUALS"}}`, []int{5}},
		{"studio_direct", `{"studios":{"value":["1"],"modifier":"INCLUDES","depth":0}}`, []int{1, 2}},
		{"studio_children", `{"studios":{"value":["1"],"modifier":"INCLUDES","depth":1}}`, []int{1, 2, 3, 4}},
		{"studio_descendants", `{"studios":{"value":["1"],"modifier":"INCLUDES","depth":-1}}`, []int{1, 2, 3, 4, 5}},
		{"studio_excludes", `{"studios":{"value":["1"],"excludes":["2"],"modifier":"INCLUDES","depth":-1}}`, []int{1, 2}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var filter models.SceneMarkerFilterType
			require.NoError(t, json.Unmarshal([]byte(tc.input), &filter))
			q, err := (&SceneMarkerStore{}).makeQuery(ctx, &filter, nil)
			require.NoError(t, err)
			q.sortAndPagination = " ORDER BY scene_markers.id"
			var got []int
			require.NoError(t, tx.Select(&got, q.toSQL(true), q.allArgs()...))
			require.Equal(t, tc.want, got)
			count, err := q.executeCount(ctx)
			require.NoError(t, err)
			require.Equal(t, len(tc.want), count)
			duration, err := (&SceneMarkerStore{}).QueryDurationCustom(ctx, &filter, nil)
			require.NoError(t, err)
			var expectedDuration float64
			for _, id := range tc.want {
				var d float64
				require.NoError(t, tx.Get(&d, "SELECT CASE WHEN end_seconds > seconds THEN end_seconds-seconds ELSE 0 END FROM scene_markers WHERE id=?", id))
				expectedDuration += d
			}
			require.Equal(t, expectedDuration, duration)
		})
	}
	t.Run("circular_diamond_and_cycle", func(t *testing.T) {
		_, err := tx.Exec("INSERT INTO tags_relations VALUES(10,12),(12,10)")
		require.NoError(t, err)
		f := &filterBuilder{}
		addSceneMarkerCircularOralFilterCustom(f, "10")
		q := sceneMarkerRepository.newQuery()
		distinctIDs(&q, sceneMarkerTable)
		require.NoError(t, q.addFilter(f))
		q.sortAndPagination = " ORDER BY scene_markers.id"
		var got []int
		require.NoError(t, tx.Select(&got, q.toSQL(true), q.allArgs()...))
		require.Equal(t, []int{5, 9}, got)
	})
}

func TestMarkerSingleTagMatchesOriginalPredicateCustom(t *testing.T) {
	ctx, tx := markerFilterFixtureCustom(t)
	// Dense overlaps, equal lengths, absent ends, zero/reversed intervals and
	// duplicate primary/secondary tags exercise narrowest-marker selection.
	for i := 11; i <= 90; i++ {
		start := float64(i%7) * 2.5
		var end interface{} = start + float64(i%9-2)*5
		if i%4 == 0 {
			end = nil
		}
		_, err := tx.Exec("INSERT INTO scene_markers(id,scene_id,primary_tag_id,seconds,end_seconds) VALUES(?,?,?,?,?)", i, i%5+1, 10+i%3, start, end)
		require.NoError(t, err)
		_, err = tx.Exec("INSERT INTO scene_markers_tags VALUES(?,?)", i, 10+(i+1)%3)
		require.NoError(t, err)
	}
	for _, depth := range []int{0, -1} {
		ids := []interface{}{10}
		if depth == -1 {
			ids = []interface{}{10, 11, 12}
		}
		ph := getInBinding(len(ids))
		oldMatch := func(alias string) string {
			if depth == 0 {
				return sceneMarkerEffectiveTagsCountClauseCustom(alias, ph, 1)
			}
			return sceneMarkerHasEffectiveTagInClauseCustom(alias, ph)
		}
		oldSQL := fmt.Sprintf(`SELECT scene_markers.id FROM scene_markers WHERE %s AND %s
AND NOT EXISTS (SELECT 1 FROM scene_markers sm_narrow WHERE %s AND %s AND %s AND %s)
ORDER BY scene_markers.id`, sceneMarkerDirectHasTagInClauseCustom("scene_markers", ph), oldMatch("scene_markers"),
			sceneMarkerOverlapWhereCustom("scene_markers", "sm_narrow"), sceneMarkerDirectHasTagInClauseCustom("sm_narrow", ph),
			oldMatch("sm_narrow"), sceneMarkerIsNarrowerThanClauseCustom("sm_narrow", "scene_markers"))
		var args []interface{}
		for i := 0; i < 4; i++ {
			args = append(args, ids...)
		}
		var want []int
		require.NoError(t, tx.Select(&want, oldSQL, args...))
		filter := &models.SceneMarkerFilterType{SceneMarkerTags: &models.SceneMarkerTagsCriterionInput{
			Modifier: models.CriterionModifierEquals, GroupsExtended: []models.SceneMarkerTagGroupInput{{TagIDs: []string{"10"}, Depth: &depth}},
		}}
		q, err := (&SceneMarkerStore{}).makeQuery(ctx, filter, nil)
		require.NoError(t, err)
		q.sortAndPagination = " ORDER BY scene_markers.id"
		var got []int
		require.NoError(t, tx.Select(&got, q.toSQL(true), q.allArgs()...))
		require.Equal(t, want, got)
		q.sortAndPagination += " LIMIT 3 OFFSET 3"
		got = nil
		require.NoError(t, tx.Select(&got, q.toSQL(true), q.allArgs()...))
		require.Equal(t, want[3:6], got)
	}
}
