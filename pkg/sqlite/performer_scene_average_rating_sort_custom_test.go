package sqlite

import (
	"database/sql"
	"testing"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPerformerSceneAverageRatingExprCustomMatchesRatingAdvisorEligibility(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	_, err = db.Exec(`
CREATE TABLE performers (id INTEGER PRIMARY KEY);
CREATE TABLE scenes (id INTEGER PRIMARY KEY, rating INTEGER);
CREATE TABLE performers_scenes (performer_id INTEGER, scene_id INTEGER);
CREATE TABLE rating_criteria_scores (entity_type TEXT, entity_id INTEGER, key TEXT);
INSERT INTO performers(id) VALUES (1), (2), (3), (4), (5), (6), (7), (8);
INSERT INTO scenes(id, rating) VALUES
  (10, 90), (11, 50), (12, 100), (13, 5),
  (20, 70), (21, 95);
INSERT INTO performers_scenes(performer_id, scene_id) VALUES
  (1, 10),
  (1, 11), (3, 11),
  (1, 12), (3, 12), (4, 12), (5, 12),
  (1, 13),
  (2, 20),
  (2, 21), (6, 21), (7, 21), (8, 21);
INSERT INTO rating_criteria_scores(entity_type, entity_id, key) VALUES
  ('scene', 10, 'soloPerformance'),
  ('scene', 11, 'chemistry'),
  ('scene', 12, 'groupEnergy'),
  ('scene', 20, 'soloUsability'),
  ('scene', 21, 'chemistry');
`)
	require.NoError(t, err)

	rows, err := db.Query(
		"SELECT performers.id, " + performerSceneAverageRatingExprCustom() + " FROM performers WHERE performers.id IN (1, 2) ORDER BY performers.id",
	)
	require.NoError(t, err)
	defer rows.Close()

	averages := map[int]float64{}
	for rows.Next() {
		var id int
		var average float64
		require.NoError(t, rows.Scan(&id, &average))
		averages[id] = average
	}
	require.NoError(t, rows.Err())

	assert.InDelta(t, 80, averages[1], 0.0001)
	assert.InDelta(t, 70, averages[2], 0.0001)
}
