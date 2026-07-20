package sqlite

import (
	"database/sql"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClearUnadvisedEntityRatingsCustom(t *testing.T) {
	db := openRatingScriptDatabaseCustom(t)
	_, err := db.Exec(`
		INSERT INTO scenes (id, rating) VALUES (1, 80), (2, 70), (3, NULL);
		INSERT INTO performers (id, rating) VALUES (11, 60), (12, 50), (13, 40);
		INSERT INTO rating_criteria_scores
			(entity_type, entity_id, key, raw_value, weighted_value)
			VALUES
			('scene', 2, 'payoff', 0, 0),
			('performer', 12, 'face', 5, 3);
		INSERT INTO rating_bonus_scores
			(entity_type, entity_id, key, raw_value, weighted_value)
			VALUES ('performer', 13, 'theme', 1, 1);
	`)
	require.NoError(t, err)

	executeRatingScriptCustom(t, db, "rating_clear_unadvised_entity_ratings_custom.sql")

	assertRating := func(table string, id int, expected sql.NullInt64) {
		t.Helper()
		var actual sql.NullInt64
		require.NoError(t, db.QueryRow("SELECT rating FROM "+table+" WHERE id = ?", id).Scan(&actual))
		assert.Equal(t, expected, actual)
	}

	assertRating("scenes", 1, sql.NullInt64{})
	assertRating("scenes", 2, sql.NullInt64{Int64: 70, Valid: true})
	assertRating("scenes", 3, sql.NullInt64{})
	assertRating("performers", 11, sql.NullInt64{})
	assertRating("performers", 12, sql.NullInt64{Int64: 50, Valid: true})
	assertRating("performers", 13, sql.NullInt64{})
}
