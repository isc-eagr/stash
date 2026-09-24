-- One-time manual upgrade. Back up the DB first and run only after
-- scene_releases.up.sql. The guard table makes reapplication fail before data
-- is copied. Check PRAGMA foreign_key_check after the upgrade.
PRAGMA foreign_keys=OFF;
BEGIN IMMEDIATE;
CREATE TABLE scene_release_activity_upgrade_guard (applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT INTO scene_release_activity_upgrade_guard DEFAULT VALUES;

CREATE TABLE scene_markers_release_new (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  title VARCHAR(255) NOT NULL,
  seconds FLOAT NOT NULL,
  primary_tag_id INTEGER NOT NULL REFERENCES tags(id),
  scene_id INTEGER REFERENCES scenes(id),
  release_id INTEGER REFERENCES scene_releases(id) ON DELETE CASCADE,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  end_seconds FLOAT,
  CHECK ((scene_id IS NOT NULL) != (release_id IS NOT NULL))
);
INSERT INTO scene_markers_release_new
  (id,title,seconds,primary_tag_id,scene_id,release_id,created_at,updated_at,end_seconds)
SELECT id,title,seconds,primary_tag_id,scene_id,NULL,created_at,updated_at,end_seconds
FROM scene_markers;
DROP TABLE scene_markers;
ALTER TABLE scene_markers_release_new RENAME TO scene_markers;
CREATE INDEX index_scene_markers_on_scene_id ON scene_markers(scene_id);
CREATE INDEX index_scene_markers_on_primary_tag_id ON scene_markers(primary_tag_id);
CREATE INDEX idx_scene_markers_release_id ON scene_markers(release_id);

CREATE TABLE scene_negative_markers_release_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scene_id INTEGER REFERENCES scenes(id) ON DELETE CASCADE,
  release_id INTEGER REFERENCES scene_releases(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  start_seconds FLOAT NOT NULL,
  end_seconds FLOAT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(end_seconds > start_seconds),
  CHECK ((scene_id IS NOT NULL) != (release_id IS NOT NULL))
);
INSERT INTO scene_negative_markers_release_new
  (id,scene_id,release_id,name,start_seconds,end_seconds,created_at,updated_at)
SELECT id,scene_id,NULL,name,start_seconds,end_seconds,created_at,updated_at
FROM scene_negative_markers;
DROP TABLE scene_negative_markers;
ALTER TABLE scene_negative_markers_release_new RENAME TO scene_negative_markers;
CREATE INDEX idx_scene_negative_markers_scene_id ON scene_negative_markers(scene_id);
CREATE INDEX idx_scene_negative_markers_release_id ON scene_negative_markers(release_id);

CREATE TABLE scene_multi_segment_loop_presets_release_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scene_id INTEGER REFERENCES scenes(id) ON DELETE CASCADE,
  release_id INTEGER REFERENCES scene_releases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  segments TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT 0,
  current_segment_index INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((scene_id IS NOT NULL) != (release_id IS NOT NULL))
);
INSERT INTO scene_multi_segment_loop_presets_release_new
  (id,scene_id,release_id,name,segments,enabled,current_segment_index,created_at,updated_at)
SELECT id,scene_id,NULL,name,segments,enabled,current_segment_index,created_at,updated_at
FROM scene_multi_segment_loop_presets;
DROP TABLE scene_multi_segment_loop_presets;
ALTER TABLE scene_multi_segment_loop_presets_release_new RENAME TO scene_multi_segment_loop_presets;
CREATE INDEX idx_scene_multi_segment_loop_presets_scene_id ON scene_multi_segment_loop_presets(scene_id);
CREATE INDEX idx_scene_multi_segment_loop_presets_release_id ON scene_multi_segment_loop_presets(release_id);
CREATE UNIQUE INDEX idx_scene_loop_presets_scene_name ON scene_multi_segment_loop_presets(scene_id,name) WHERE scene_id IS NOT NULL;
CREATE UNIQUE INDEX idx_scene_loop_presets_release_name ON scene_multi_segment_loop_presets(release_id,name) WHERE release_id IS NOT NULL;

COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_key_check;
