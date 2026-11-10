package sqlite

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/require"
)

// Optional read-only library audit. Capture SQL before changing a handler with
// STASH_FILTER_AUDIT_CAPTURE, then compare it using STASH_FILTER_AUDIT_BASELINE.
// Both paths are explicit so normal tests never read or write a user's library.
func TestSceneFilterReadOnlyAuditCustom(t *testing.T) {
	path := os.Getenv("STASH_SORT_AUDIT_DB")
	if path == "" {
		t.Skip("set STASH_SORT_AUDIT_DB and STASH_SORT_AUDIT_TAG_IDS")
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
	cases := map[string]string{
		"empty":                `{}`,
		"release_count":        `{"release_count":{"value":0,"modifier":"GREATER_THAN"}}`,
		"effective_date":       `{"effective_date":{"value":"2020-01-01","modifier":"GREATER_THAN"}}`,
		"metallic":             `{"metallic_rating":{"value":["royal_sapphire"],"modifier":"INCLUDES"}}`,
		"ratings":              `{"rating_criteria":{"bonus_values":[{"key":"goat","value":{"value":5,"modifier":"GREATER_THAN"}}]}}`,
		"marker_performers":    `{"has_marker_performers":"true"}`,
		"versatile":            `{"custom_filters":{"type":"versatile_scenes","sex_tag_id":"268"}}`,
		"circular":             `{"custom_filters":{"type":"circular_oral","oral_tag_id":"196"}}`,
		"ethnicity":            `{"performer_ethnicity":{"value":"Black,White","modifier":"INCLUDES_ALL"}}`,
		"country":              `{"performer_country":{"value":"USA","modifier":"INCLUDES"}}`,
		"performer_rating_all": `{"performer_rating":{"value":80,"modifier":"GREATER_THAN"}}`,
		"performer_rating_any": `{"performer_rating":{"value":80,"modifier":"GREATER_THAN"},"performer_rating_all":false}`,
		"marker_include":       `{"scene_marker_tags":{"modifier":"INCLUDES","value":["268"]}}`,
		"marker_group":         `{"scene_marker_tags":{"modifier":"EQUALS","groups":[["268"]]}}`,
		"marker_extended":      `{"scene_marker_tags":{"modifier":"EQUALS","groups_extended":[{"tag_ids":["268"],"top_any_count":1}]}}`,
		"insight_ids":          `{"insight_scene_ids":["1","2","3"]}`,
	}
	for _, typ := range []string{"sex", "oral", "solo", "facial"} {
		cases["type_"+typ] = fmt.Sprintf(`{"scene_type":{"types":[%q],"sex_tag_id":"268","oral_tag_id":"196","solo_tag_id":"24","facial_tag_id":"31"}}`, typ)
	}
	for _, category := range sceneActivitySortCategoriesCustom {
		cases["percent_"+string(category)] = fmt.Sprintf(`{%q:{"value":50,"modifier":"GREATER_THAN"}}`, string(category)+"_activity_percent")
	}
	type statement struct {
		SQL  string
		Args []interface{}
	}
	baseline := map[string]statement{}
	if path := os.Getenv("STASH_FILTER_AUDIT_BASELINE"); path != "" {
		data, err := os.ReadFile(path)
		require.NoError(t, err)
		require.NoError(t, json.Unmarshal(data, &baseline))
	}
	captured := map[string]statement{}
	names := make([]string, 0, len(cases))
	for name := range cases {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		input := cases[name]
		for _, scoped := range []bool{false, true} {
			name := fmt.Sprintf("%s/scoped=%v", name, scoped)
			t.Run(name, func(t *testing.T) {
				var filter models.SceneFilterType
				require.NoError(t, json.Unmarshal([]byte(input), &filter))
				if scoped {
					filter.ID = &models.IntCriterionInput{Value: 1000, Modifier: models.CriterionModifierLessThan}
				}
				start := time.Now()
				f := filterBuilderFromHandler(context.Background(), &sceneFilterHandler{&filter})
				require.NoError(t, f.getError())
				q := sceneRepository.newQuery()
				distinctIDs(&q, sceneTable)
				require.NoError(t, q.addFilter(f))
				q.columns = []string{"DISTINCT scenes.id", "0"}
				q.sortAndPagination = " ORDER BY scenes.id"
				built := time.Since(start)
				stmt := statement{q.toSQL(true), q.allArgs()}
				for i, arg := range stmt.Args {
					stmt.Args[i], err = driver.DefaultParameterConverter.ConvertValue(arg)
					require.NoError(t, err)
				}
				captured[name] = stmt
				start = time.Now()
				got := readSceneSortValuesCustom(t, tx, stmt.SQL, stmt.Args)
				after := time.Since(start)
				if old, ok := baseline[name]; ok {
					// Two original scoped predicates exceed SQLite's parser depth.
					// Use the original unscoped predicate and apply its ID bound
					// in Go so this comparison still has an independent oracle.
					brokenScoped := scoped && (strings.HasPrefix(name, "percent_standard/") || strings.HasPrefix(name, "percent_outstanding/"))
					if brokenScoped {
						old = baseline[strings.Replace(name, "scoped=true", "scoped=false", 1)]
					}
					for i, arg := range old.Args {
						if date, ok := arg.(map[string]interface{}); ok {
							old.Args[i] = date["Date"].(string)[:10]
						}
					}
					start = time.Now()
					want := readSceneSortValuesCustom(t, tx, old.SQL, old.Args)
					if brokenScoped {
						var filtered []sceneSortValueCustom
						for _, row := range want {
							if row.ID < 1000 {
								filtered = append(filtered, row)
							}
						}
						want = filtered
						t.Log("original scoped SQL overflows parser; compared using original full predicate plus ID bound")
					}
					before := time.Since(start)
					require.Equal(t, want, got)
					t.Logf("rows=%d old=%s new=%s build=%s", len(got), before.Round(time.Millisecond), after.Round(time.Millisecond), built)
				} else {
					t.Logf("rows=%d query=%s build=%s", len(got), after.Round(time.Millisecond), built)
				}
			})
		}
	}
	if path := os.Getenv("STASH_FILTER_AUDIT_CAPTURE"); path != "" {
		data, err := json.MarshalIndent(captured, "", "  ")
		require.NoError(t, err)
		require.NoError(t, os.WriteFile(path, data, 0600))
	}
}
