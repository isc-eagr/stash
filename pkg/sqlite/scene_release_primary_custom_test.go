package sqlite

import (
	"context"
	"reflect"
	"testing"

	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
	"github.com/stashapp/stash/pkg/models"
)

func TestSceneReleasePrimaryFileChangesCustom(t *testing.T) {
	db, err := sqlx.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(`CREATE TABLE scene_release_files(release_id INTEGER, file_id INTEGER, "primary" BOOLEAN, PRIMARY KEY(release_id,file_id));
CREATE TABLE scenes_files(scene_id INTEGER, file_id INTEGER, "primary" BOOLEAN, PRIMARY KEY(scene_id,file_id));
INSERT INTO scene_release_files VALUES (4, 7, 0), (4, 3, 1), (4, 5, 0);`); err != nil {
		t.Fatal(err)
	}
	tx, err := db.BeginTxx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	ctx := context.WithValue(context.Background(), txnKey, tx)
	store := &SceneReleaseStore{}
	assertFiles := func(want []models.FileID) {
		t.Helper()
		got, err := store.GetFileIDs(ctx, 4)
		if err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(got, want) {
			t.Fatalf("files = %v, want %v", got, want)
		}
	}
	assertFiles([]models.FileID{3, 5, 7})
	if err := store.RemoveFileID(ctx, 4, 3); err != nil {
		t.Fatal(err)
	}
	assertFiles([]models.FileID{5, 7})
	if err := store.AddFileID(ctx, 4, 9); err != nil {
		t.Fatal(err)
	}
	assertFiles([]models.FileID{5, 7, 9})
	if _, err := tx.Exec(`INSERT INTO scenes_files VALUES (2, 10, 0), (2, 8, 0)`); err != nil {
		t.Fatal(err)
	}
	if err := ensurePrimaryFileCustom(ctx, scenesFilesTableMgr, 2); err != nil {
		t.Fatal(err)
	}
	var primary int
	if err := tx.QueryRow(`SELECT file_id FROM scenes_files WHERE scene_id = 2 AND "primary" = 1`).Scan(&primary); err != nil {
		t.Fatal(err)
	}
	if primary != 8 {
		t.Fatalf("scene primary = %d, want 8", primary)
	}
	if _, err := tx.Exec(`INSERT INTO scenes_files VALUES (2, 5, 0);
INSERT INTO scene_release_files VALUES (6, 5, 1)`); err != nil {
		t.Fatal(err)
	}
	otherOwners, err := store.CountOtherFileOwnersCustom(ctx, 4, 5)
	if err != nil {
		t.Fatal(err)
	}
	if otherOwners != 2 {
		t.Fatalf("other owners = %d, want 2", otherOwners)
	}
}

func TestMoveFileToReleasePreservesFamilyOwnershipCustom(t *testing.T) {
	db, err := sqlx.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(`CREATE TABLE scene_releases(id INTEGER PRIMARY KEY, scene_id INTEGER);
CREATE TABLE scene_release_files(release_id INTEGER, file_id INTEGER, "primary" BOOLEAN, PRIMARY KEY(release_id,file_id));
CREATE TABLE scenes_files(scene_id INTEGER, file_id INTEGER, "primary" BOOLEAN, PRIMARY KEY(scene_id,file_id));
INSERT INTO scene_releases VALUES (4, 2), (5, 2), (6, 3);
INSERT INTO scenes_files VALUES (2, 7, 1), (2, 8, 0), (3, 9, 1);
INSERT INTO scene_release_files VALUES (5, 10, 1), (6, 11, 1);`); err != nil {
		t.Fatal(err)
	}
	tx, err := db.BeginTxx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	ctx := context.WithValue(context.Background(), txnKey, tx)
	store := &SceneReleaseStore{}
	if err := store.MoveFileToReleaseCustom(ctx, 4, 7); err != nil {
		t.Fatal(err)
	}
	if err := store.MoveFileToReleaseCustom(ctx, 4, 10); err != nil {
		t.Fatal(err)
	}
	for _, fileID := range []int{9, 11} {
		if err := store.MoveFileToReleaseCustom(ctx, 4, models.FileID(fileID)); err == nil {
			t.Fatalf("cross-family file %d was accepted", fileID)
		}
	}
	var count int
	if err := tx.Get(&count, `SELECT COUNT(*) FROM scene_release_files WHERE release_id = 4`); err != nil {
		t.Fatal(err)
	}
	if count != 2 {
		t.Fatalf("target release has %d files, want 2", count)
	}
	if err := tx.Get(&count, `SELECT COUNT(*) FROM scenes_files WHERE scene_id = 2 AND file_id = 7`); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatal("file was left on the main scene")
	}
	if err := tx.Get(&count, `SELECT COUNT(*) FROM scene_release_files WHERE release_id = 5 AND file_id = 10`); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatal("file was left on a sibling release")
	}
	var primary int
	if err := tx.Get(&primary, `SELECT file_id FROM scenes_files WHERE scene_id = 2 AND "primary" = 1`); err != nil {
		t.Fatal(err)
	}
	if primary != 8 {
		t.Fatalf("main primary = %d, want 8", primary)
	}
	if err := store.CheckConversionFileConflictsCustom(ctx, 2, 3); err != nil {
		t.Fatalf("unrelated scene families conflict: %v", err)
	}
	if _, err := tx.Exec(`INSERT INTO scenes_files VALUES (3, 8, 0)`); err != nil {
		t.Fatal(err)
	}
	if err := store.CheckConversionFileConflictsCustom(ctx, 2, 3); err == nil {
		t.Fatal("conversion accepted a file already owned by the target")
	}
}
