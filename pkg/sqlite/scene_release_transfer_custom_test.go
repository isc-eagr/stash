package sqlite

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
	"github.com/stashapp/stash/pkg/models"
)

func TestSceneReleaseMetadataRoundTripCustom(t *testing.T) {
	db, err := sqlx.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	const base = `
CREATE TABLE scenes(id INTEGER PRIMARY KEY, rating INTEGER, organized BOOLEAN, resume_time REAL, play_duration REAL);
CREATE TABLE scene_releases(id INTEGER PRIMARY KEY, scene_id INTEGER, url TEXT);
CREATE TABLE scenes_galleries(scene_id INTEGER, gallery_id INTEGER);
CREATE TABLE scene_release_galleries(release_id INTEGER, gallery_id INTEGER);
CREATE TABLE scene_urls(scene_id INTEGER, position INTEGER, url TEXT);
CREATE TABLE performers_scenes(scene_id INTEGER, performer_id INTEGER);
CREATE TABLE scenes_tags(scene_id INTEGER, tag_id INTEGER);
CREATE TABLE groups_scenes(scene_id INTEGER, group_id INTEGER, scene_index TEXT);
CREATE TABLE scene_stash_ids(scene_id INTEGER, endpoint TEXT, stash_id TEXT, updated_at TEXT);
CREATE TABLE scene_custom_fields(scene_id INTEGER, field TEXT, value BLOB);
CREATE TABLE scenes_view_dates(scene_id INTEGER, view_date TEXT);
CREATE TABLE scenes_o_dates(scene_id INTEGER, o_date TEXT, video_timestamp REAL);
CREATE TABLE tags(id INTEGER PRIMARY KEY);
CREATE TABLE performers(id INTEGER PRIMARY KEY);
CREATE TABLE groups(id INTEGER PRIMARY KEY);
CREATE TABLE scene_markers(id INTEGER PRIMARY KEY, title TEXT NOT NULL, seconds REAL NOT NULL, primary_tag_id INTEGER NOT NULL, scene_id INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, end_seconds REAL);
CREATE TABLE scene_markers_tags(scene_marker_id INTEGER, tag_id INTEGER, FOREIGN KEY(scene_marker_id) REFERENCES scene_markers(id) ON DELETE CASCADE);
CREATE TABLE scene_marker_performers(scene_marker_id INTEGER, performer_id INTEGER, role TEXT, FOREIGN KEY(scene_marker_id) REFERENCES scene_markers(id) ON DELETE CASCADE);
CREATE TABLE scene_negative_markers(id INTEGER PRIMARY KEY, scene_id INTEGER NOT NULL, name TEXT NOT NULL, start_seconds REAL NOT NULL, end_seconds REAL NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL);
CREATE TABLE scene_multi_segment_loop_presets(id INTEGER PRIMARY KEY, scene_id INTEGER NOT NULL, name TEXT NOT NULL, segments TEXT NOT NULL, enabled BOOLEAN NOT NULL, current_segment_index INTEGER NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL);
CREATE TABLE rating_criteria_scores(entity_type TEXT, entity_id INTEGER, key TEXT, raw_value REAL);
CREATE TABLE rating_bonus_scores(entity_type TEXT, entity_id INTEGER, key TEXT, raw_value REAL);
CREATE TABLE rating_penalty_scores(entity_type TEXT, entity_id INTEGER, key TEXT, raw_value REAL);
CREATE TABLE scene_release_rating_upgrade_guard(applied_at TEXT);
INSERT INTO scenes VALUES (1, 87, 1, 14.5, 123.25), (2, NULL, 0, 0, 0);
INSERT INTO performers VALUES (11), (12);
INSERT INTO groups VALUES (31);
INSERT INTO tags VALUES (21);
INSERT INTO scene_releases VALUES (8, 2, 'https://first.example');
INSERT INTO scene_urls VALUES (1, 0, 'https://first.example'), (1, 1, 'https://second.example');
INSERT INTO performers_scenes VALUES (1, 11), (1, 12);
INSERT INTO scenes_tags VALUES (1, 21);
INSERT INTO groups_scenes VALUES (1, 31, '7');
INSERT INTO scene_stash_ids VALUES (1, 'https://stash.example', 'remote-1', '2024-01-01');
INSERT INTO scene_custom_fields VALUES (1, 'source', x'010203');
INSERT INTO scenes_view_dates VALUES (1, '2024-02-01'), (1, '2024-02-01');
INSERT INTO scenes_o_dates VALUES (1, '2024-03-01', 9.5), (1, '2024-03-01', 9.5);
INSERT INTO rating_criteria_scores VALUES ('scene', 1, 'chemistry', 8);
INSERT INTO rating_bonus_scores VALUES ('scene', 1, 'bonus', 3);
INSERT INTO rating_penalty_scores VALUES ('scene', 1, 'penalty', 1);`
	if _, err := db.Exec(base); err != nil {
		t.Fatal(err)
	}
	upgrade, err := os.ReadFile("../../scene_releases_metadata_v2.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(string(upgrade)); err != nil {
		t.Fatalf("metadata upgrade SQL: %v", err)
	}
	tx, err := db.BeginTxx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	ctx := context.WithValue(context.Background(), txnKey, tx)
	store := &SceneReleaseStore{}
	if err := store.TransferSceneMetadataToReleaseCustom(ctx, 1, 8); err != nil {
		t.Fatal(err)
	}
	if _, err := tx.Exec(`INSERT INTO scenes VALUES (3, NULL, 0, 0, 0)`); err != nil {
		t.Fatal(err)
	}
	if err := store.TransferReleaseMetadataToSceneCustom(ctx, 8, 3); err != nil {
		t.Fatal(err)
	}
	var row struct {
		Rating       int     `db:"rating"`
		Organized    bool    `db:"organized"`
		ResumeTime   float64 `db:"resume_time"`
		PlayDuration float64 `db:"play_duration"`
	}
	if err := tx.Get(&row, `SELECT rating,organized,resume_time,play_duration FROM scenes WHERE id = 3`); err != nil {
		t.Fatal(err)
	}
	if row.Rating != 87 || !row.Organized || row.ResumeTime != 14.5 || row.PlayDuration != 123.25 {
		t.Fatalf("scalar metadata changed: %+v", row)
	}
	checks := []struct {
		query string
		want  int
	}{
		{`SELECT COUNT(*) FROM scene_urls WHERE scene_id = 3`, 2},
		{`SELECT COUNT(*) FROM performers_scenes WHERE scene_id = 3`, 2},
		{`SELECT COUNT(*) FROM scenes_tags WHERE scene_id = 3`, 1},
		{`SELECT COUNT(*) FROM groups_scenes WHERE scene_id = 3 AND scene_index = '7'`, 1},
		{`SELECT COUNT(*) FROM scene_stash_ids WHERE scene_id = 3 AND stash_id = 'remote-1'`, 1},
		{`SELECT COUNT(*) FROM scene_custom_fields WHERE scene_id = 3 AND value = x'010203'`, 1},
		{`SELECT COUNT(*) FROM scenes_view_dates WHERE scene_id = 3`, 2},
		{`SELECT COUNT(*) FROM scenes_o_dates WHERE scene_id = 3 AND video_timestamp = 9.5`, 2},
		{`SELECT COUNT(*) FROM rating_criteria_scores WHERE entity_type = 'scene' AND entity_id = 3`, 1},
		{`SELECT COUNT(*) FROM rating_bonus_scores WHERE entity_type = 'scene' AND entity_id = 3`, 1},
		{`SELECT COUNT(*) FROM rating_penalty_scores WHERE entity_type = 'scene' AND entity_id = 3`, 1},
		{`SELECT COUNT(*) FROM scenes_view_dates WHERE scene_id = 2`, 0},
	}
	for _, check := range checks {
		var got int
		if err := tx.Get(&got, check.query); err != nil {
			t.Fatal(err)
		}
		if got != check.want {
			t.Fatalf("%s: got %d, want %d", check.query, got, check.want)
		}
	}
	if _, err := tx.Exec(`INSERT INTO scenes VALUES (4, NULL, 0, 0, 0);
INSERT INTO scene_releases VALUES (9, 2, '');
INSERT INTO scene_markers VALUES (99, 'marker', 12.5, 21, 4, '2024-01-01', '2024-01-02', 13.5);
INSERT INTO scene_markers_tags VALUES (99, 21);
INSERT INTO scene_marker_performers VALUES (99, 11, 'top');
INSERT INTO scene_negative_markers VALUES (55, 4, 'skip', 2, 3, '2024-01-01', '2024-01-02');
INSERT INTO scene_multi_segment_loop_presets VALUES (66, 4, 'loop', '[]', 1, 0, '2024-01-01', '2024-01-02')`); err != nil {
		t.Fatal(err)
	}
	// The existing app must still read seven/eight-column tables before the
	// standalone release-activity upgrade is applied.
	legacySkips, err := NewSceneNegativeMarkerStore().FindByScene(ctx, 4)
	if err != nil || len(legacySkips) != 1 || legacySkips[0].ID != 55 || legacySkips[0].ReleaseID != nil {
		t.Fatalf("legacy negative markers = %v, err = %v", legacySkips, err)
	}
	legacyLoops, err := NewSceneLoopPresetStore().FindByScene(ctx, 4)
	if err != nil || len(legacyLoops) != 1 || legacyLoops[0].ID != 66 || legacyLoops[0].ReleaseID != nil {
		t.Fatalf("legacy loop presets = %v, err = %v", legacyLoops, err)
	}
	if err := store.TransferSceneMetadataToReleaseCustom(ctx, 4, 9); err == nil || !strings.Contains(err.Error(), "markers") {
		t.Fatalf("expected marker ownership guard, got %v", err)
	}
	var guardedRows int
	if err := tx.Get(&guardedRows, `SELECT COUNT(*) FROM scene_release_metadata WHERE release_id = 9`); err != nil {
		t.Fatal(err)
	}
	if guardedRows != 0 {
		t.Fatal("marker guard left a partial transfer")
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	activityUpgrade, err := os.ReadFile("../../scene_releases_activity_v2.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(string(activityUpgrade)); err != nil {
		t.Fatalf("activity upgrade SQL: %v", err)
	}
	var foreignKeyIssues int
	if err := db.Get(&foreignKeyIssues, `SELECT COUNT(*) FROM pragma_foreign_key_check`); err != nil {
		t.Fatal(err)
	}
	if foreignKeyIssues != 0 {
		t.Fatalf("activity upgrade left %d foreign-key issues", foreignKeyIssues)
	}
	tx, err = db.BeginTxx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	ctx = context.WithValue(context.Background(), txnKey, tx)
	if err := store.TransferSceneMetadataToReleaseCustom(ctx, 4, 9); err != nil {
		t.Fatal(err)
	}
	for _, check := range []struct {
		table, idCol string
		id           int
	}{
		{"scene_markers", "id", 99},
		{"scene_negative_markers", "id", 55},
		{"scene_multi_segment_loop_presets", "id", 66},
	} {
		var owner int
		if err := tx.Get(&owner, `SELECT release_id FROM `+check.table+` WHERE `+check.idCol+` = ?`, check.id); err != nil {
			t.Fatal(err)
		}
		if owner != 9 {
			t.Fatalf("%s %d release owner = %d, want 9", check.table, check.id, owner)
		}
	}
	markers, err := store.GetMarkersCustom(ctx, 9)
	if err != nil || len(markers) != 1 || markers[0].ID != 99 || markers[0].ReleaseID == nil || *markers[0].ReleaseID != 9 {
		t.Fatalf("release markers = %v, err = %v", markers, err)
	}
	negativeMarkers, err := store.GetNegativeMarkersCustom(ctx, 9)
	if err != nil || len(negativeMarkers) != 1 || negativeMarkers[0].ID != 55 || negativeMarkers[0].ReleaseID == nil || *negativeMarkers[0].ReleaseID != 9 {
		t.Fatalf("release negative markers = %v, err = %v", negativeMarkers, err)
	}
	loopPresets, err := store.GetLoopPresetsCustom(ctx, 9)
	if err != nil || len(loopPresets) != 1 || loopPresets[0].ID != 66 || loopPresets[0].ReleaseID == nil || *loopPresets[0].ReleaseID != 9 {
		t.Fatalf("release loop presets = %v, err = %v", loopPresets, err)
	}
	if _, err := tx.Exec(`INSERT INTO scenes VALUES (5, NULL, 0, 0, 0)`); err != nil {
		t.Fatal(err)
	}
	if err := store.TransferReleaseMetadataToSceneCustom(ctx, 9, 5); err != nil {
		t.Fatal(err)
	}
	upgradedSkips, err := NewSceneNegativeMarkerStore().FindByScene(ctx, 5)
	if err != nil || len(upgradedSkips) != 1 || upgradedSkips[0].ID != 55 || upgradedSkips[0].ReleaseID != nil {
		t.Fatalf("upgraded negative markers = %v, err = %v", upgradedSkips, err)
	}
	upgradedLoops, err := NewSceneLoopPresetStore().FindByScene(ctx, 5)
	if err != nil || len(upgradedLoops) != 1 || upgradedLoops[0].ID != 66 || upgradedLoops[0].ReleaseID != nil {
		t.Fatalf("upgraded loop presets = %v, err = %v", upgradedLoops, err)
	}
	for _, table := range []string{"scene_markers", "scene_negative_markers", "scene_multi_segment_loop_presets"} {
		var count int
		if err := tx.Get(&count, `SELECT COUNT(*) FROM `+table+` WHERE scene_id = 5 AND release_id IS NULL`); err != nil {
			t.Fatal(err)
		}
		if count != 1 {
			t.Fatalf("%s restoration count = %d, want 1", table, count)
		}
	}
	for _, table := range []string{"scene_markers_tags", "scene_marker_performers"} {
		var count int
		if err := tx.Get(&count, `SELECT COUNT(*) FROM `+table+` WHERE scene_marker_id = 99`); err != nil {
			t.Fatal(err)
		}
		if count != 1 {
			t.Fatalf("%s marker reference count = %d, want 1", table, count)
		}
	}
	if _, err := tx.Exec(`INSERT INTO scene_markers VALUES (100, 'new marker', 14, 21, 4, NULL, '2024-01-01', '2024-01-02', NULL)`); err != nil {
		t.Fatal(err)
	}
	if err := store.MoveMarkerToReleaseCustom(ctx, 100, 9); err != nil {
		t.Fatal(err)
	}
	markers, err = store.GetMarkersCustom(ctx, 9)
	if err != nil || len(markers) != 1 || markers[0].ID != 100 || markers[0].ReleaseID == nil || *markers[0].ReleaseID != 9 {
		t.Fatalf("moved release marker = %v, err = %v", markers, err)
	}
	newSkip := &models.SceneNegativeMarker{Name: "intro", StartSeconds: 1, EndSeconds: 3}
	if err := store.SaveNegativeMarkerCustom(ctx, 9, newSkip); err != nil {
		t.Fatal(err)
	}
	if newSkip.ReleaseID == nil || *newSkip.ReleaseID != 9 || newSkip.SceneID != 0 {
		t.Fatalf("new skip owner = %+v", newSkip)
	}
	newSkip.Name = "opening"
	if err := store.SaveNegativeMarkerCustom(ctx, 8, newSkip); err == nil {
		t.Fatal("cross-release skip update was allowed")
	}
	if err := store.SaveNegativeMarkerCustom(ctx, 9, newSkip); err != nil {
		t.Fatal(err)
	}
	if err := store.DeleteNegativeMarkerCustom(ctx, 8, newSkip.ID); err == nil {
		t.Fatal("cross-release skip deletion was allowed")
	}
	if err := store.DeleteNegativeMarkerCustom(ctx, 9, newSkip.ID); err != nil {
		t.Fatal(err)
	}
	newLoop := &models.SceneLoopPreset{Name: "best", Enabled: true, Segments: []models.SceneLoopSegment{{Start: 2, End: 4}}}
	if err := store.SaveLoopPresetCustom(ctx, 9, newLoop); err != nil {
		t.Fatal(err)
	}
	if newLoop.ReleaseID == nil || *newLoop.ReleaseID != 9 || newLoop.SceneID != 0 {
		t.Fatalf("new loop owner = %+v", newLoop)
	}
	newLoop.Segments[0].End = 6
	if err := store.SaveLoopPresetCustom(ctx, 9, newLoop); err != nil {
		t.Fatal(err)
	}
	if newLoop.Segments[0].End != 6 {
		t.Fatalf("loop preset update lost segments: %+v", newLoop.Segments)
	}
	if err := store.DeleteLoopPresetCustom(ctx, 8, "best"); err == nil {
		t.Fatal("cross-release loop deletion was allowed")
	}
	if err := store.DeleteLoopPresetCustom(ctx, 9, "best"); err != nil {
		t.Fatal(err)
	}
	rating := 91
	if err := store.UpdateExtendedCustom(ctx, 9, models.SceneReleaseExtendedUpdateCustom{
		RatingSet: true, Rating: &rating,
		OrganizedSet: true, Organized: true,
		URLsSet: true, URLs: []string{"https://one.example", "https://two.example"},
		PerformerIDsSet: true, PerformerIDs: []int{11},
		TagIDsSet: true, TagIDs: []int{21},
		CustomFields: &models.CustomFieldsInput{Full: map[string]interface{}{"quality": "gold"}},
	}); err != nil {
		t.Fatal(err)
	}
	metadata, err := store.GetMetadataCustom(ctx, 9)
	if err != nil {
		t.Fatal(err)
	}
	if metadata.Rating == nil || *metadata.Rating != 91 || !metadata.Organized {
		t.Fatalf("release edit metadata = %+v", metadata)
	}
	urls, err := store.GetURLsCustom(ctx, 9)
	if err != nil || len(urls) != 2 || urls[1] != "https://two.example" {
		t.Fatalf("release URLs = %v, err = %v", urls, err)
	}
	fields, err := store.GetCustomFieldsCustom(ctx, 9)
	if err != nil || fields["quality"] != "gold" {
		t.Fatalf("release custom fields = %v, err = %v", fields, err)
	}
	if err := store.UpdateExtendedCustom(ctx, 9, models.SceneReleaseExtendedUpdateCustom{
		RatingSet: true, OrganizedSet: true,
		URLsSet: true, PerformerIDsSet: true, TagIDsSet: true,
		CustomFields: &models.CustomFieldsInput{Full: map[string]interface{}{}},
	}); err != nil {
		t.Fatal(err)
	}
	metadata, err = store.GetMetadataCustom(ctx, 9)
	if err != nil {
		t.Fatal(err)
	}
	if metadata.Rating != nil || metadata.Organized {
		t.Fatalf("release fields did not clear: %+v", metadata)
	}
	urls, err = store.GetURLsCustom(ctx, 9)
	if err != nil || len(urls) != 0 {
		t.Fatalf("release URLs did not clear: %v, err = %v", urls, err)
	}
	for _, table := range []string{"scene_release_performers", "scene_release_tags", "scene_release_custom_fields"} {
		var count int
		if err := tx.Get(&count, `SELECT COUNT(*) FROM `+table+` WHERE release_id = 9`); err != nil {
			t.Fatal(err)
		}
		if count != 0 {
			t.Fatalf("%s was not cleared", table)
		}
	}
}
