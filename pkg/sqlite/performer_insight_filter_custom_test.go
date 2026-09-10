package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"testing"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"
)

func TestInsightPerformerIDsFilterCustom(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	defer db.Close()

	_, err = db.Exec("CREATE TABLE performers (id INTEGER PRIMARY KEY); INSERT INTO performers VALUES (1), (2), (3)")
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
		{"absent", nil, 3},
		{"empty", []string{}, 0},
		{"matching", []string{"1", "3", "3"}, 2},
		{"large", large, 2},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := &filterBuilder{}
			insightPerformerIDsCriterionHandlerCustom(tc.ids)(context.Background(), f)
			query := "SELECT COUNT(*) FROM performers"
			var args []interface{}
			if len(f.whereClauses) > 0 {
				query += " WHERE " + f.whereClauses[0].sql
				args = f.whereClauses[0].args
			}
			var count int
			require.NoError(t, db.QueryRow(query, args...).Scan(&count))
			require.Equal(t, tc.count, count)
		})
	}
}
