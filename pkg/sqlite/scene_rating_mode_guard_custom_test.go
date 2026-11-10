package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/jmoiron/sqlx"
	"github.com/stashapp/stash/internal/manager/config"
	"github.com/stretchr/testify/require"
)

func sceneAdvisorStateCustom(t *testing.T, db *sql.DB, sceneID int) (int, sql.NullInt64) {
	t.Helper()
	var scores int
	var rating sql.NullInt64
	require.NoError(t, db.QueryRow(`SELECT COUNT(*) FROM rating_criteria_scores WHERE entity_type = 'scene' AND entity_id = ?`, sceneID).Scan(&scores))
	require.NoError(t, db.QueryRow(`SELECT rating FROM scenes WHERE id = ?`, sceneID).Scan(&rating))
	return scores, rating
}

func TestResetSceneAdvisorOnModeChangeCustom(t *testing.T) {
	config.InitializeEmpty()
	db := openRatingScriptDatabaseCustom(t)
	_, err := db.Exec(`CREATE TABLE scene_markers (id INTEGER PRIMARY KEY, scene_id INTEGER, primary_tag_id INTEGER);
INSERT INTO scenes (id, rating) VALUES (1, 80), (2, 70);
INSERT INTO performers (id) VALUES (1), (2), (3), (4);
INSERT INTO performers_scenes VALUES (1, 1), (2, 1), (1, 2), (2, 2);
INSERT INTO rating_criteria_scores (entity_type, entity_id, key, raw_value, weighted_value)
VALUES ('scene', 1, 'chemistry', 4, 2), ('scene', 2, 'chemistry', 3, 1.5);`)
	require.NoError(t, err)

	tx, err := sqlx.NewDb(db, "sqlite3").BeginTxx(context.Background(), nil)
	require.NoError(t, err)
	ctx := context.WithValue(context.Background(), txnKey, tx)
	addPerformers := func(sceneID int, ids ...int) func() error {
		return func() error {
			for _, id := range ids {
				if _, err := tx.Exec(`INSERT INTO performers_scenes VALUES (?, ?)`, id, sceneID); err != nil {
					return err
				}
			}
			return nil
		}
	}

	// Standard to group clears the scores and the rating.
	require.NoError(t, resetSceneAdvisorOnModeChangeCustom(ctx, 1, addPerformers(1, 3, 4)))
	// Two to three vatos stays standard and keeps everything.
	require.NoError(t, resetSceneAdvisorOnModeChangeCustom(ctx, 2, addPerformers(2, 3)))
	// A failed write leaves the scene alone.
	writeErr := errors.New("write failed")
	require.ErrorIs(t, resetSceneAdvisorOnModeChangeCustom(ctx, 2, func() error { return writeErr }), writeErr)
	require.NoError(t, tx.Commit())

	scores, rating := sceneAdvisorStateCustom(t, db, 1)
	require.Zero(t, scores)
	require.False(t, rating.Valid)

	scores, rating = sceneAdvisorStateCustom(t, db, 2)
	require.Equal(t, 1, scores)
	require.Equal(t, int64(70), rating.Int64)
}
