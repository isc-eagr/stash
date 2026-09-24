package sqlite

import (
	"context"
	"database/sql"
	"os"
	"strings"
	"testing"

	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
	"github.com/stashapp/stash/pkg/models"
)

func TestSceneReleaseFullUpdatePreservesCoverCustom(t *testing.T) {
	release := models.NewSceneRelease()
	release.ID = 7
	release.SceneID = 3
	release.Title = "changed"
	var row sceneReleaseRow
	row.fromSceneRelease(release)
	query, _, err := dialect.Update(sceneReleaseTable).Set(row).Where(sceneReleaseTableMgr.idColumn.Eq(release.ID)).ToSQL()
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(query, "cover_blob") {
		t.Fatalf("full release update can clear cover: %s", query)
	}
}

func TestSceneReleaseCoverReferenceSurvivesSceneDeletionCustom(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Exec(`PRAGMA foreign_keys = ON;
CREATE TABLE blobs(checksum TEXT PRIMARY KEY, blob BLOB);
CREATE TABLE scenes(id INTEGER PRIMARY KEY, cover_blob TEXT REFERENCES blobs(checksum));
CREATE TABLE studios(id INTEGER PRIMARY KEY);
CREATE TABLE files(id INTEGER PRIMARY KEY);
CREATE TABLE galleries(id INTEGER PRIMARY KEY);`); err != nil {
		t.Fatal(err)
	}
	migration, err := os.ReadFile("../../scene_releases.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(string(migration)); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`
INSERT INTO blobs VALUES ('cover', X'010203');
INSERT INTO scenes(id, cover_blob) VALUES (1, 'cover'), (2, NULL);
INSERT INTO scene_releases(id, scene_id, cover_blob, created_at, updated_at)
VALUES (7, 2, 'cover', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
UPDATE scenes SET cover_blob = NULL WHERE id = 1;
`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`DELETE FROM blobs WHERE checksum = 'cover'`); err == nil {
		t.Fatal("blob deletion succeeded while release still referenced it")
	}
	var content []byte
	if err := db.QueryRow(`SELECT blob FROM blobs WHERE checksum = 'cover'`).Scan(&content); err != nil {
		t.Fatal(err)
	}
	if len(content) != 3 {
		t.Fatalf("cover length = %d, want 3", len(content))
	}
}

func TestLegacySceneReleaseCoverGuardCustom(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Exec(`CREATE TABLE blobs(checksum TEXT PRIMARY KEY);
CREATE TABLE scene_releases(id INTEGER PRIMARY KEY, cover_blob TEXT);
INSERT INTO blobs VALUES ('cover');
INSERT INTO scene_releases VALUES (7, 'cover');`); err != nil {
		t.Fatal(err)
	}
	guard, err := os.ReadFile("../../scene_releases_cover_guard.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(string(guard)); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`DELETE FROM blobs WHERE checksum = 'cover'`); err == nil {
		t.Fatal("legacy migration did not protect the release cover")
	}
	if _, err := db.Exec(`UPDATE scene_releases SET cover_blob = NULL WHERE id = 7;
DELETE FROM blobs WHERE checksum = 'cover'`); err != nil {
		t.Fatal(err)
	}
}

func TestReleaseCoverReplacementKeepsSiblingBlobWithoutForeignKeyCustom(t *testing.T) {
	db, err := sqlx.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(`CREATE TABLE blobs(checksum TEXT PRIMARY KEY, blob BLOB);
CREATE TABLE scene_releases(id INTEGER PRIMARY KEY, cover_blob TEXT);
INSERT INTO blobs VALUES ('shared', x'010203');
INSERT INTO scene_releases VALUES (1, 'shared'), (2, 'shared');`); err != nil {
		t.Fatal(err)
	}
	tx, err := db.BeginTxx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	ctx := context.WithValue(context.Background(), txnKey, tx)
	store := NewSceneReleaseStore(nil, NewBlobStore(BlobStoreOptions{UseDatabase: true}))
	if err := store.UpdateCover(ctx, 1, []byte{4, 5, 6}); err != nil {
		t.Fatal(err)
	}
	var count int
	if err := tx.Get(&count, `SELECT COUNT(*) FROM blobs WHERE checksum = 'shared'`); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatal("shared cover was deleted during replacement")
	}
	if err := store.UpdateCover(ctx, 2, nil); err != nil {
		t.Fatal(err)
	}
	if err := tx.Get(&count, `SELECT COUNT(*) FROM blobs WHERE checksum = 'shared'`); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatal("unused cover was not cleaned up")
	}
}
