package sqlite

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/require"
)

// Explicit opt-in only: no normal test reads a user's library.
func TestStudioReadOnlyAuditCustom(t *testing.T) {
	path := os.Getenv("STASH_STUDIO_AUDIT_DB")
	if path == "" {
		t.Skip("set STASH_STUDIO_AUDIT_DB and STASH_STUDIO_AUDIT_TAG_IDS")
	}
	var tags map[string]interface{}
	require.NoError(t, json.Unmarshal([]byte(os.Getenv("STASH_STUDIO_AUDIT_TAG_IDS")), &tags))
	sceneSortTestConfigCustom(t, tags)
	db, err := sqlx.Open(sqlite3Driver, "file:"+filepath.ToSlash(path)+"?mode=ro")
	require.NoError(t, err)
	defer db.Close()
	tx, err := db.BeginTxx(context.Background(), nil)
	require.NoError(t, err)
	defer tx.Rollback()
	ctx := context.WithValue(context.Background(), txnKey, tx)
	var studioName string
	require.NoError(t, tx.Get(&studioName, `SELECT studios.name FROM studios JOIN scenes ON scenes.studio_id=studios.id GROUP BY studios.id ORDER BY COUNT(*) DESC LIMIT 1`))
	var scopedIDs []int
	require.NoError(t, tx.Select(&scopedIDs, "SELECT id FROM studios WHERE name = ?", studioName))
	sorts := []string{"sex_scenes_count", "oral_scenes_count", "solo_scenes_count", "facial_scenes_count", "unique_performers_count", "o_count"}
	for key := range studioMetallicSceneSortKeysCustom {
		sorts = append(sorts, key)
	}
	for key := range studioFacialMarkerSortKeysCustom {
		sorts = append(sorts, key)
	}
	for key := range studioRatingCriteriaSortKeysCustom {
		sorts = append(sorts, key)
	}
	for key := range studioRatingAdvisorAverageSortKeysCustom {
		sorts = append(sorts, key)
	}
	filters := map[string]string{
		"metallic":         `{"metallic_rating":{"value":["gold"],"modifier":"INCLUDES"}}`,
		"scene_rating":     `{"rating_criteria":{"criteria":[{"key":"chemistry","value":{"value":3,"modifier":"GREATER_THAN_EQUALS"}}]}}`,
		"performer_rating": `{"performer_rating_criteria":{"criteria":[{"key":"face","value":{"value":3,"modifier":"GREATER_THAN_EQUALS"}}]}}`,
		"scene_bonus":      `{"rating_criteria":{"bonuses":[{"key":"goat","value":true}]}}`,
		"performer_bonus":  `{"performer_rating_criteria":{"bonuses":[{"key":"face","value":false}]}}`,
	}
	for _, category := range []string{"sex", "oral", "solo", "other", "outstanding", "standard", "unclassified", "unusable"} {
		sorts = append(sorts, category+"_activity_percent")
		filters[category] = fmt.Sprintf(`{%q:{"value":25,"modifier":"GREATER_THAN_EQUALS"}}`, category+"_activity_percent")
	}
	type statement struct {
		SQL   string
		Args  []interface{}
		Error string
	}
	captured, baseline := map[string]statement{}, map[string]statement{}
	if path := os.Getenv("STASH_STUDIO_AUDIT_BASELINE"); path != "" {
		data, err := os.ReadFile(path)
		require.NoError(t, err)
		require.NoError(t, json.Unmarshal(data, &baseline))
	}
	run := func(t *testing.T, key string, q *queryBuilder) {
		t.Helper()
		stmt := statement{SQL: q.toSQL(true), Args: q.allArgs()}
		for i, arg := range stmt.Args {
			stmt.Args[i], err = driver.DefaultParameterConverter.ConvertValue(arg)
			require.NoError(t, err)
		}
		read := func(stmt statement) ([]int, time.Duration, error) {
			bounded, cancel := context.WithTimeout(ctx, 20*time.Second)
			defer cancel()
			var ids []int
			start := time.Now()
			err := tx.SelectContext(bounded, &ids, stmt.SQL, stmt.Args...)
			return ids, time.Since(start), err
		}
		got, after, queryErr := read(stmt)
		if queryErr != nil {
			stmt.Error = queryErr.Error()
		}
		captured[key] = stmt
		if queryErr != nil {
			if os.Getenv("STASH_STUDIO_AUDIT_BASELINE") != "" {
				require.NoError(t, queryErr)
			}
			t.Logf("query failed: %v", queryErr)
			return
		}
		if old, ok := baseline[key]; ok {
			brokenScoped := old.Error != "" && strings.HasSuffix(key, "scoped=true")
			if brokenScoped {
				require.Contains(t, old.Error, "parser stack overflow")
				old = baseline[strings.TrimSuffix(key, "true")+"false"]
			}
			require.Empty(t, old.Error)
			want, before, err := read(old)
			require.NoError(t, err)
			if brokenScoped {
				var restricted []int
				for _, id := range want {
					for _, scopedID := range scopedIDs {
						if id == scopedID {
							restricted = append(restricted, id)
							break
						}
					}
				}
				want = restricted
				t.Log("original scoped SQL exceeds parser depth; compared original unscoped results plus name scope")
			}
			require.Equal(t, want, got)
			t.Logf("rows=%d old=%s new=%s", len(got), before, after)
		} else {
			t.Logf("rows=%d query=%s", len(got), after)
		}
	}
	sort.Strings(sorts)
	for _, key := range sorts {
		for _, scoped := range []bool{false, true} {
			name := fmt.Sprintf("sort_%s/scoped=%v", key, scoped)
			t.Run(name, func(t *testing.T) {
				filter := &models.StudioFilterType{}
				if scoped {
					filter.Name = &models.StringCriterionInput{Value: studioName, Modifier: models.CriterionModifierEquals}
				}
				all := -1
				direction := models.SortDirectionEnumDesc
				q, err := (&StudioStore{}).makeQuery(ctx, filter, &models.FindFilterType{Sort: &key, Direction: &direction, PerPage: &all})
				require.NoError(t, err)
				run(t, name, q)
			})
		}
	}
	var names []string
	for name := range filters {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, key := range names {
		for _, scoped := range []bool{false, true} {
			name := fmt.Sprintf("filter_%s/scoped=%v", key, scoped)
			t.Run(name, func(t *testing.T) {
				var filter models.StudioFilterType
				require.NoError(t, json.Unmarshal([]byte(filters[key]), &filter))
				if scoped {
					filter.Name = &models.StringCriterionInput{Value: studioName, Modifier: models.CriterionModifierEquals}
				}
				q, err := (&StudioStore{}).makeQuery(ctx, &filter, nil)
				require.NoError(t, err)
				q.sortAndPagination = " ORDER BY studios.id"
				run(t, name, q)
			})
		}
	}
	if path := os.Getenv("STASH_STUDIO_AUDIT_CAPTURE"); path != "" {
		data, err := json.MarshalIndent(captured, "", "  ")
		require.NoError(t, err)
		require.NoError(t, os.WriteFile(path, data, 0600))
	}
}
