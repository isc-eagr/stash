package sqlite

import (
	"context"
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
	if _, err := db.Exec(sceneReleaseMetadataSchemaCustom); err != nil {
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

func TestReleaseOVideoTimestampsAllowNullCustom(t *testing.T) {
	db, err := sqlx.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(`CREATE TABLE scene_release_o_dates(release_id INTEGER, o_date DATETIME, video_timestamp REAL);
INSERT INTO scene_release_o_dates VALUES (4,'2026-01-01',NULL), (4,'2026-01-02',7.25), (4,NULL,NULL);`); err != nil {
		t.Fatal(err)
	}
	tx, err := db.BeginTxx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	ctx := context.WithValue(context.Background(), txnKey, tx)
	timestamps, err := (&SceneReleaseStore{}).GetOVideoTimestampsCustom(ctx, 4)
	if err != nil {
		t.Fatal(err)
	}
	if len(timestamps) != 2 || timestamps[0] == nil || *timestamps[0] != 7.25 || timestamps[1] != nil {
		t.Fatalf("release O timestamps = %v", timestamps)
	}
}

func TestReleaseHistoryDecrementRemovesLatestDateCustom(t *testing.T) {
	db, err := sqlx.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(`CREATE TABLE scene_releases(id INTEGER PRIMARY KEY);
INSERT INTO scene_releases VALUES (4);
CREATE TABLE scene_release_view_dates(release_id INTEGER, view_date DATETIME);
CREATE TABLE scene_release_o_dates(release_id INTEGER, o_date DATETIME, video_timestamp REAL);`); err != nil {
		t.Fatal(err)
	}
	tx, err := db.BeginTxx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	ctx := context.WithValue(context.Background(), txnKey, tx)
	store := &SceneReleaseStore{}
	newest := time.Date(2026, 10, 28, 12, 0, 0, 0, time.UTC)
	oldest := newest.AddDate(-1, 0, 0)
	for _, kind := range []string{"play", "o"} {
		for _, date := range []time.Time{newest, oldest} {
			if err := store.EditHistoryCustom(ctx, 4, kind, "add", &date); err != nil {
				t.Fatal(err)
			}
		}
	}
	// Converted scenes may also carry retroactive O's, inserted after dated O's.
	if _, err := tx.Exec(`INSERT INTO scene_release_o_dates(release_id) VALUES (4)`); err != nil {
		t.Fatal(err)
	}
	for _, kind := range []string{"play", "o"} {
		if err := store.EditHistoryCustom(ctx, 4, kind, "delete", nil); err != nil {
			t.Fatal(err)
		}
	}
	views, err := store.GetViewHistoryCustom(ctx, 4)
	if err != nil || len(views) != 1 || !views[0].Equal(oldest) {
		t.Fatalf("play history after decrement = %v, %v", views, err)
	}
	orgasms, err := store.GetOHistoryCustom(ctx, 4)
	if err != nil || len(orgasms) != 1 || !orgasms[0].Equal(oldest) {
		t.Fatalf("O history after decrement = %v, %v", orgasms, err)
	}
	var count int
	if err := tx.Get(&count, `SELECT COUNT(*) FROM scene_release_o_dates WHERE o_date IS NULL`); err != nil || count != 1 {
		t.Fatalf("retroactive O's after decrement = %d, %v", count, err)
	}
}
