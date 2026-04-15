CREATE TABLE IF NOT EXISTS scene_multi_segment_loop_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scene_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  segments TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT 0,
  current_segment_index INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(scene_id, name),
  FOREIGN KEY(scene_id) REFERENCES scenes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scene_multi_segment_loop_presets_scene_id
  ON scene_multi_segment_loop_presets(scene_id);
