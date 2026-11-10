package sqlite

import (
	"database/sql"
	"testing"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSortByGoatElementBonusCustom(t *testing.T) {
	clause := (&SceneStore{}).sortByGoatElementBonusCustom("DESC")

	assert.Contains(t, clause, "FROM rating_bonus_scores goat_bonus")
	assert.Contains(t, clause, "goat_bonus.key = 'goatElement'")
	assert.Contains(t, clause, "COALESCE")
	assert.Contains(t, clause, "DESC")
}

func TestSortByGoatElementBonusCustomOrdersEveryTierAboveMissing(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	_, err = db.Exec(`
		CREATE TABLE scenes (id INTEGER PRIMARY KEY);
		CREATE TABLE rating_bonus_scores (
			entity_type TEXT,
			entity_id INTEGER,
			key TEXT,
			raw_value REAL
		);
		INSERT INTO scenes (id) VALUES (1), (2), (3), (4), (5);
		INSERT INTO rating_bonus_scores (entity_type, entity_id, key, raw_value) VALUES
			('scene', 1, 'goatElement', 0.5),
			('scene', 2, 'goatElement', 1),
			('scene', 3, 'goatElement', 1.5),
			('scene', 4, 'goatElement', 2);
	`)
	require.NoError(t, err)

	query := "SELECT scenes.id FROM scenes" +
		(&SceneStore{}).sortByGoatElementBonusCustom("DESC") +
		", scenes.id ASC"
	rows, err := db.Query(query)
	require.NoError(t, err)
	defer rows.Close()

	var ids []int
	for rows.Next() {
		var id int
		require.NoError(t, rows.Scan(&id))
		ids = append(ids, id)
	}
	require.NoError(t, rows.Err())
	assert.Equal(t, []int{4, 3, 2, 1, 5}, ids)
}
