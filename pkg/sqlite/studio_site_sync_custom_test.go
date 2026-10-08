package sqlite

import (
	"context"
	"testing"

	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/require"
)

func newStudioSiteSyncDBCustom(t *testing.T) (context.Context, *sqlx.Tx) {
	t.Helper()
	db, err := sqlx.Open(sqlite3Driver, ":memory:?_foreign_keys=on")
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	_, err = db.Exec(`
CREATE TABLE scenes(id INTEGER PRIMARY KEY, title TEXT, code TEXT, date DATE, details TEXT, studio_id INTEGER);
CREATE TABLE files(id INTEGER PRIMARY KEY, basename TEXT, size INTEGER, parent_folder_id INTEGER);
CREATE TABLE folders(id INTEGER PRIMARY KEY, path TEXT, basename TEXT, parent_folder_id INTEGER);
CREATE TABLE scenes_files(scene_id INTEGER, file_id INTEGER, "primary" BOOLEAN);
CREATE TABLE scenes_galleries(scene_id INTEGER, gallery_id INTEGER);
CREATE TABLE tags(id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE scenes_tags(scene_id INTEGER, tag_id INTEGER);
CREATE TABLE scene_urls(scene_id INTEGER, position INTEGER, url TEXT);
CREATE TABLE images(id INTEGER PRIMARY KEY, studio_id INTEGER, updated_at DATETIME);
CREATE TABLE images_files(image_id INTEGER, file_id INTEGER);

INSERT INTO scenes VALUES
  (1, NULL, NULL, NULL, NULL, 18),
  (2, 'Prieto', '910', '2025-02-03', 'Gym day', 18),
  (3, NULL, NULL, NULL, NULL, 18),
  (4, 'Other studio', NULL, NULL, NULL, 6);
INSERT INTO folders VALUES
  (10, 'D:\Content\NakedPapis', 'NakedPapis', NULL),
  (11, 'D:\Content\NakedPapis\Pics', 'Pics', 10),
  (12, 'D:\Content\NakedPapis\Pics\papi99', 'papi99', 11),
  (13, 'D:\Content\NakedPapis\Pics\papi990', 'papi990', 11),
  (14, 'D:\Content\NakedPapis\Pics\papi7', 'papi7', 11),
  (15, 'D:\Content\NakedPapis\Pics\papi7\papi7', 'papi7', 14);
INSERT INTO files VALUES
  (100, 'compa.mp4', 1000, 10),
  (101, 'prieto.mp4', 2000, 10),
  (102, 'prieto-alt.mp4', 2100, 10),
  (103, 'postponed.mp4', 3000, 10),
  (104, 'other.mp4', 4000, 10),
  (200, 'papi99b.jpg', 1, 12),
  (201, 'papi99a.jpg', 1, 12),
  (202, 'papi990a.jpg', 1, 13),
  (203, 'papi99c.jpg', 1, 12),
  (204, 'papi7a.jpg', 1, 15);
INSERT INTO scenes_files VALUES (1, 100, 1), (2, 101, 1), (2, 102, 0), (3, 103, 1), (4, 104, 1);
INSERT INTO scenes_galleries VALUES (2, 50);
INSERT INTO tags VALUES (1, 'Postpone');
INSERT INTO scenes_tags VALUES (3, 1);
INSERT INTO scene_urls VALUES
  (2, 1, 'https://nakedpapis.com/members/sexvideos/videofiles1/papi910/910-high.html'),
  (2, 0, 'https://nakedpapis.com/nude-latin-men/papi910/latino_men_910.html');
INSERT INTO images VALUES (1, NULL, NULL), (2, 6, NULL), (3, NULL, NULL), (4, NULL, NULL);
INSERT INTO images_files VALUES (1, 200), (2, 201), (3, 202), (1, 203), (4, 204);`)
	require.NoError(t, err)

	tx, err := db.BeginTxx(context.Background(), nil)
	require.NoError(t, err)
	t.Cleanup(func() { _ = tx.Rollback() })
	return context.WithValue(context.Background(), txnKey, tx), tx
}

func TestStudioSiteSyncStoreScenesCustom(t *testing.T) {
	ctx, _ := newStudioSiteSyncDBCustom(t)
	store := StudioSiteSyncStoreCustom{}

	scenes, err := store.Scenes(ctx, 18)
	require.NoError(t, err)
	require.Len(t, scenes, 3)

	require.Equal(t, "compa.mp4", scenes[0].Basename)
	require.Equal(t, "", scenes[0].Title, "NULL columns read as empty strings")
	require.False(t, scenes[0].HasGallery)

	prieto := scenes[1]
	require.Equal(t, "prieto.mp4", prieto.Basename, "only the primary file is used")
	require.Equal(t, int64(2000), prieto.Size)
	require.Equal(t, "910", prieto.Code)
	require.Equal(t, "2025-02-03", prieto.Date)
	require.True(t, prieto.HasGallery)
	require.Equal(t, []string{
		"https://nakedpapis.com/nude-latin-men/papi910/latino_men_910.html",
		"https://nakedpapis.com/members/sexvideos/videofiles1/papi910/910-high.html",
	}, prieto.URLs, "URLs keep their position order")

	require.True(t, scenes[2].Postponed, "the postpone tag matches regardless of case")
}

func TestStudioSiteSyncStoreFolderImagesCustom(t *testing.T) {
	ctx, tx := newStudioSiteSyncDBCustom(t)
	store := StudioSiteSyncStoreCustom{}

	root, found, err := store.FolderID(ctx, `d:\content\nakedpapis\PICS`)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, 11, root)

	_, found, err = store.FolderID(ctx, `D:\Content\Missing`)
	require.NoError(t, err)
	require.False(t, found)

	// papi990 must not leak into papi99, which a name prefix match would do.
	ids, err := store.ChildFolderImageIDs(ctx, root, "papi99")
	require.NoError(t, err)
	require.Equal(t, []int{2, 1}, ids, "ordered by file name, once per image even with two files")

	ids, err = store.ChildFolderImageIDs(ctx, root, "papi7")
	require.NoError(t, err)
	require.Equal(t, []int{4}, ids, "a zip extracted into a folder of its own name counts")

	ids, err = store.ChildFolderImageIDs(ctx, root, "papi5")
	require.NoError(t, err)
	require.Empty(t, ids, "an unknown folder has no images")

	require.NoError(t, store.SetImagesStudio(ctx, []int{1, 2}, 18))
	var studios []struct {
		ID       int  `db:"id"`
		StudioID *int `db:"studio_id"`
	}
	require.NoError(t, tx.Select(&studios, `SELECT id, studio_id FROM images ORDER BY id`))
	require.Equal(t, 18, *studios[0].StudioID)
	require.Equal(t, 6, *studios[1].StudioID, "an existing studio is kept")
	require.Nil(t, studios[2].StudioID, "images outside the list are untouched")
}
