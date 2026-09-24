package sqlite

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
)

func TestReleasePlaybackActivityStaysOnReleaseCustom(t *testing.T) {
	db, err := sqlx.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(`CREATE TABLE scenes(id INTEGER PRIMARY KEY, resume_time REAL, play_duration REAL);
CREATE TABLE scene_releases(id INTEGER PRIMARY KEY, scene_id INTEGER);
CREATE TABLE scenes_galleries(scene_id INTEGER, gallery_id INTEGER);
CREATE TABLE scene_release_galleries(release_id INTEGER, gallery_id INTEGER);
INSERT INTO scenes VALUES (1,30,50);
INSERT INTO scene_releases VALUES (4,1);`); err != nil {
		t.Fatal(err)
	}
	upgrade, err := os.ReadFile("../../scene_releases_metadata_v2.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(string(upgrade)); err != nil {
		t.Fatal(err)
	}
	tx, err := db.BeginTxx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	ctx := context.WithValue(context.Background(), txnKey, tx)
	store := &SceneReleaseStore{}
	resume, elapsed := 12.5, 8.0
	if err := store.SaveActivityCustom(ctx, 4, &resume, &elapsed); err != nil {
		t.Fatal(err)
	}
	if err := store.SaveActivityCustom(ctx, 4, nil, &elapsed); err != nil {
		t.Fatal(err)
	}
	metadata, err := store.GetMetadataCustom(ctx, 4)
	if err != nil {
		t.Fatal(err)
	}
	if metadata.ResumeTime != 12.5 || metadata.PlayDuration != 16 {
		t.Fatalf("release activity = %+v", metadata)
	}
	if count, err := store.AddPlayCustom(ctx, 4); err != nil || count != 1 {
		t.Fatalf("release play count = %d, err = %v", count, err)
	}
	views, err := store.GetViewHistoryCustom(ctx, 4)
	if err != nil || len(views) != 1 {
		t.Fatalf("release play history = %v, err = %v", views, err)
	}
	if count, err := store.AddOAtTimestampCustom(ctx, 4, 7.25); err != nil || count != 1 {
		t.Fatalf("release O count = %d, err = %v", count, err)
	}
	orgasms, err := store.GetOHistoryCustom(ctx, 4)
	if err != nil || len(orgasms) != 1 {
		t.Fatalf("release O history = %v, err = %v", orgasms, err)
	}
	var timestamp float64
	if err := tx.Get(&timestamp, `SELECT video_timestamp FROM scene_release_o_dates WHERE release_id=4`); err != nil || timestamp != 7.25 {
		t.Fatalf("release O timestamp = %v, err = %v", timestamp, err)
	}
	var parent struct {
		ResumeTime float64 `db:"resume_time"`
		Duration   float64 `db:"play_duration"`
	}
	if err := tx.Get(&parent, `SELECT resume_time,play_duration FROM scenes WHERE id=1`); err != nil {
		t.Fatal(err)
	}
	if parent.ResumeTime != 30 || parent.Duration != 50 {
		t.Fatalf("parent activity changed: %+v", parent)
	}
	if err := store.EditHistoryCustom(ctx, 4, "play", "delete", &views[0]); err != nil {
		t.Fatalf("delete loaded play event: %v", err)
	}
	if err := store.SaveActivityCustom(ctx, 999, &resume, nil); err == nil {
		t.Fatal("missing release accepted playback activity")
	}
	manualDate := time.Date(2024, time.March, 4, 5, 6, 7, 0, time.UTC)
	for range 2 {
		if err := store.EditHistoryCustom(ctx, 4, "play", "add", &manualDate); err != nil {
			t.Fatal(err)
		}
	}
	if err := store.EditHistoryCustom(ctx, 4, "play", "delete", &manualDate); err != nil {
		t.Fatal(err)
	}
	var duplicates int
	if err := tx.Get(&duplicates, `SELECT COUNT(*) FROM scene_release_view_dates WHERE release_id=4 AND view_date=?`, manualDate); err != nil || duplicates != 1 {
		t.Fatalf("one matching duplicate should remain: count=%d err=%v", duplicates, err)
	}
	if err := store.EditHistoryCustom(ctx, 4, "o", "add", &manualDate); err != nil {
		t.Fatal(err)
	}
	if err := store.EditHistoryCustom(ctx, 4, "o", "delete", &manualDate); err != nil {
		t.Fatal(err)
	}
	if err := tx.Get(&timestamp, `SELECT video_timestamp FROM scene_release_o_dates WHERE release_id=4`); err != nil || timestamp != 7.25 {
		t.Fatalf("existing timestamp should survive manual O edit: %v, %v", timestamp, err)
	}
	if err := store.EditHistoryCustom(ctx, 4, "play", "clear", nil); err != nil {
		t.Fatal(err)
	}
	if err := tx.Get(&duplicates, `SELECT COUNT(*) FROM scene_release_view_dates WHERE release_id=4`); err != nil || duplicates != 0 {
		t.Fatalf("release history clear = %d, %v", duplicates, err)
	}
	if err := store.ResetActivityCustom(ctx, 4, true, true); err != nil {
		t.Fatal(err)
	}
	metadata, err = store.GetMetadataCustom(ctx, 4)
	if err != nil || metadata.ResumeTime != 0 || metadata.PlayDuration != 0 {
		t.Fatalf("release activity reset = %+v, %v", metadata, err)
	}
}
