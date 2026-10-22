package sqlite

import (
	"context"
	"database/sql"
	"testing"

	"github.com/jmoiron/sqlx"
)

func releaseTotalsTestCtxCustom(t *testing.T, schema string) context.Context {
	t.Helper()
	db, err := sqlx.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(schema); err != nil {
		t.Fatal(err)
	}
	tx, err := db.BeginTxx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = tx.Rollback() })
	return context.WithValue(context.Background(), txnKey, tx)
}

const releaseTotalsSchemaCustom = `
CREATE TABLE studios(id INTEGER PRIMARY KEY, parent_id INTEGER);
CREATE TABLE scenes(id INTEGER PRIMARY KEY, studio_id INTEGER);
CREATE TABLE scenes_o_dates(scene_id INTEGER, o_date DATETIME);
CREATE TABLE performers_scenes(performer_id INTEGER, scene_id INTEGER);
CREATE TABLE scene_releases(id INTEGER PRIMARY KEY, scene_id INTEGER, studio_id INTEGER);
CREATE TABLE scene_release_o_dates(release_id INTEGER, o_date DATETIME, video_timestamp REAL);
CREATE TABLE scene_release_performers(release_id INTEGER, performer_id INTEGER);
CREATE TABLE scene_release_stashdb_matches(release_id INTEGER PRIMARY KEY, matches INTEGER NOT NULL);
INSERT INTO studios VALUES (1, NULL), (2, NULL), (3, 2);
-- Scene 10 at studio 1 has 3 O's; its releases are at studios 2 and 3.
INSERT INTO scenes VALUES (10, 1), (11, 1), (12, 2);
INSERT INTO scenes_o_dates VALUES (10, '2026-01-01'), (10, '2026-01-02'), (10, NULL), (12, '2026-01-03');
INSERT INTO performers_scenes VALUES (7, 10);
INSERT INTO scene_releases VALUES (20, 10, 2), (21, 10, 3), (22, 11, 1), (23, 10, NULL);
INSERT INTO scene_release_o_dates VALUES (20, '2026-02-01', NULL), (20, '2026-02-02', NULL), (21, '2026-02-03', 10), (23, NULL, NULL);
INSERT INTO scene_release_performers VALUES (20, 7);
INSERT INTO scene_release_stashdb_matches VALUES (20, 4), (21, 5);`

func TestSceneReleaseGetSceneTotalsCustom(t *testing.T) {
	ctx := releaseTotalsTestCtxCustom(t, releaseTotalsSchemaCustom)
	totals, err := (&SceneReleaseStore{}).GetSceneTotalsCustom(ctx, []int{10, 11, 12})
	if err != nil {
		t.Fatal(err)
	}
	if got := totals[10]; got.OCount != 4 || got.StashDBMatches == nil || *got.StashDBMatches != 9 {
		t.Fatalf("scene 10: got %+v", got)
	}
	if got := totals[10].LastODate; got == nil || got.Format("2006-01-02") != "2026-02-03" {
		t.Fatalf("scene 10 last release O: got %v", got)
	}
	if got := totals[11]; got.OCount != 0 || got.StashDBMatches != nil || got.LastODate != nil {
		t.Fatalf("scene 11: got %+v", got)
	}
	if _, ok := totals[12]; ok {
		t.Fatalf("scene 12 has no releases but got %+v", totals[12])
	}
}

func TestSceneOCountByStudioIncludesOwnReleasesCustom(t *testing.T) {
	ctx := releaseTotalsTestCtxCustom(t, releaseTotalsSchemaCustom)
	qb := &SceneStore{tableMgr: sceneTableMgr}
	performerID := "7"
	depthAll := -1
	tests := []struct {
		name      string
		studioID  int
		depth     *int
		performer *string
		want      int
	}{
		// Release O's never credit the parent scene's studio.
		{"scene studio", 1, nil, nil, 3},
		{"release studio", 2, nil, nil, 3},
		{"child studio release", 3, nil, nil, 1},
		{"studio tree", 2, &depthAll, nil, 4},
		{"performer at release studio", 2, nil, &performerID, 2},
		{"performer at scene studio", 1, nil, &performerID, 3},
	}
	for _, tt := range tests {
		got, err := qb.OCountByStudioID(ctx, tt.studioID, tt.depth, tt.performer)
		if err != nil {
			t.Fatalf("%s: %v", tt.name, err)
		}
		if got != tt.want {
			t.Fatalf("%s: got %d, want %d", tt.name, got, tt.want)
		}
	}
}

func TestAdjustRatingsForSceneOCountChangeCountsReleaseOCustom(t *testing.T) {
	schema := `
CREATE TABLE scenes(id INTEGER PRIMARY KEY, rating INTEGER, updated_at DATETIME);
CREATE TABLE performers(id INTEGER PRIMARY KEY, rating INTEGER, updated_at DATETIME);
CREATE TABLE performers_scenes(performer_id INTEGER, scene_id INTEGER);
CREATE TABLE scenes_o_dates(scene_id INTEGER, o_date DATETIME);
CREATE TABLE scene_release_performers(release_id INTEGER, performer_id INTEGER);
CREATE TABLE scene_release_o_dates(release_id INTEGER, o_date DATETIME, video_timestamp REAL);
CREATE TABLE scene_releases(id INTEGER PRIMARY KEY, scene_id INTEGER);
INSERT INTO scene_releases VALUES (30, 99);
INSERT INTO scenes VALUES (1, 40, NULL);
INSERT INTO performers VALUES (7, 50, NULL);
INSERT INTO performers_scenes VALUES (7, 1);
-- After the new O: 2 on the scene plus 1 on the performer's release.
INSERT INTO scenes_o_dates VALUES (1, '2026-01-01'), (1, '2026-01-02');
INSERT INTO scene_release_performers VALUES (30, 7);
INSERT INTO scene_release_o_dates VALUES (30, '2026-01-03', NULL);`
	for _, table := range []string{"rating_criteria_scores", "rating_bonus_scores", "rating_penalty_scores"} {
		schema += `
CREATE TABLE ` + table + `(entity_type TEXT, entity_id INTEGER, raw_value REAL DEFAULT 0, weighted_value REAL DEFAULT 0);`
	}
	schema += `
INSERT INTO rating_criteria_scores VALUES ('performer', 7, 1, 1);`
	ctx := releaseTotalsTestCtxCustom(t, schema)
	if err := (&RatingScoreStore{}).AdjustRatingsForSceneOCountChangeCustom(ctx, 1, 1, 2); err != nil {
		t.Fatal(err)
	}
	var rating int
	if err := dbWrapper.Get(ctx, &rating, `SELECT rating FROM performers WHERE id = 7`); err != nil {
		t.Fatal(err)
	}
	want := 50 + calculateOrgasmRatingBonus("performer", 3) - calculateOrgasmRatingBonus("performer", 2)
	if rating != want {
		t.Fatalf("performer rating: got %d, want %d", rating, want)
	}
}

func TestAdjustRatingsForSceneOCountChangeCountsSceneReleaseOCustom(t *testing.T) {
	schema := `
CREATE TABLE scenes(id INTEGER PRIMARY KEY, rating INTEGER, updated_at DATETIME);
CREATE TABLE performers(id INTEGER PRIMARY KEY, rating INTEGER, updated_at DATETIME);
CREATE TABLE performers_scenes(performer_id INTEGER, scene_id INTEGER);
CREATE TABLE scenes_o_dates(scene_id INTEGER, o_date DATETIME);
CREATE TABLE scene_releases(id INTEGER PRIMARY KEY, scene_id INTEGER);
CREATE TABLE scene_release_performers(release_id INTEGER, performer_id INTEGER);
CREATE TABLE scene_release_o_dates(release_id INTEGER, o_date DATETIME, video_timestamp REAL);
INSERT INTO scenes VALUES (1, 40, NULL);
-- After the new O: 2 on the scene plus 1 on its release.
INSERT INTO scenes_o_dates VALUES (1, '2026-01-01'), (1, '2026-01-02');
INSERT INTO scene_releases VALUES (30, 1);
INSERT INTO scene_release_o_dates VALUES (30, '2026-01-03', NULL);`
	for _, table := range []string{"rating_criteria_scores", "rating_bonus_scores", "rating_penalty_scores"} {
		schema += `
CREATE TABLE ` + table + `(entity_type TEXT, entity_id INTEGER, raw_value REAL DEFAULT 0, weighted_value REAL DEFAULT 0);`
	}
	schema += `
INSERT INTO rating_criteria_scores VALUES ('scene', 1, 1, 1);`
	ctx := releaseTotalsTestCtxCustom(t, schema)
	if err := (&RatingScoreStore{}).AdjustRatingsForSceneOCountChangeCustom(ctx, 1, 1, 2); err != nil {
		t.Fatal(err)
	}
	var rating int
	if err := dbWrapper.Get(ctx, &rating, `SELECT rating FROM scenes WHERE id = 1`); err != nil {
		t.Fatal(err)
	}
	want := 40 + calculateOrgasmRatingBonus("scene", 3) - calculateOrgasmRatingBonus("scene", 2)
	if rating != want || want == 40 {
		t.Fatalf("scene rating: got %d, want %d", rating, want)
	}
}

func TestSceneAndGroupOTotalsSQLCustom(t *testing.T) {
	SetReleaseOEventsReadyCustom(true)
	t.Cleanup(func() { SetReleaseOEventsReadyCustom(false) })
	ctx := releaseTotalsTestCtxCustom(t, `
CREATE TABLE scenes(id INTEGER PRIMARY KEY);
CREATE TABLE groups(id INTEGER PRIMARY KEY);
CREATE TABLE groups_scenes(group_id INTEGER, scene_id INTEGER);
CREATE TABLE scenes_o_dates(scene_id INTEGER, o_date DATETIME);
CREATE TABLE scene_releases(id INTEGER PRIMARY KEY, scene_id INTEGER);
CREATE TABLE scene_release_o_dates(release_id INTEGER, o_date DATETIME);
CREATE TABLE scene_release_groups(release_id INTEGER, group_id INTEGER);
CREATE TABLE scene_stashdb_matches(scene_id INTEGER PRIMARY KEY, matches INTEGER);
CREATE TABLE scene_release_stashdb_matches(release_id INTEGER PRIMARY KEY, matches INTEGER);
INSERT INTO scenes VALUES (1), (2), (3);
INSERT INTO groups VALUES (7), (8);
-- Scene 1 is in group 7; its release 9 is only in group 8.
INSERT INTO groups_scenes VALUES (7, 1);
INSERT INTO scenes_o_dates VALUES (1, '2026-01-01 10:00:00'), (2, '2026-01-05 10:00:00');
INSERT INTO scene_releases VALUES (9, 1), (10, 3);
INSERT INTO scene_release_o_dates VALUES (9, '2026-02-01 10:00:00'), (9, NULL);
INSERT INTO scene_release_groups VALUES (9, 8);
INSERT INTO scene_stashdb_matches VALUES (1, 4);
INSERT INTO scene_release_stashdb_matches VALUES (9, 3), (10, 2);`)

	get := func(query string, args ...interface{}) sql.NullString {
		t.Helper()
		var got sql.NullString
		if err := dbWrapper.Get(ctx, &got, query, args...); err != nil {
			t.Fatal(err)
		}
		return got
	}
	for _, check := range []struct {
		expr  string
		scene int
		want  string
	}{
		{sceneTotalOCountSQLCustom("scenes.id"), 1, "3"},
		{sceneTotalOCountSQLCustom("scenes.id"), 3, "0"},
		{sceneLastOSQLCustom("scenes.id"), 1, "2026-02-01 10:00:00"},
		{sceneLastOSQLCustom("scenes.id"), 2, "2026-01-05 10:00:00"},
		{SceneTotalStashDBMatchesSQLCustom("scenes.id"), 1, "7"},
		{SceneTotalStashDBMatchesSQLCustom("scenes.id"), 3, "2"},
	} {
		if got := get(`SELECT `+check.expr+` FROM scenes WHERE id = ?`, check.scene); got.String != check.want {
			t.Fatalf("%s for scene %d: got %v, want %s", check.expr, check.scene, got, check.want)
		}
	}
	if got := get(`SELECT ` + sceneLastOSQLCustom("scenes.id") + ` FROM scenes WHERE id = 3`); got.Valid {
		t.Fatalf("scene without O's has last O %v", got)
	}
	if got := get(`SELECT ` + SceneTotalStashDBMatchesSQLCustom("scenes.id") + ` FROM scenes WHERE id = 2`); got.Valid {
		t.Fatalf("unscraped scene has StashDB Matches %v", got)
	}
	for groupID, want := range map[int]string{7: "1", 8: "2"} {
		if got := get(`SELECT `+groupTotalOCountSQLCustom()+` FROM groups WHERE id = ?`, groupID); got.String != want {
			t.Fatalf("group %d O count: got %v, want %s", groupID, got, want)
		}
	}
	if got, err := releaseOCountByGroupCustom(ctx, 8); err != nil || got != 2 {
		t.Fatalf("group 8 release O's = %d, %v", got, err)
	}
}
