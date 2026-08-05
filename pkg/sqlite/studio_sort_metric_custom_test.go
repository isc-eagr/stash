package sqlite

import (
	"database/sql"
	"fmt"
	"strings"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestStudioMetallicSceneCountExpressionsHonorTiersAndOverrides(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	statements := []string{
		`CREATE TABLE studios (id INTEGER PRIMARY KEY)`,
		`CREATE TABLE scenes (id INTEGER PRIMARY KEY, studio_id INTEGER, rating INTEGER)`,
		`CREATE TABLE scenes_tags (scene_id INTEGER, tag_id INTEGER)`,
		`INSERT INTO studios(id) VALUES (1), (2)`,
		`INSERT INTO scenes(id, studio_id, rating) VALUES
      (1, 1, 95), (2, 1, 87), (3, 1, 75), (4, 1, 65), (5, 1, 50),
      (6, 2, 50), (7, 2, 95), (8, 2, 65), (9, 2, 50), (10, 2, 50)`,
		`INSERT INTO scenes_tags(scene_id, tag_id) VALUES
      (6, 100), (7, 101), (8, 100), (8, 101), (9, 102), (10, 103)`,
	}
	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			t.Fatalf("execute %q: %v", statement, err)
		}
	}

	cfg := metallicRatingFilterConfig{
		primaryTable: "studio_metallic_scene",
		ratingColumn: "studio_metallic_scene.rating",
		tagJoinTable: "scenes_tags",
		tagJoinFK:    "scene_id",
		thresholds:   defaultMetallicRatingThresholds,
		overrides: metallicRatingOverrideTags{
			bronze:        "101",
			gold:          "100",
			royalSapphire: "102",
			goat:          "103",
		},
	}
	query := fmt.Sprintf(`SELECT studios.id, %s, %s, %s, %s
FROM studios
ORDER BY studios.id`,
		studioMetallicSceneCountExprForConfigCustom(metallicTierRoyalSapphire, cfg),
		studioMetallicSceneCountExprForConfigCustom(metallicTierGold, cfg),
		studioMetallicSceneCountExprForConfigCustom(metallicTierSilver, cfg),
		studioMetallicSceneCountExprForConfigCustom(metallicTierBronze, cfg),
	)

	rows, err := db.Query(query)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()

	want := [][]int{{1, 1, 1, 1, 1}, {2, 2, 2, 0, 1}}
	rowCount := 0
	for ; rows.Next(); rowCount++ {
		if rowCount >= len(want) {
			t.Fatal("received more Studio rows than expected")
		}
		got := make([]int, 5)
		if err := rows.Scan(&got[0], &got[1], &got[2], &got[3], &got[4]); err != nil {
			t.Fatal(err)
		}
		for column := range got {
			if got[column] != want[rowCount][column] {
				t.Fatalf("row %d column %d = %d, want %d\nquery: %s", rowCount, column, got[column], want[rowCount][column], query)
			}
		}
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	if rowCount != len(want) {
		t.Fatalf("received %d Studio rows, want %d", rowCount, len(want))
	}
}

func TestStudioMetallicSceneSortsRegisteredForBothDirections(t *testing.T) {
	cfg := metallicRatingFilterConfig{
		primaryTable: "studio_metallic_scene",
		ratingColumn: "studio_metallic_scene.rating",
		tagJoinTable: "scenes_tags",
		tagJoinFK:    "scene_id",
		thresholds:   defaultMetallicRatingThresholds,
	}
	for _, sort := range []string{
		"royal_sapphire_scenes_count",
		"gold_scenes_count",
		"silver_scenes_count",
		"bronze_scenes_count",
	} {
		if err := studioSortOptions.validateSort(sort); err != nil {
			t.Fatalf("Studio sort %s is not allowed: %v", sort, err)
		}

		tier := studioMetallicSceneSortKeysCustom[sort]
		expression := studioMetallicSceneCountExprForConfigCustom(tier, cfg)
		if expression == "" {
			t.Fatalf("missing Studio sort metric expression for %s", sort)
		}
		if clause := studioSortMetricOrderClauseCustom(expression, "ASC"); !strings.Contains(clause, " ORDER BY ") || !strings.HasSuffix(clause, " ASC") {
			t.Fatalf("ascending clause for %s = %q", sort, clause)
		}
		if clause := studioSortMetricOrderClauseCustom(expression, "DESC"); !strings.Contains(clause, " ORDER BY ") || !strings.HasSuffix(clause, " DESC") {
			t.Fatalf("descending clause for %s = %q", sort, clause)
		}
	}
}
