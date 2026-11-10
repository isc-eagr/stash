package sqlite

import (
	"context"
	"testing"

	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
)

func TestReleaseConversionRequestCustom(t *testing.T) {
	db, err := sqlx.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(`CREATE TABLE scene_release_conversion_requests(
request_id TEXT PRIMARY KEY, direction TEXT, source_id INTEGER, target_id INTEGER, result_id INTEGER);`); err != nil {
		t.Fatal(err)
	}
	tx, err := db.BeginTxx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	ctx := context.WithValue(context.Background(), txnKey, tx)
	store := &SceneReleaseStore{}
	if _, found, err := store.FindConversionRequestCustom(ctx, "request-1", "scene_to_release", 1, 2); err != nil || found {
		t.Fatalf("new request found = %v, err = %v", found, err)
	}
	if err := store.SaveConversionRequestCustom(ctx, "request-1", "scene_to_release", 1, 2, 9); err != nil {
		t.Fatal(err)
	}
	if result, found, err := store.FindConversionRequestCustom(ctx, "request-1", "scene_to_release", 1, 2); err != nil || !found || result != 9 {
		t.Fatalf("retry result = %d, found = %v, err = %v", result, found, err)
	}
	if _, _, err := store.FindConversionRequestCustom(ctx, "request-1", "scene_to_release", 1, 3); err == nil {
		t.Fatal("request ID was reused for a different target")
	}
	if err := store.SaveConversionRequestCustom(ctx, "request-1", "scene_to_release", 1, 2, 10); err == nil {
		t.Fatal("duplicate request ID replaced the stored result")
	}
	if _, _, err := store.FindConversionRequestCustom(ctx, " request-2", "release_to_scene", 4, 0); err == nil {
		t.Fatal("whitespace-padded request ID accepted")
	}
}
