package sqlite

import (
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// Optional read-only audit against a real library. Normal test runs use the
// deterministic fixture instead. Configuration must match that library's UI.
func TestSceneSortReadOnlyAuditCustom(t *testing.T) {
	path := os.Getenv("STASH_SORT_AUDIT_DB")
	if path == "" {
		t.Skip("set STASH_SORT_AUDIT_DB and STASH_SORT_AUDIT_TAG_IDS for a read-only library comparison")
	}
	var ids map[string]interface{}
	require.NoError(t, json.Unmarshal([]byte(os.Getenv("STASH_SORT_AUDIT_TAG_IDS")), &ids))
	sceneSortTestConfigCustom(t, ids)
	db, err := sql.Open(sqlite3Driver, "file:"+filepath.ToSlash(path)+"?mode=ro")
	require.NoError(t, err)
	defer db.Close()
	tx, err := db.Begin()
	require.NoError(t, err)
	defer tx.Rollback()
	for _, category := range sceneActivitySortCategoriesCustom {
		for _, scoped := range []bool{false, true} {
			for _, direction := range []string{"ASC", "DESC"} {
				base := sceneRepository.newQuery()
				distinctIDs(&base, sceneTable)
				if scoped {
					base.addWhere("scenes.studio_id = ?")
					base.addArg(1)
				}
				old := base
				old.columns = []string{"scenes.id", activityPercentScenePercentExprCustom(category)}
				old.sortAndPagination = " ORDER BY 2 " + direction + ", COALESCE(scenes.title, scenes.id) COLLATE NATURAL_CI ASC"
				order := (&SceneStore{}).sortByBatchedActivityPercentCustom(&base, category, direction)
				base.columns = []string{"scenes.id", strings.TrimSuffix(strings.TrimPrefix(order, " ORDER BY "), " "+direction)}
				base.sortAndPagination = order + ", COALESCE(scenes.title, scenes.id) COLLATE NATURAL_CI ASC"
				start := time.Now()
				want := readSceneSortValuesCustom(t, tx, old.toSQL(true), old.allArgs())
				before := time.Since(start)
				start = time.Now()
				got := readSceneSortValuesCustom(t, tx, base.toSQL(true), base.allArgs())
				after := time.Since(start)
				require.Len(t, got, len(want))
				for i := range want {
					if want[i] != got[i] {
						t.Fatalf("%s %s scoped=%v row %d: old=%+v new=%+v", category, direction, scoped, i, want[i], got[i])
					}
				}
				t.Logf("%s %s scoped=%v rows=%d old=%s new=%s (identical values/order)", category, direction, scoped, len(want), before.Round(time.Millisecond), after.Round(time.Millisecond))
			}
		}
	}
}
