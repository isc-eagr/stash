package sqlite

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/require"
)

// Opt-in SQL capture/comparison; the library is always opened read-only.
func TestSceneMarkerReadOnlyAuditCustom(t *testing.T) {
	path := os.Getenv("STASH_MARKER_AUDIT_DB")
	if path == "" {
		t.Skip("set STASH_MARKER_AUDIT_DB for the read-only library audit")
	}
	db, err := sqlx.Open(sqlite3Driver, "file:"+filepath.ToSlash(path)+"?mode=ro")
	require.NoError(t, err)
	defer db.Close()
	tx, err := db.BeginTxx(context.Background(), nil)
	require.NoError(t, err)
	defer tx.Rollback()
	ctx := context.WithValue(context.Background(), txnKey, tx)
	var tags []int
	require.NoError(t, tx.Select(&tags, "SELECT primary_tag_id FROM scene_markers GROUP BY primary_tag_id ORDER BY COUNT(*) DESC LIMIT 2"))
	require.Len(t, tags, 2)
	var performer int
	require.NoError(t, tx.Get(&performer, "SELECT performer_id FROM scene_marker_performers GROUP BY performer_id ORDER BY COUNT(*) DESC LIMIT 1"))
	cases := map[string]string{
		"has_roles":        `{"has_roles":{"has_tops":true,"has_bottoms":true}}`,
		"no_roles":         `{"has_roles":{"has_tops":false,"has_bottoms":false}}`,
		"end_time":         `{"has_end_time":true}`,
		"length":           `{"marker_length":{"value":20,"modifier":"GREATER_THAN_EQUALS"}}`,
		"performer_count":  `{"scene_performer_count":{"value":2,"modifier":"EQUALS"}}`,
		"director":         `{"scene_director":{"value":"a","modifier":"INCLUDES"}}`,
		"country":          `{"performer_country":{"value":"USA","modifier":"INCLUDES"}}`,
		"ethnicity":        `{"performer_ethnicity":{"value":"Black,White","modifier":"INCLUDES_ALL"}}`,
		"rating":           `{"performer_rating":{"value":80,"modifier":"GREATER_THAN"}}`,
		"studio":           `{"studios":{"value":["1"],"modifier":"INCLUDES","depth":-1}}`,
		"circular":         fmt.Sprintf(`{"custom_filters":{"type":"circular_oral","oral_tag_id":"%d"}}`, tags[0]),
		"named":            fmt.Sprintf(`{"scene_marker_tags":{"modifier":"EQUALS","groups_extended":[{"top_performer_ids":["%d"]}]}}`, performer),
		"unnamed":          `{"scene_marker_tags":{"modifier":"EQUALS","groups_extended":[{"top_unnamed_performers":[{"countries":["USA"]}]}]}}`,
		"overlap_identity": fmt.Sprintf(`{"scene_marker_tags":{"modifier":"EQUALS","overlap_groups":[{"tag_ids":["%d"],"top_unnamed_performers":[{"id":"one"}]},{"tag_ids":["%d"],"bottom_unnamed_performers":[{"id":"one"}]}]}}`, tags[0], tags[1]),
	}
	for _, depth := range []int{0, -1} {
		for _, count := range []int{1, 2} {
			ids := fmt.Sprintf(`"%d"`, tags[0])
			if count == 2 {
				ids += fmt.Sprintf(`,"%d"`, tags[1])
			}
			cases[fmt.Sprintf("tags_%d_depth_%d", count, depth)] = fmt.Sprintf(`{"scene_marker_tags":{"modifier":"EQUALS","groups_extended":[{"tag_ids":[%s],"depth":%d}]}}`, ids, depth)
		}
	}
	type statement struct {
		SQL  string
		Args []interface{}
	}
	baseline, captured := map[string]statement{}, map[string]statement{}
	if path := os.Getenv("STASH_MARKER_AUDIT_BASELINE"); path != "" {
		data, err := os.ReadFile(path)
		require.NoError(t, err)
		require.NoError(t, json.Unmarshal(data, &baseline))
	}
	names := make([]string, 0, len(cases))
	for name := range cases {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		for _, scoped := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/scoped=%v", name, scoped), func(t *testing.T) {
				var filter models.SceneMarkerFilterType
				require.NoError(t, json.Unmarshal([]byte(cases[name]), &filter))
				q, err := (&SceneMarkerStore{}).makeQuery(ctx, &filter, nil)
				require.NoError(t, err)
				if scoped || name == "overlap_identity" {
					q.addWhere("scene_markers.scene_id <= 1000")
				}
				q.sortAndPagination = " ORDER BY scene_markers.id"
				stmt := statement{q.toSQL(true), q.allArgs()}
				for i, arg := range stmt.Args {
					stmt.Args[i], err = driver.DefaultParameterConverter.ConvertValue(arg)
					require.NoError(t, err)
				}
				key := fmt.Sprintf("%s/scoped=%v", name, scoped)
				captured[key] = stmt
				var got, want []int
				start := time.Now()
				require.NoError(t, tx.Select(&got, stmt.SQL, stmt.Args...))
				after := time.Since(start)
				if old, ok := baseline[key]; ok {
					start = time.Now()
					require.NoError(t, tx.Select(&want, old.SQL, old.Args...))
					before := time.Since(start)
					require.Equal(t, want, got)
					t.Logf("rows=%d old=%s new=%s", len(got), before, after)
				} else {
					t.Logf("rows=%d query=%s", len(got), after)
				}
			})
		}
	}
	if path := os.Getenv("STASH_MARKER_AUDIT_CAPTURE"); path != "" {
		data, err := json.MarshalIndent(captured, "", "  ")
		require.NoError(t, err)
		require.NoError(t, os.WriteFile(path, data, 0600))
	}
}
