package sqlite

import (
	"database/sql"
	"fmt"
	"reflect"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestMetallicRatingNoTierFilterCustom(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	// 1 unrated, 2 unrated with a Gold tag, 3 rated below Bronze (No Tier),
	// 4 Gold by rating, 5 Bronze by rating.
	for _, statement := range []string{
		`CREATE TABLE performers (id INTEGER PRIMARY KEY, rating INTEGER)`,
		`CREATE TABLE performers_tags (performer_id INTEGER, tag_id INTEGER)`,
		`INSERT INTO performers(id, rating) VALUES (1, NULL), (2, NULL), (3, 20), (4, 85), (5, 65)`,
		`INSERT INTO performers_tags(performer_id, tag_id) VALUES (2, 501)`,
	} {
		if _, err := db.Exec(statement); err != nil {
			t.Fatalf("execute %q: %v", statement, err)
		}
	}

	cfg := metallicRatingFilterConfig{
		primaryTable: "performers",
		ratingColumn: "performers.rating",
		tagJoinTable: "performers_tags",
		tagJoinFK:    "performer_id",
		thresholds:   defaultMetallicRatingThresholds,
		overrides:    metallicRatingOverrideTags{gold: "501"},
	}
	allTiers := []string{metallicTierBronze, metallicTierSilver, metallicTierGold, metallicTierRoyalSapphire}

	tests := map[string]struct {
		includes           []string
		includeNoTier      bool
		excludes           []string
		excludeNoTier      bool
		includeNonMetallic bool
		want               []int
	}{
		"metallic tiers only":            {includes: allTiers, want: []int{2, 4, 5}},
		"no tier only":                   {includeNoTier: true, want: []int{3}},
		"all five tiers skip unrated":    {includes: allTiers, includeNoTier: true, want: []int{2, 3, 4, 5}},
		"gold with no tier":              {includes: []string{metallicTierGold}, includeNoTier: true, want: []int{2, 3, 4}},
		"exclude no tier, metallic only": {excludeNoTier: true, want: []int{2, 4, 5}},
		"exclude no tier, keep unrated":  {excludeNoTier: true, includeNonMetallic: true, want: []int{1, 2, 4, 5}},
		"exclude gold and no tier":       {excludes: []string{metallicTierGold}, excludeNoTier: true, includeNonMetallic: true, want: []int{1, 5}},
	}
	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			clause := andClauses(cfg.filterClauses(tt.includes, tt.includeNoTier, tt.excludes, tt.excludeNoTier, tt.includeNonMetallic)...)
			rows, err := db.Query(fmt.Sprintf("SELECT performers.id FROM performers WHERE %s ORDER BY performers.id", clause.sql), clause.args...)
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
			if !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("got %v, want %v", got, tt.want)
			}
		})
	}
}
