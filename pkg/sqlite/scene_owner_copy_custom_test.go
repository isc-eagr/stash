package sqlite

import (
	"context"
	"testing"

	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/require"

	"github.com/stashapp/stash/pkg/models"
)

func newSceneOwnerCopyTestDBCustom(t *testing.T) context.Context {
	t.Helper()
	db, err := sqlx.Open(sqlite3Driver, ":memory:")
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { require.NoError(t, db.Close()) })
	_, err = db.Exec(`
CREATE TABLE scene_markers(id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, seconds REAL NOT NULL, end_seconds REAL,
 primary_tag_id INTEGER NOT NULL, scene_id INTEGER, release_id INTEGER, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
 CHECK ((scene_id IS NOT NULL) != (release_id IS NOT NULL)));
CREATE TABLE scene_markers_tags(scene_marker_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, UNIQUE(scene_marker_id, tag_id));
CREATE TABLE scene_marker_performers(id INTEGER PRIMARY KEY AUTOINCREMENT, scene_marker_id INTEGER NOT NULL, performer_id INTEGER NOT NULL, role TEXT NOT NULL);
CREATE TABLE scene_negative_markers(id INTEGER PRIMARY KEY AUTOINCREMENT, scene_id INTEGER, release_id INTEGER, name TEXT NOT NULL,
 start_seconds REAL NOT NULL, end_seconds REAL NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
 CHECK ((scene_id IS NOT NULL) != (release_id IS NOT NULL)));
CREATE TABLE scene_multi_segment_loop_presets(id INTEGER PRIMARY KEY AUTOINCREMENT, scene_id INTEGER, release_id INTEGER, name TEXT NOT NULL,
 segments TEXT NOT NULL, enabled BOOLEAN NOT NULL, current_segment_index INTEGER NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
 CHECK ((scene_id IS NOT NULL) != (release_id IS NOT NULL)));
CREATE TABLE task_progress_trackers (id INTEGER PRIMARY KEY, tag_id INTEGER NOT NULL, goal_per_day INTEGER, status TEXT NOT NULL,
 is_working_on BOOLEAN NOT NULL DEFAULT 0, item_types TEXT NOT NULL, mode TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE task_progress_tracker_events (id INTEGER PRIMARY KEY AUTOINCREMENT, tracker_id INTEGER NOT NULL, event_type TEXT NOT NULL,
 item_type TEXT NOT NULL DEFAULT '', item_id INTEGER NOT NULL DEFAULT 0, item_label TEXT NOT NULL DEFAULT '', occurred_on TEXT NOT NULL,
 occurred_at DATETIME NOT NULL, baseline_count INTEGER NOT NULL DEFAULT 0, tag_id INTEGER NOT NULL);
CREATE TABLE task_progress_tracker_members (tracker_id INTEGER NOT NULL, item_type TEXT NOT NULL, item_id INTEGER NOT NULL, state TEXT NOT NULL,
 PRIMARY KEY (tracker_id, item_type, item_id));
INSERT INTO task_progress_trackers(id,tag_id,status,item_types,mode) VALUES (1,50,'ACTIVE','scene_marker','BACKLOG');

-- Scene 3 owns two markers; release 9 already has a copy of one of them.
INSERT INTO scene_markers(id,title,seconds,end_seconds,primary_tag_id,scene_id,release_id,created_at,updated_at) VALUES
 (1,'Kiss',10,20,5,3,NULL,'2020-01-01','2020-01-01'),
 (2,'Ride',30,NULL,6,3,NULL,'2020-01-01','2020-01-01'),
 (3,'Ride',30,NULL,6,NULL,9,'2020-01-01','2020-01-01'),
 (4,'Other',40,NULL,7,NULL,8,'2020-01-01','2020-01-01');
INSERT INTO scene_markers_tags VALUES (1,50), (1,51);
INSERT INTO scene_marker_performers(scene_marker_id,performer_id,role) VALUES (1,100,'top'), (1,101,'bottom');
INSERT INTO scene_negative_markers(scene_id,release_id,name,start_seconds,end_seconds,created_at,updated_at) VALUES
 (3,NULL,'Intro',0,5,'2020-01-01','2020-01-01'),
 (3,NULL,'Credits',100,110,'2020-01-01','2020-01-01'),
 (NULL,9,'Opening',0,5,'2020-01-01','2020-01-01');
INSERT INTO scene_multi_segment_loop_presets(scene_id,release_id,name,segments,enabled,current_segment_index,created_at,updated_at) VALUES
 (3,NULL,'Best','[{"start":1,"end":2}]',1,0,'2020-01-01','2020-01-01'),
 (3,NULL,'Same','[{"start":3,"end":4}]',0,0,'2020-01-01','2020-01-01'),
 (3,NULL,'Fresh','[{"start":5,"end":6}]',1,0,'2020-01-01','2020-01-01'),
 (NULL,9,'Best','[{"start":9,"end":10}]',1,0,'2020-01-01','2020-01-01'),
 (NULL,9,'Same','[{"start":3,"end":4}]',0,0,'2020-01-01','2020-01-01');`)
	require.NoError(t, err)
	tx, err := db.BeginTxx(context.Background(), nil)
	require.NoError(t, err)
	t.Cleanup(func() { _ = tx.Rollback() })
	return context.WithValue(context.Background(), txnKey, tx)
}

func countCustom(t *testing.T, ctx context.Context, query string, args ...interface{}) int {
	t.Helper()
	var n int
	require.NoError(t, dbWrapper.Get(ctx, &n, query, args...))
	return n
}

func TestCopyOwnerItemsSceneToReleaseCustom(t *testing.T) {
	ctx := newSceneOwnerCopyTestDBCustom(t)
	store := &SceneReleaseStore{}
	all := models.SceneOwnerCopyKindsCustom{Markers: true, NegativeMarkers: true, LoopPresets: true}
	scene := models.SceneOwnerCustom{SceneID: 3}
	release := models.SceneOwnerCustom{ReleaseID: 9}

	got, err := store.CopyOwnerItemsCustom(ctx, scene, release, all)
	require.NoError(t, err)
	// Ride, the 0-5 skip, and the identical "Same" preset already exist.
	require.Equal(t, models.SceneOwnerCopyResultCustom{Markers: 1, NegativeMarkers: 1, LoopPresets: 2}, got)

	require.Equal(t, 1, countCustom(t, ctx, `SELECT COUNT(*) FROM scene_markers WHERE release_id = 9 AND title = 'Kiss' AND seconds = 10 AND end_seconds = 20 AND primary_tag_id = 5`))
	require.Equal(t, 2, countCustom(t, ctx, `SELECT COUNT(*) FROM scene_markers_tags t JOIN scene_markers m ON m.id = t.scene_marker_id WHERE m.release_id = 9`))
	require.Equal(t, 1, countCustom(t, ctx, `SELECT COUNT(*) FROM scene_marker_performers p JOIN scene_markers m ON m.id = p.scene_marker_id WHERE m.release_id = 9 AND p.performer_id = 101 AND p.role = 'bottom'`))
	require.Equal(t, 1, countCustom(t, ctx, `SELECT COUNT(*) FROM scene_negative_markers WHERE release_id = 9 AND name = 'Credits' AND start_seconds = 100`))
	require.Equal(t, 1, countCustom(t, ctx, `SELECT COUNT(*) FROM scene_multi_segment_loop_presets WHERE release_id = 9 AND name = 'Best (2)' AND segments = '[{"start":1,"end":2}]'`))
	require.Equal(t, 1, countCustom(t, ctx, `SELECT COUNT(*) FROM scene_multi_segment_loop_presets WHERE release_id = 9 AND name = 'Fresh' AND enabled = 1`))
	require.Equal(t, 1, countCustom(t, ctx, `SELECT COUNT(*) FROM scene_multi_segment_loop_presets WHERE release_id = 9 AND name = 'Same'`))
	// The copied marker's tracked tag is incoming work, as on create.
	require.Equal(t, 1, countCustom(t, ctx, `SELECT COUNT(*) FROM task_progress_tracker_events WHERE event_type = 'INCOMING' AND item_type = 'scene_marker' AND tag_id = 50`))

	// The source is untouched.
	require.Equal(t, 2, countCustom(t, ctx, `SELECT COUNT(*) FROM scene_markers WHERE scene_id = 3`))
	require.Equal(t, 2, countCustom(t, ctx, `SELECT COUNT(*) FROM scene_markers_tags WHERE scene_marker_id = 1`))
	require.Equal(t, 2, countCustom(t, ctx, `SELECT COUNT(*) FROM scene_negative_markers WHERE scene_id = 3`))
	require.Equal(t, 3, countCustom(t, ctx, `SELECT COUNT(*) FROM scene_multi_segment_loop_presets WHERE scene_id = 3`))
	require.Equal(t, 1, countCustom(t, ctx, `SELECT COUNT(*) FROM scene_markers WHERE release_id = 8`))

	// Copying again finds everything already there, renamed presets included.
	got, err = store.CopyOwnerItemsCustom(ctx, scene, release, all)
	require.NoError(t, err)
	require.Equal(t, models.SceneOwnerCopyResultCustom{}, got)
}

func TestCopyOwnerItemsReleaseToSceneAndSiblingCustom(t *testing.T) {
	ctx := newSceneOwnerCopyTestDBCustom(t)
	store := &SceneReleaseStore{}

	got, err := store.CopyOwnerItemsCustom(ctx, models.SceneOwnerCustom{ReleaseID: 9}, models.SceneOwnerCustom{SceneID: 3},
		models.SceneOwnerCopyKindsCustom{Markers: true, NegativeMarkers: true})
	require.NoError(t, err)
	// Ride is on the scene and the 0-5 skip matches by range, not name.
	require.Equal(t, models.SceneOwnerCopyResultCustom{}, got)

	got, err = store.CopyOwnerItemsCustom(ctx, models.SceneOwnerCustom{ReleaseID: 9}, models.SceneOwnerCustom{ReleaseID: 8},
		models.SceneOwnerCopyKindsCustom{Markers: true, NegativeMarkers: true, LoopPresets: true})
	require.NoError(t, err)
	require.Equal(t, models.SceneOwnerCopyResultCustom{Markers: 1, NegativeMarkers: 1, LoopPresets: 2}, got)
	require.Equal(t, 1, countCustom(t, ctx, `SELECT COUNT(*) FROM scene_markers WHERE release_id = 8 AND title = 'Ride' AND end_seconds IS NULL AND scene_id IS NULL`))
	require.Equal(t, 1, countCustom(t, ctx, `SELECT COUNT(*) FROM scene_negative_markers WHERE release_id = 8 AND name = 'Opening'`))
	require.Equal(t, 1, countCustom(t, ctx, `SELECT COUNT(*) FROM scene_markers WHERE release_id = 9`))

	_, err = store.CopyOwnerItemsCustom(ctx, models.SceneOwnerCustom{ReleaseID: 9}, models.SceneOwnerCustom{ReleaseID: 9},
		models.SceneOwnerCopyKindsCustom{Markers: true})
	require.Error(t, err)
	_, err = store.CopyOwnerItemsCustom(ctx, models.SceneOwnerCustom{SceneID: 3, ReleaseID: 9}, models.SceneOwnerCustom{ReleaseID: 8},
		models.SceneOwnerCopyKindsCustom{Markers: true})
	require.Error(t, err)
}
