package sqlite

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/require"
)

func TestRetroactiveOCountsWithoutDateCustom(t *testing.T) {
	db, err := sqlx.Open(sqlite3Driver, ":memory:")
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	_, err = db.Exec(`CREATE TABLE scenes(id INTEGER PRIMARY KEY);
CREATE TABLE groups(id INTEGER PRIMARY KEY);
CREATE TABLE groups_scenes(group_id INTEGER, scene_id INTEGER);
CREATE TABLE scene_releases(id INTEGER PRIMARY KEY);
CREATE TABLE scenes_o_dates(scene_id integer not null, o_date datetime not null,
  foreign key(scene_id) references scenes(id) on delete CASCADE);
CREATE INDEX index_scenes_o_dates ON scenes_o_dates (scene_id);
ALTER TABLE scenes_o_dates ADD COLUMN video_timestamp REAL;
CREATE TABLE scene_release_o_dates(release_id INTEGER NOT NULL REFERENCES scene_releases(id) ON DELETE CASCADE,
  o_date DATETIME NOT NULL, video_timestamp REAL);
INSERT INTO scenes(id) VALUES (1), (2);
INSERT INTO groups(id) VALUES (7);
INSERT INTO groups_scenes VALUES (7, 1), (7, 2);
INSERT INTO scene_releases(id) VALUES (4);
INSERT INTO scenes_o_dates(rowid, scene_id, o_date, video_timestamp) VALUES (40, 1, '2026-01-01T10:00:00Z', 12.5);
INSERT INTO scene_release_o_dates(rowid, release_id, o_date) VALUES (9, 4, '2026-01-01T10:00:00Z');`)
	require.NoError(t, err)

	for _, name := range []string{"scenes_retroactive_o.up.sql", "scene_releases_retroactive_o.up.sql"} {
		migration, err := os.ReadFile(filepath.Join("..", "..", name))
		require.NoError(t, err)
		_, err = db.Exec(string(migration))
		require.NoError(t, err, name)
	}

	var rowid int
	require.NoError(t, db.Get(&rowid, `SELECT rowid FROM scenes_o_dates WHERE scene_id = 1`))
	require.Equal(t, 40, rowid, "O screenshots keep their rowid")
	require.NoError(t, db.Get(&rowid, `SELECT rowid FROM scene_release_o_dates WHERE release_id = 4`))
	require.Equal(t, 9, rowid)
	_, err = db.Exec(`INSERT INTO scene_release_o_dates(release_id) VALUES (4)`)
	require.NoError(t, err, "release O dates accept converted retroactive O's")

	tx, err := db.BeginTxx(context.Background(), nil)
	require.NoError(t, err)
	t.Cleanup(func() { _ = tx.Rollback() })
	ctx := context.WithValue(context.Background(), txnKey, tx)
	store := &SceneStore{oDateManager: oDateManager{scenesOTableMgr}}

	dates, err := store.AddRetroactiveOCustom(ctx, 1)
	require.NoError(t, err)
	require.Len(t, dates, 1, "returned history only has dated O's")
	_, err = store.AddRetroactiveOCustom(ctx, 2)
	require.NoError(t, err)

	var stored []struct {
		ODate          *string  `db:"o_date"`
		VideoTimestamp *float64 `db:"video_timestamp"`
	}
	require.NoError(t, tx.Select(&stored, `SELECT o_date, video_timestamp FROM scenes_o_dates WHERE scene_id = 2`))
	require.Len(t, stored, 1)
	require.Nil(t, stored[0].ODate)
	require.Nil(t, stored[0].VideoTimestamp)

	count, err := store.GetOCount(ctx, 1)
	require.NoError(t, err)
	require.Equal(t, 2, count)
	counts, err := store.GetManyOCount(ctx, []int{1, 2})
	require.NoError(t, err)
	require.Equal(t, []int{2, 1}, counts)

	manyDates, err := store.GetManyODates(ctx, []int{1, 2})
	require.NoError(t, err)
	require.Len(t, manyDates[0], 1)
	require.Empty(t, manyDates[1])

	lastDates, err := scenesOTableMgr.getManyLastDate(ctx, []int{1, 2})
	require.NoError(t, err)
	require.NotNil(t, lastDates[0])
	require.Nil(t, lastDates[1], "a scene with only retroactive O's has no last O date")

	timestamps, err := store.GetOVideoTimestamps(ctx, 1)
	require.NoError(t, err)
	require.Len(t, timestamps, 1, "timestamps stay parallel with o_history")
	require.Equal(t, 12.5, *timestamps[0])

	var groupOCount int
	require.NoError(t, tx.Get(&groupOCount, `SELECT (`+selectGroupOCountSQL+`) FROM groups WHERE id = 7`))
	require.Equal(t, 3, groupOCount)

	_, err = store.AddRetroactiveOCustom(ctx, 1)
	require.NoError(t, err)
	dates, err = store.DeleteRetroactiveOCustom(ctx, 1)
	require.NoError(t, err)
	require.Len(t, dates, 1, "dated O's are never removed")
	count, err = store.GetOCount(ctx, 1)
	require.NoError(t, err)
	require.Equal(t, 2, count, "only one retroactive O is removed")

	_, err = store.DeleteRetroactiveOCustom(ctx, 1)
	require.NoError(t, err)
	_, err = store.DeleteRetroactiveOCustom(ctx, 1)
	require.NoError(t, err, "deleting with none left is a no-op")
	count, err = store.GetOCount(ctx, 1)
	require.NoError(t, err)
	require.Equal(t, 1, count)
}
