package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestInsightSceneIDsFilterCustom(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	defer db.Close()
	_, err = db.Exec("CREATE TABLE scenes (id INTEGER PRIMARY KEY); INSERT INTO scenes VALUES (1), (2), (3)")
	require.NoError(t, err)
	large := make([]string, 30000)
	for i := range large {
		large[i] = fmt.Sprint(i + 2)
	}
	for _, tc := range []struct {
		name  string
		ids   []string
		count int
	}{
		{"absent", nil, 3}, {"empty", []string{}, 0}, {"matching", []string{"1", "3", "3"}, 2}, {"large", large, 2},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := &filterBuilder{}
			insightSceneIDsCriterionHandler(tc.ids)(context.Background(), f)
			query := "SELECT COUNT(*) FROM scenes"
			var args []interface{}
			if len(f.whereClauses) > 0 {
				query += " WHERE " + f.whereClauses[0].sql
				args = f.whereClauses[0].args
			}
			var count int
			require.NoError(t, db.QueryRow(query, args...).Scan(&count))
			require.Equal(t, tc.count, count)
			// The predicate composes with normal scene filters and pagination.
			if tc.ids != nil {
				rows, err := db.Query("SELECT id FROM scenes WHERE "+f.whereClauses[0].sql+" AND id > 1 ORDER BY id DESC LIMIT 1", args...)
				require.NoError(t, err)
				defer rows.Close()
				if tc.count > 0 {
					require.True(t, rows.Next())
					var id int
					require.NoError(t, rows.Scan(&id))
					require.Equal(t, 3, id)
				} else {
					require.False(t, rows.Next())
				}
			}
		})
	}
}
