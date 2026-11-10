package sqlite

import (
	"context"
	"fmt"
	"testing"

	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Vato counts are distinct per scene, span chunks, and leave out scenes
// without vatos.
func TestScenePerformerCountsCustom(t *testing.T) {
	db, err := sqlx.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	defer db.Close()
	db.SetMaxOpenConns(1)
	_, err = db.Exec(`CREATE TABLE performers_scenes(performer_id INTEGER, scene_id INTEGER);
INSERT INTO performers_scenes VALUES (1, 1), (2, 1), (2, 1), (1, 2), (2, 2), (3, 2), (4, 3);`)
	require.NoError(t, err)
	// Push one scene past the first chunk.
	_, err = db.Exec(fmt.Sprintf(`INSERT INTO performers_scenes VALUES (1, %[1]d), (2, %[1]d), (3, %[1]d), (4, %[1]d)`, 9000))
	require.NoError(t, err)

	tx, err := db.BeginTxx(context.Background(), nil)
	require.NoError(t, err)
	defer tx.Rollback()
	ctx := context.WithValue(context.Background(), txnKey, tx)

	ids := []int{1, 2, 3, 7}
	for id := 100; len(ids) < scenePerformerCountsChunkCustom+1; id++ {
		ids = append(ids, id)
	}
	ids = append(ids, 9000)

	counts, err := ScenePerformerCountsCustom(ctx, ids)
	require.NoError(t, err)
	assert.Equal(t, map[int]int{1: 2, 2: 3, 3: 1, 9000: 4}, counts)
}
