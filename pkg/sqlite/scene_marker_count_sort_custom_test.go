package sqlite

import (
	"database/sql"
	"strings"
	"testing"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSceneMarkerCountSortTagIDsCustom(t *testing.T) {
	tags := RoleTagIDs{OrgasmTagID: 1, FacialTagID: 2, ReallyHotTagID: 3}
	assert.Equal(t, []int{1}, sceneMarkerCountSortKeysCustom["orgasm_count"].tagIDs(tags))
	assert.Equal(t, []int{1, 3}, sceneMarkerCountSortKeysCustom["really_hot_orgasm_count"].tagIDs(tags))
	assert.Equal(t, []int{2}, sceneMarkerCountSortKeysCustom["facial_count"].tagIDs(tags))
	assert.Equal(t, []int{2, 3}, sceneMarkerCountSortKeysCustom["really_hot_facial_count"].tagIDs(tags))

	// Missing role tags make the sort a no-op instead of matching everything.
	assert.Nil(t, sceneMarkerCountSortKeysCustom["really_hot_facial_count"].tagIDs(RoleTagIDs{FacialTagID: 2}))
	assert.Nil(t, sceneMarkerCountSortKeysCustom["orgasm_count"].tagIDs(RoleTagIDs{}))

	for key := range sceneMarkerCountSortKeysCustom {
		require.NoError(t, sceneSortOptions.validateSort(key), key)
	}
}

func TestSceneMarkerCountSourceSQLCustomCountsPrimarySecondaryAndSubtags(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	// Tag 10 = facial, 11 = facial subtag, 20 = really hot, 30 = unrelated.
	_, err = db.Exec(`
CREATE TABLE scene_markers (id INTEGER PRIMARY KEY, scene_id INTEGER, primary_tag_id INTEGER);
CREATE TABLE scene_markers_tags (scene_marker_id INTEGER, tag_id INTEGER);
CREATE TABLE tags_relations (parent_id INTEGER, child_id INTEGER);
INSERT INTO tags_relations VALUES (10, 11);
INSERT INTO scene_markers VALUES
  (1, 100, 10), (2, 100, 30), (3, 100, 11),
  (4, 200, 30), (5, 200, 10), (6, 300, 30);
INSERT INTO scene_markers_tags VALUES
  (2, 10), (3, 20), (4, 11), (4, 20), (6, 20);
`)
	require.NoError(t, err)

	counts := func(tagIDs []int) map[int]int {
		rows, err := db.Query(sceneMarkerCountSourceSQLCustom(tagIDs))
		require.NoError(t, err)
		defer rows.Close()
		ret := map[int]int{}
		for rows.Next() {
			var sceneID, value int
			require.NoError(t, rows.Scan(&sceneID, &value))
			ret[sceneID] = value
		}
		require.NoError(t, rows.Err())
		return ret
	}

	assert.Equal(t, map[int]int{100: 3, 200: 2}, counts([]int{10}))
	assert.Equal(t, map[int]int{100: 1, 200: 1}, counts([]int{10, 20}))
	assert.True(t, strings.Contains(sceneMarkerCountSourceSQLCustom([]int{10, 20}), " AND "))
}
