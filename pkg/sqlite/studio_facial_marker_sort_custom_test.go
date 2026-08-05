package sqlite

import (
	"database/sql"
	"fmt"
	"strings"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestStudioFacialMarkerCountExpressionsSeparateStandardAndReallyHot(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	statements := []string{
		`CREATE TABLE studios (id INTEGER PRIMARY KEY)`,
		`CREATE TABLE scenes (id INTEGER PRIMARY KEY, studio_id INTEGER)`,
		`CREATE TABLE scene_markers (id INTEGER PRIMARY KEY, scene_id INTEGER, primary_tag_id INTEGER)`,
		`CREATE TABLE scene_markers_tags (scene_marker_id INTEGER, tag_id INTEGER)`,
		`CREATE TABLE tags_relations (parent_id INTEGER, child_id INTEGER)`,
		`INSERT INTO studios(id) VALUES (1), (2)`,
		`INSERT INTO scenes(id, studio_id) VALUES
      (1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1), (7, 2)`,
		`INSERT INTO scene_markers(id, scene_id, primary_tag_id) VALUES
      (1, 1, 100), (10, 1, 100),
      (2, 2, 100), (11, 2, 100),
      (3, 3, 100), (4, 3, 100),
      (5, 4, 101),
      (6, 5, 100), (7, 5, 200),
      (8, 6, 300),
      (9, 7, 300)`,
		`INSERT INTO scene_markers_tags(scene_marker_id, tag_id) VALUES
      (2, 200), (11, 200), (4, 200), (5, 201), (9, 100)`,
		`INSERT INTO tags_relations(parent_id, child_id) VALUES (100, 101), (200, 201)`,
	}
	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			t.Fatalf("execute %q: %v", statement, err)
		}
	}

	standardExpr := studioFacialMarkerCountExprForTagsCustom(studioFacialMarkerStandardCustom, 100, 200)
	reallyHotExpr := studioFacialMarkerCountExprForTagsCustom(studioFacialMarkerReallyHotCustom, 100, 200)
	query := fmt.Sprintf(`SELECT studios.id, %s, %s
FROM studios
ORDER BY studios.id`, standardExpr, reallyHotExpr)

	rows, err := db.Query(query)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()

	want := [][]int{{1, 4, 4}, {2, 1, 0}}
	rowCount := 0
	for ; rows.Next(); rowCount++ {
		if rowCount >= len(want) {
			t.Fatal("received more Studio rows than expected")
		}
		got := make([]int, 3)
		if err := rows.Scan(&got[0], &got[1], &got[2]); err != nil {
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

	var allFacialsWithoutQualifier int
	fallbackQuery := fmt.Sprintf(`SELECT %s FROM studios WHERE id = 1`,
		studioFacialMarkerCountExprForTagsCustom(studioFacialMarkerStandardCustom, 100, 0))
	if err := db.QueryRow(fallbackQuery).Scan(&allFacialsWithoutQualifier); err != nil {
		t.Fatal(err)
	}
	if allFacialsWithoutQualifier != 8 {
		t.Fatalf("standard marker count without a Really Hot tag = %d, want 8", allFacialsWithoutQualifier)
	}
}

func TestStudioFacialMarkerSortsRegisteredForBothDirections(t *testing.T) {
	for _, sort := range []string{
		"standard_facial_count",
		"really_hot_facial_count",
	} {
		if err := studioSortOptions.validateSort(sort); err != nil {
			t.Fatalf("Studio sort %s is not allowed: %v", sort, err)
		}

		variant := studioFacialMarkerSortKeysCustom[sort]
		expression := studioFacialMarkerCountExprForTagsCustom(variant, 100, 200)
		if expression == "" {
			t.Fatalf("missing Studio facial sort metric expression for %s", sort)
		}
		if clause := studioSortMetricOrderClauseCustom(expression, "ASC"); !strings.Contains(clause, " ORDER BY ") || !strings.HasSuffix(clause, " ASC") {
			t.Fatalf("ascending clause for %s = %q", sort, clause)
		}
		if clause := studioSortMetricOrderClauseCustom(expression, "DESC"); !strings.Contains(clause, " ORDER BY ") || !strings.HasSuffix(clause, " DESC") {
			t.Fatalf("descending clause for %s = %q", sort, clause)
		}
	}
}
