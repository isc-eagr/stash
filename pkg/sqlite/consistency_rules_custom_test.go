package sqlite

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestMetallicTierSharedFixturesCustom(t *testing.T) {
	var fixtures []struct {
		Rating     *int
		Tags       []string
		Expected   *string
		Thresholds map[string]int
	}
	content, err := os.ReadFile("../../ui/v2.5/tests/fixtures/metallicTiers_custom.json")
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(content, &fixtures); err != nil {
		t.Fatal(err)
	}
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	for _, query := range []string{"CREATE TABLE performers(id INTEGER PRIMARY KEY, rating INTEGER)", "CREATE TABLE performers_tags(performer_id INTEGER, tag_id TEXT)"} {
		if _, err := db.Exec(query); err != nil {
			t.Fatal(err)
		}
	}
	for index, fixture := range fixtures {
		if _, err := db.Exec("DELETE FROM performers_tags"); err != nil {
			t.Fatal(err)
		}
		if _, err := db.Exec("DELETE FROM performers"); err != nil {
			t.Fatal(err)
		}
		if _, err := db.Exec("INSERT INTO performers(id,rating) VALUES(1,?)", fixture.Rating); err != nil {
			t.Fatal(err)
		}
		for _, tag := range fixture.Tags {
			if _, err := db.Exec("INSERT INTO performers_tags VALUES(1,?)", tag); err != nil {
				t.Fatal(err)
			}
		}
		thresholds := defaultMetallicRatingThresholds
		if fixture.Thresholds != nil {
			thresholds = metallicRatingThresholds{bronze: fixture.Thresholds["bronze"], silver: fixture.Thresholds["silver"], gold: fixture.Thresholds["gold"], royalSapphire: fixture.Thresholds["royalSapphire"]}
		}
		cfg := metallicRatingFilterConfig{primaryTable: "performers", ratingColumn: "performers.rating", tagJoinTable: "performers_tags", tagJoinFK: "performer_id", thresholds: thresholds, overrides: metallicRatingOverrideTags{bronze: "1", silver: "2", gold: "3", royalSapphire: "4", goat: "5"}}
		for _, tier := range []string{"none", "bronze", "silver", "gold", "royal_sapphire"} {
			clause := cfg.tierClause(tier)
			if tier == "none" {
				clause = cfg.noTierClause()
			}
			var matches bool
			if err := db.QueryRow("SELECT COALESCE(("+clause.sql+"),0) FROM performers", clause.args...).Scan(&matches); err != nil {
				t.Fatal(err)
			}
			want := fixture.Expected != nil && *fixture.Expected == tier
			if matches != want {
				t.Fatalf("fixture %d tier %s = %t, want %t", index, tier, matches, want)
			}
		}
	}
}

func TestMarkerQualityExclusiveAcrossStudioAndSceneCountsCustom(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	queries := []string{
		"CREATE TABLE studios(id INTEGER)", "CREATE TABLE scenes(id INTEGER,studio_id INTEGER)",
		"CREATE TABLE scene_markers(id INTEGER,scene_id INTEGER,primary_tag_id INTEGER)", "CREATE TABLE scene_markers_tags(scene_marker_id INTEGER,tag_id INTEGER)", "CREATE TABLE tags_relations(parent_id INTEGER,child_id INTEGER)",
		"INSERT INTO studios VALUES(1)", "INSERT INTO scenes VALUES(1,1)",
		"INSERT INTO scene_markers VALUES(1,1,100),(2,1,100),(3,1,100),(4,1,100),(5,1,101),(6,1,100)",
		"INSERT INTO scene_markers_tags VALUES(2,200),(3,300),(4,200),(4,300),(5,301),(6,201)",
		"INSERT INTO tags_relations VALUES(100,101),(200,201),(300,301)",
	}
	for _, query := range queries {
		if _, err := db.Exec(query); err != nil {
			t.Fatal(err)
		}
	}
	for quality, want := range map[string]int{"regular": 1, "really_hot": 2, "goat": 3} {
		expr := studioFacialMarkerCountExprForTagsCustom(quality, 100, 200, 300)
		var studio int
		if err := db.QueryRow("SELECT " + expr + " FROM studios").Scan(&studio); err != nil {
			t.Fatal(err)
		}
		if studio != want {
			t.Fatalf("studio %s=%d want %d", quality, studio, want)
		}
		condition := markerQualityConditionCustom("scene_count_marker", quality, 200, 300)
		var scene int
		query := fmt.Sprintf("SELECT value FROM (%s)", sceneMarkerCountSourceSQLCustom([]int{100}, condition))
		if err := db.QueryRow(query).Scan(&scene); err != nil {
			t.Fatal(err)
		}
		if scene != want {
			t.Fatalf("scene %s=%d want %d", quality, scene, want)
		}
	}
}
