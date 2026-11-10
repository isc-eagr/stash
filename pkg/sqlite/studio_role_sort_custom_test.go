package sqlite

import (
	"database/sql"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestStudioRoleSceneCountsCustom(t *testing.T) {
	db, err := sql.Open(sqlite3Driver, ":memory:")
	require.NoError(t, err)
	defer db.Close()
	_, err = db.Exec(`CREATE TABLE studios(id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE scenes(id INTEGER PRIMARY KEY, studio_id INTEGER);
CREATE TABLE scene_markers(id INTEGER PRIMARY KEY,scene_id INTEGER,primary_tag_id INTEGER);
CREATE TABLE scene_markers_tags(scene_marker_id INTEGER,tag_id INTEGER);
CREATE TABLE tags_relations(parent_id INTEGER,child_id INTEGER);
INSERT INTO studios VALUES(1,'One'),(2,'Two'),(3,'Empty');
INSERT INTO scenes VALUES(1,1),(2,1),(3,1),(4,1),(5,2);
INSERT INTO scene_markers VALUES(1,1,10),(2,1,10),(3,1,20),
 (4,2,20),(5,2,30),(6,3,30),(7,4,99),(8,5,11),
 (9,NULL,10),(10,NULL,20);
INSERT INTO scene_markers_tags VALUES(7,20),(1,10);
INSERT INTO tags_relations VALUES(10,11);`)
	require.NoError(t, err)
	for _, tc := range []struct {
		tag      int
		excluded []int
		want     []float64
	}{
		{10, nil, []float64{1, 1, 0}}, {20, []int{10}, []float64{2, 0, 0}},
		{30, []int{10, 20}, []float64{1, 0, 0}}, {0, nil, []float64{0, 0, 0}},
	} {
		rows := readSceneSortValuesCustom(t, db, "SELECT studios.id,"+studioRoleSceneCountExpressionCustom(tc.tag, tc.excluded...)+" FROM studios ORDER BY id", nil)
		for i, row := range rows {
			require.Equal(t, tc.want[i], row.Value)
		}
	}
	sceneSortTestConfigCustom(t, map[string]interface{}{})
	for _, sortKey := range []string{"sex_scenes_count", "oral_scenes_count", "solo_scenes_count", "facial_scenes_count", "standard_facial_count", "really_hot_facial_count"} {
		for _, direction := range []models.SortDirectionEnum{models.SortDirectionEnumAsc, models.SortDirectionEnumDesc} {
			order, err := (&StudioStore{}).getStudioSort(&models.FindFilterType{Sort: &sortKey, Direction: &direction})
			require.NoError(t, err)
			require.Len(t, readSceneSortValuesCustom(t, db, "SELECT id,0 FROM studios"+order, nil), 3)
		}
	}
}
