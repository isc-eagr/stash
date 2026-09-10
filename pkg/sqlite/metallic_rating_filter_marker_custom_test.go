package sqlite

import (
	"database/sql"
	"fmt"
	"reflect"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestSceneMetallicRatingFilterPromotesGoatMarkersToRoyalSapphire(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	statements := []string{
		`CREATE TABLE scenes (id INTEGER PRIMARY KEY, rating INTEGER)`,
		`CREATE TABLE scenes_tags (scene_id INTEGER, tag_id INTEGER)`,
		`CREATE TABLE scene_markers (id INTEGER PRIMARY KEY, scene_id INTEGER, primary_tag_id INTEGER, seconds REAL, end_seconds REAL)`,
		`CREATE TABLE scene_markers_tags (scene_marker_id INTEGER, tag_id INTEGER)`,
		`CREATE TABLE tags_relations (parent_id INTEGER, child_id INTEGER)`,
		`CREATE TABLE rating_bonus_scores (entity_type TEXT, entity_id INTEGER, key TEXT, raw_value REAL)`,
		`INSERT INTO scenes(id, rating) VALUES
			(1, 65), (2, 75), (3, 20), (4, 65), (5, 75),
			(6, 85), (7, 95), (8, 65), (9, 75), (10, 85)`,
		`INSERT INTO tags_relations(parent_id, child_id) VALUES (100, 101), (101, 102)`,
		`INSERT INTO scene_markers(id, scene_id, primary_tag_id, seconds, end_seconds) VALUES
			(1, 1, 100, 0, 10),
			(2, 2, 200, 0, 10),
			(3, 3, 102, 0, 10),
			(4, 8, 200, 0, 10)`,
		`INSERT INTO scene_markers_tags(scene_marker_id, tag_id) VALUES (2, 101)`,
		`INSERT INTO scenes_tags(scene_id, tag_id) VALUES (3, 501), (4, 100), (5, 500)`,
		`INSERT INTO rating_bonus_scores(entity_type, entity_id, key, raw_value) VALUES ('scene', 6, 'goatElement', 0.5)`,
	}
	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			t.Fatalf("execute %q: %v", statement, err)
		}
	}

	cfg := metallicRatingFilterConfig{
		primaryTable:              "scenes",
		ratingColumn:              "scenes.rating",
		tagJoinTable:              "scenes_tags",
		tagJoinFK:                 "scene_id",
		includeSceneRatingBonuses: true,
		includeSceneGoatMarkers:   true,
		thresholds:                defaultMetallicRatingThresholds,
		overrides: metallicRatingOverrideTags{
			gold:          "501",
			royalSapphire: "500",
			goat:          "100",
		},
	}

	wantByTier := map[string][]int{
		metallicTierRoyalSapphire: {1, 2, 3, 4, 5, 6, 7},
		metallicTierGold:          {10},
		metallicTierSilver:        {9},
		metallicTierBronze:        {8},
	}
	for _, tier := range []string{
		metallicTierRoyalSapphire,
		metallicTierGold,
		metallicTierSilver,
		metallicTierBronze,
	} {
		t.Run(tier, func(t *testing.T) {
			clause := cfg.tierClause(tier)
			rows, err := db.Query(fmt.Sprintf("SELECT scenes.id FROM scenes WHERE %s ORDER BY scenes.id", clause.sql), clause.args...)
			if err != nil {
				t.Fatal(err)
			}
			defer rows.Close()

			var got []int
			for rows.Next() {
				var id int
				if err := rows.Scan(&id); err != nil {
					t.Fatal(err)
				}
				got = append(got, id)
			}
			if err := rows.Err(); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(got, wantByTier[tier]) {
				t.Fatalf("%s scene IDs = %v, want %v", tier, got, wantByTier[tier])
			}
		})
	}
}

func TestMetallicRatingGoatMarkerPromotionIsSceneOnly(t *testing.T) {
	cfg := metallicRatingFilterConfig{
		primaryTable: "performers",
		ratingColumn: "performers.rating",
		tagJoinTable: "performers_tags",
		tagJoinFK:    "performer_id",
		thresholds:   defaultMetallicRatingThresholds,
		overrides: metallicRatingOverrideTags{
			goat: "100",
		},
	}

	if clause := cfg.goatMarkerClause(); clause.sql != "0 = 1" {
		t.Fatalf("non-scene GOAT marker clause = %q, want disabled predicate", clause.sql)
	}
}
