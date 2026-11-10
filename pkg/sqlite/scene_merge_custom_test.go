package sqlite

import (
	"context"
	"database/sql"
	"testing"

	"github.com/jmoiron/sqlx"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/require"
)

func newSceneMergeDBCustom(t *testing.T, seed string) (context.Context, *sqlx.Tx) {
	t.Helper()
	db, err := sqlx.Open(sqlite3Driver, ":memory:?_foreign_keys=on")
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	_, err = db.Exec(`CREATE TABLE scenes(id INTEGER PRIMARY KEY, rating INTEGER);
CREATE TABLE scenes_files(scene_id INTEGER, file_id INTEGER);
CREATE TABLE scenes_o_dates(scene_id INTEGER, o_date DATETIME, video_timestamp REAL);
CREATE TABLE scene_releases(id INTEGER PRIMARY KEY, scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE);
CREATE TABLE scene_release_files(release_id INTEGER, file_id INTEGER);
CREATE TABLE scene_negative_markers(id INTEGER PRIMARY KEY, scene_id INTEGER REFERENCES scenes(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '', start_seconds FLOAT NOT NULL, end_seconds FLOAT NOT NULL);
CREATE TABLE scene_multi_segment_loop_presets(id INTEGER PRIMARY KEY, scene_id INTEGER REFERENCES scenes(id) ON DELETE CASCADE,
  name TEXT NOT NULL, segments TEXT NOT NULL, UNIQUE(scene_id, name));
CREATE TABLE scene_stashdb_matches(scene_id INTEGER PRIMARY KEY REFERENCES scenes(id) ON DELETE CASCADE, matches INTEGER NOT NULL);
CREATE TABLE rating_criteria_scores(entity_type TEXT, entity_id INTEGER, key TEXT);
CREATE TABLE rating_bonus_scores(entity_type TEXT, entity_id INTEGER, key TEXT);
CREATE TABLE rating_penalty_scores(entity_type TEXT, entity_id INTEGER, key TEXT);
INSERT INTO scenes(id, rating) VALUES (1, NULL), (2, 70), (3, 90);
` + seed)
	require.NoError(t, err)

	tx, err := db.BeginTxx(context.Background(), nil)
	require.NoError(t, err)
	t.Cleanup(func() { _ = tx.Rollback() })
	return context.WithValue(context.Background(), txnKey, tx), tx
}

func TestSceneMergeCustomDataMovesSceneOwnedRowsCustom(t *testing.T) {
	ctx, tx := newSceneMergeDBCustom(t, `
INSERT INTO scene_releases(id, scene_id) VALUES (10, 2), (11, 3);
INSERT INTO scene_negative_markers(scene_id, name, start_seconds, end_seconds) VALUES
  (1, 'Intro', 0, 30), (2, 'Intro', 0, 30), (2, 'Credits', 600, 650), (3, 'Intro', 0, 31);
INSERT INTO scene_multi_segment_loop_presets(scene_id, name, segments) VALUES
  (1, 'Best', '[1]'), (2, 'Best', '[1]'), (2, 'Other', '[2]'), (3, 'Best', '[3]'), (3, 'Best (2)', '[4]');
INSERT INTO scene_stashdb_matches(scene_id, matches) VALUES (2, 5), (3, 9);
INSERT INTO scenes_o_dates VALUES (2, '2026-01-01', 12.5), (3, '2026-01-02', NULL);
`)

	ratingSourceID, err := (&SceneStore{}).MergeCustomDataCustom(ctx, []int{2, 3}, 1, models.SceneMergeOptionsCustom{IncludeOHistory: true})
	require.NoError(t, err)
	require.Zero(t, ratingSourceID)
	_, err = tx.Exec(`DELETE FROM scenes WHERE id IN (2, 3)`)
	require.NoError(t, err)

	var releaseIDs []int
	require.NoError(t, tx.Select(&releaseIDs, `SELECT id FROM scene_releases WHERE scene_id = 1 ORDER BY id`))
	require.Equal(t, []int{10, 11}, releaseIDs, "releases must survive the source deletion")

	type negative struct {
		Name  string  `db:"name"`
		Start float64 `db:"start_seconds"`
		End   float64 `db:"end_seconds"`
	}
	var negatives []negative
	require.NoError(t, tx.Select(&negatives, `SELECT name, start_seconds, end_seconds FROM scene_negative_markers WHERE scene_id = 1 ORDER BY start_seconds, end_seconds`))
	require.Equal(t, []negative{{"Intro", 0, 30}, {"Intro", 0, 31}, {"Credits", 600, 650}}, negatives, "exact duplicates are dropped")

	type preset struct {
		Name     string `db:"name"`
		Segments string `db:"segments"`
	}
	var presets []preset
	require.NoError(t, tx.Select(&presets, `SELECT name, segments FROM scene_multi_segment_loop_presets WHERE scene_id = 1 ORDER BY name`))
	require.Equal(t, []preset{{"Best", "[1]"}, {"Best (2)", "[4]"}, {"Best (3)", "[3]"}, {"Other", "[2]"}}, presets)

	var matches int
	require.NoError(t, tx.Get(&matches, `SELECT matches FROM scene_stashdb_matches WHERE scene_id = 1`))
	require.Equal(t, 5, matches, "first source count fills an unscraped destination")

	var timestamps []sql.NullFloat64
	require.NoError(t, tx.Select(&timestamps, `SELECT video_timestamp FROM scenes_o_dates WHERE scene_id = 1 ORDER BY o_date`))
	require.Equal(t, []sql.NullFloat64{{Float64: 12.5, Valid: true}, {}}, timestamps, "O history keeps its video timestamp")

	var rating int
	require.NoError(t, tx.Get(&rating, `SELECT rating FROM scenes WHERE id = 1`))
	require.Equal(t, 70, rating, "unrated destination takes the first source's manual rating")
}

func TestSceneMergeCustomDataKeepsDestinationValuesCustom(t *testing.T) {
	ctx, tx := newSceneMergeDBCustom(t, `
UPDATE scenes SET rating = 40 WHERE id = 1;
INSERT INTO scene_stashdb_matches(scene_id, matches) VALUES (1, 0), (2, 5);
INSERT INTO scenes_o_dates VALUES (2, '2026-01-01', 12.5);
`)

	_, err := (&SceneStore{}).MergeCustomDataCustom(ctx, []int{2}, 1, models.SceneMergeOptionsCustom{})
	require.NoError(t, err)

	var matches, rating, oCount int
	require.NoError(t, tx.Get(&matches, `SELECT matches FROM scene_stashdb_matches WHERE scene_id = 1`))
	require.Zero(t, matches, "a scraped zero is kept")
	require.NoError(t, tx.Get(&rating, `SELECT rating FROM scenes WHERE id = 1`))
	require.Equal(t, 40, rating)
	require.NoError(t, tx.Get(&oCount, `SELECT COUNT(*) FROM scenes_o_dates WHERE scene_id = 1`))
	require.Zero(t, oCount, "O history is copied only when requested")
}

func TestSceneMergeCustomDataAdvisorScoresCustom(t *testing.T) {
	scoreCount := func(t *testing.T, tx *sqlx.Tx, sceneID int) int {
		var count int
		require.NoError(t, tx.Get(&count, `SELECT
			(SELECT COUNT(*) FROM rating_criteria_scores WHERE entity_type = 'scene' AND entity_id = ?) +
			(SELECT COUNT(*) FROM rating_bonus_scores WHERE entity_type = 'scene' AND entity_id = ?) +
			(SELECT COUNT(*) FROM rating_penalty_scores WHERE entity_type = 'scene' AND entity_id = ?)`, sceneID, sceneID, sceneID))
		return count
	}

	t.Run("adopts first source with answers", func(t *testing.T) {
		ctx, tx := newSceneMergeDBCustom(t, `
INSERT INTO rating_criteria_scores VALUES ('scene', 3, 'chemistry'), ('performer', 2, 'looks');
INSERT INTO rating_bonus_scores VALUES ('scene', 3, 'goat');
INSERT INTO rating_penalty_scores VALUES ('scene', 3, 'audio');
`)
		ratingSourceID, err := (&SceneStore{}).MergeCustomDataCustom(ctx, []int{2, 3}, 1, models.SceneMergeOptionsCustom{})
		require.NoError(t, err)
		require.Equal(t, 3, ratingSourceID)
		require.Equal(t, 3, scoreCount(t, tx, 1))
		require.Zero(t, scoreCount(t, tx, 3))

		var performerScores int
		require.NoError(t, tx.Get(&performerScores, `SELECT COUNT(*) FROM rating_criteria_scores WHERE entity_type = 'performer' AND entity_id = 2`))
		require.Equal(t, 1, performerScores, "a performer with the source's ID is untouched")
	})

	t.Run("destination answers win", func(t *testing.T) {
		ctx, tx := newSceneMergeDBCustom(t, `
INSERT INTO rating_criteria_scores VALUES ('scene', 1, 'chemistry'), ('scene', 2, 'chemistry'), ('scene', 2, 'energy');
`)
		ratingSourceID, err := (&SceneStore{}).MergeCustomDataCustom(ctx, []int{2}, 1, models.SceneMergeOptionsCustom{})
		require.NoError(t, err)
		require.Zero(t, ratingSourceID)
		require.Equal(t, 1, scoreCount(t, tx, 1))
		require.Equal(t, 2, scoreCount(t, tx, 2), "source answers are left for deletion")
	})
}

func TestSceneMergeCustomDataRejectsFamilyFileConflictCustom(t *testing.T) {
	ctx, tx := newSceneMergeDBCustom(t, `
INSERT INTO scene_releases(id, scene_id) VALUES (10, 1);
INSERT INTO scene_release_files VALUES (10, 50);
INSERT INTO scenes_files VALUES (2, 50);
`)
	_, err := (&SceneStore{}).MergeCustomDataCustom(ctx, []int{2}, 1, models.SceneMergeOptionsCustom{})
	require.ErrorContains(t, err, "file 50 already belongs to the target scene family")

	var owner int
	require.NoError(t, tx.Get(&owner, `SELECT scene_id FROM scene_releases WHERE id = 10`))
	require.Equal(t, 1, owner)
}

func TestSceneMergeCustomDataHonorsChoicesCustom(t *testing.T) {
	ctx, tx := newSceneMergeDBCustom(t, `
INSERT INTO scene_negative_markers(id, scene_id, name, start_seconds, end_seconds) VALUES
  (1, 1, 'Intro', 0, 30), (2, 1, 'Credits', 600, 650), (3, 2, 'Intro', 0, 30), (4, 2, 'Recap', 40, 50);
INSERT INTO scene_multi_segment_loop_presets(id, scene_id, name, segments) VALUES
  (1, 1, 'Best', '[1]'), (2, 1, 'Old', '[9]'), (3, 2, 'Best', '[1]');
INSERT INTO scene_stashdb_matches(scene_id, matches) VALUES (1, 4);
INSERT INTO rating_criteria_scores VALUES ('scene', 1, 'chemistry'), ('scene', 2, 'payoff');
`)
	two := 2
	ratingSourceID, err := (&SceneStore{}).MergeCustomDataCustom(ctx, []int{2}, 1, models.SceneMergeOptionsCustom{
		NegativeMarkerIDs:     []int{1, 3, 4},
		LoopPresetIDs:         []int{1, 3},
		RatingSceneID:         &two,
		StashDBMatchesSceneID: &two,
	})
	require.NoError(t, err)
	require.Equal(t, 2, ratingSourceID)

	var negativeIDs []int
	require.NoError(t, tx.Select(&negativeIDs, `SELECT id FROM scene_negative_markers WHERE scene_id = 1 ORDER BY id`))
	require.Equal(t, []int{1, 3, 4}, negativeIDs, "unkept destination rows go, kept duplicates stay")

	var presetNames []string
	require.NoError(t, tx.Select(&presetNames, `SELECT name FROM scene_multi_segment_loop_presets WHERE scene_id = 1 ORDER BY id`))
	require.Equal(t, []string{"Best", "Best (2)"}, presetNames, "a kept identical preset is renamed")

	var matches int
	require.NoError(t, tx.Get(&matches, `SELECT COUNT(*) FROM scene_stashdb_matches WHERE scene_id = 1`))
	require.Zero(t, matches, "choosing an unscraped source clears the count")

	var keys []string
	require.NoError(t, tx.Select(&keys, `SELECT key FROM rating_criteria_scores WHERE entity_type = 'scene' AND entity_id = 1`))
	require.Equal(t, []string{"payoff"}, keys)
	var rating int
	require.NoError(t, tx.Get(&rating, `SELECT rating FROM scenes WHERE id = 1`))
	require.Equal(t, 70, rating)
}

func TestSceneMergeCustomDataChoicesCustom(t *testing.T) {
	t.Run("destination rating keeps its answers", func(t *testing.T) {
		ctx, tx := newSceneMergeDBCustom(t, `INSERT INTO rating_criteria_scores VALUES ('scene', 2, 'payoff');`)
		one := 1
		ratingSourceID, err := (&SceneStore{}).MergeCustomDataCustom(ctx, []int{2}, 1, models.SceneMergeOptionsCustom{RatingSceneID: &one})
		require.NoError(t, err)
		require.Zero(t, ratingSourceID)
		var rating sql.NullInt64
		require.NoError(t, tx.Get(&rating, `SELECT rating FROM scenes WHERE id = 1`))
		require.False(t, rating.Valid, "an unrated destination stays unrated when chosen")
	})

	t.Run("source without answers gives its manual rating", func(t *testing.T) {
		ctx, tx := newSceneMergeDBCustom(t, `INSERT INTO rating_criteria_scores VALUES ('scene', 1, 'payoff');`)
		three := 3
		ratingSourceID, err := (&SceneStore{}).MergeCustomDataCustom(ctx, []int{2, 3}, 1, models.SceneMergeOptionsCustom{RatingSceneID: &three})
		require.NoError(t, err)
		require.Zero(t, ratingSourceID)
		var rating, scores int
		require.NoError(t, tx.Get(&rating, `SELECT rating FROM scenes WHERE id = 1`))
		require.Equal(t, 90, rating)
		require.NoError(t, tx.Get(&scores, `SELECT COUNT(*) FROM rating_criteria_scores WHERE entity_id = 1`))
		require.Zero(t, scores, "destination answers no longer match its rating")
	})

	t.Run("empty selection removes every row", func(t *testing.T) {
		ctx, tx := newSceneMergeDBCustom(t, `INSERT INTO scene_negative_markers(scene_id, name, start_seconds, end_seconds) VALUES (1, '', 0, 1), (2, '', 2, 3);`)
		_, err := (&SceneStore{}).MergeCustomDataCustom(ctx, []int{2}, 1, models.SceneMergeOptionsCustom{NegativeMarkerIDs: []int{}})
		require.NoError(t, err)
		var count int
		require.NoError(t, tx.Get(&count, `SELECT COUNT(*) FROM scene_negative_markers WHERE scene_id = 1`))
		require.Zero(t, count)
	})

	t.Run("rejects choices outside the merge", func(t *testing.T) {
		ctx, _ := newSceneMergeDBCustom(t, `INSERT INTO scene_negative_markers(id, scene_id, name, start_seconds, end_seconds) VALUES (7, 3, '', 0, 1);`)
		_, err := (&SceneStore{}).MergeCustomDataCustom(ctx, []int{2}, 1, models.SceneMergeOptionsCustom{NegativeMarkerIDs: []int{7}})
		require.ErrorContains(t, err, "negative marker 7 is not part of the merge")

		three := 3
		_, err = (&SceneStore{}).MergeCustomDataCustom(ctx, []int{2}, 1, models.SceneMergeOptionsCustom{RatingSceneID: &three})
		require.ErrorContains(t, err, "scene 3 is not part of the merge")
	})
}
