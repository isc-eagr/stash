-- Create table for scene negative markers (time ranges to skip during playback)
CREATE TABLE IF NOT EXISTS scene_negative_markers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scene_id INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  start_seconds FLOAT NOT NULL,
  end_seconds FLOAT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(scene_id) REFERENCES scenes(id) ON DELETE CASCADE,
  CHECK(end_seconds > start_seconds)
);

CREATE INDEX IF NOT EXISTS idx_scene_negative_markers_scene_id
  ON scene_negative_markers(scene_id);
