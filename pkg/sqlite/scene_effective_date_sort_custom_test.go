package sqlite

import (
	"context"
	"database/sql"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestSceneEffectiveDateSortCustom(t *testing.T) {
	db, err := sql.Open(sqlite3Driver, ":memory:")
	require.NoError(t, err)
	defer db.Close()
	_, err = db.Exec(`CREATE TABLE scenes(id INTEGER PRIMARY KEY, title TEXT, date TEXT);
CREATE TABLE scene_releases(scene_id INTEGER, date TEXT);
INSERT INTO scenes VALUES(1, 'One', NULL), (2, 'Two', '2025-01-01'),
 (3, 'Three', NULL), (4, 'Four', '9999-12-31'), (5, 'Five', ''), (6, 'Six', '2020-01-01');
INSERT INTO scene_releases VALUES(2, '2024-06-01'), (2, '2023-04-01'),
 (3, '2023-04-01'), (4, NULL), (5, '2024-01-01'), (6, ''), (6, NULL);`)
	require.NoError(t, err)
	for _, direction := range []models.SortDirectionEnum{models.SortDirectionEnumAsc, models.SortDirectionEnumDesc} {
		sort := "effective_date"
		all := -1
		query, err := (&SceneStore{}).makeQuery(context.Background(), nil, &models.FindFilterType{Sort: &sort, Direction: &direction, PerPage: &all})
		require.NoError(t, err)
		readIDs := func(sql string, args ...interface{}) []int {
			rows, err := db.Query(sql, args...)
			require.NoError(t, err)
			defer rows.Close()
			var ids []int
			for rows.Next() {
				var id int
				require.NoError(t, rows.Scan(&id))
				ids = append(ids, id)
			}
			require.NoError(t, rows.Err())
			return ids
		}
		old := "SELECT scenes.id FROM scenes ORDER BY " + EffectiveSceneDateSQLCustom("scenes") + " " + string(direction) + ", COALESCE(scenes.title, scenes.id) COLLATE NATURAL_CI ASC"
		want := readIDs(old)
		require.Equal(t, want, readIDs(query.toSQL(true), query.allArgs()...))
		require.NotContains(t, query.toSQL(false), "scene_sort_release_dates_custom")
		// Check pagination on a tie (the two 2023 release dates) in both directions.
		query.sortAndPagination += " LIMIT 2 OFFSET 1"
		require.Equal(t, want[1:3], readIDs(query.toSQL(true), query.allArgs()...))
	}
}
