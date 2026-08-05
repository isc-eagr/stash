package sqlite

import (
	"context"
	"testing"

	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"
)

func TestSceneNegativeMarkerFindNamesCustom(t *testing.T) {
	db, err := sqlx.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	_, err = db.Exec(`
CREATE TABLE scene_negative_markers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scene_id INTEGER NOT NULL,
  name TEXT NOT NULL
);
INSERT INTO scene_negative_markers (scene_id, name) VALUES
  (1, 'Skip Intro'),
  (2, ' skip intro '),
  (2, 'Credits'),
  (3, ''),
  (3, '   '),
  (4, 'Interview');
`)
	require.NoError(t, err)

	tx, err := db.BeginTxx(context.Background(), nil)
	require.NoError(t, err)
	ctx := context.WithValue(context.Background(), txnKey, tx)
	t.Cleanup(func() { _ = tx.Rollback() })

	names, err := NewSceneNegativeMarkerStore().FindNames(ctx)
	require.NoError(t, err)
	require.Equal(t, []string{"Credits", "Interview", "Skip Intro"}, names)
}
