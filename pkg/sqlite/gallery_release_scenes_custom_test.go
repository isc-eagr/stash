package sqlite

import (
	"context"
	"reflect"
	"testing"

	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
)

func TestGallerySceneIDsIncludeReleaseAssociationsCustom(t *testing.T) {
	db, err := sqlx.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Exec(`CREATE TABLE scenes_galleries(scene_id INTEGER, gallery_id INTEGER);
CREATE TABLE scene_releases(id INTEGER, scene_id INTEGER);
CREATE TABLE scene_release_galleries(release_id INTEGER, gallery_id INTEGER);
CREATE VIEW scene_all_galleries_custom AS
SELECT scene_id,gallery_id FROM scenes_galleries
UNION SELECT sr.scene_id,srg.gallery_id FROM scene_release_galleries srg
JOIN scene_releases sr ON sr.id = srg.release_id;
INSERT INTO scenes_galleries VALUES (1, 9), (2, 9);
INSERT INTO scene_releases VALUES (30, 2), (31, 3);
INSERT INTO scene_release_galleries VALUES (30, 9), (31, 9);`); err != nil {
		t.Fatal(err)
	}
	tx, err := db.BeginTxx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	ctx := context.WithValue(context.Background(), txnKey, tx)
	ids, err := (&GalleryStore{}).GetSceneIDs(ctx, 9)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(ids, []int{1, 2, 3}) {
		t.Fatalf("gallery scenes = %v, want [1 2 3]", ids)
	}
	var viewIDs []int
	if err := tx.Select(&viewIDs, `SELECT scene_id FROM scene_all_galleries_custom WHERE gallery_id = 9 ORDER BY scene_id`); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(viewIDs, ids) {
		t.Fatalf("filter view scenes = %v, reverse gallery scenes = %v", viewIDs, ids)
	}
}
