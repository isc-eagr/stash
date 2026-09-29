package sqlite

import (
	"context"
	"testing"

	"github.com/jmoiron/sqlx"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestSceneMarkerDurationCustom(t *testing.T) {
	db, err := sqlx.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	defer db.Close()
	_, err = db.Exec(`
CREATE TABLE scenes(id INTEGER PRIMARY KEY, title TEXT);
CREATE TABLE tags(id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE scene_markers(id INTEGER PRIMARY KEY, scene_id INTEGER, title TEXT,
  seconds REAL, end_seconds REAL, primary_tag_id INTEGER);
CREATE TABLE scene_markers_tags(scene_marker_id INTEGER, tag_id INTEGER);
INSERT INTO scenes VALUES(1, 'Scene match'), (2, 'Other');
INSERT INTO tags VALUES(1, 'Tag match'), (2, 'Other');
INSERT INTO scene_markers VALUES
  (1, 1, 'Needle', 2.5, 10, 1), (2, 1, '', 0, 5, 2),
  (3, 2, '', 10, NULL, 2), (4, 2, '', 10, 5, 2),
  (5, 2, '', 10, 10, 2), (6, 2, '', -2, 0, 2);
INSERT INTO scene_markers_tags VALUES(1, 1), (1, 2), (2, 1);`)
	require.NoError(t, err)
	tx, err := db.BeginTxx(context.Background(), nil)
	require.NoError(t, err)
	defer tx.Rollback()
	ctx := context.WithValue(context.Background(), txnKey, tx)
	store := &SceneMarkerStore{}
	tag := "1"
	for _, tc := range []struct {
		name   string
		q      string
		filter *models.SceneMarkerFilterType
		want   float64
	}{
		{"all valid ranges", "", nil, 14.5},
		{"marker title", "Needle", nil, 7.5},
		{"scene title", "Scene match", nil, 12.5},
		{"primary tag name", "Tag match", nil, 7.5},
		{"no matches", "Absent", nil, 0},
		{"deduplicates tag joins", "", &models.SceneMarkerFilterType{TagID: &tag}, 12.5},
		{"search with filter", "Needle", &models.SceneMarkerFilterType{TagID: &tag}, 7.5},
	} {
		t.Run(tc.name, func(t *testing.T) {
			page, perPage, sort := 4, 1, "random_42"
			got, err := store.QueryDurationCustom(ctx, tc.filter, &models.FindFilterType{
				Q: &tc.q, Page: &page, PerPage: &perPage, Sort: &sort,
			})
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
		})
	}
}
