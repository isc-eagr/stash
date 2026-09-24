-- Run manually after backing up the database and after scene_releases.up.sql.
-- CREATE IF NOT EXISTS keeps this safe to retry; do not infer data for old releases.
CREATE VIEW IF NOT EXISTS scene_all_galleries_custom AS
SELECT scene_id, gallery_id FROM scenes_galleries
UNION
SELECT sr.scene_id, srg.gallery_id FROM scene_release_galleries srg
JOIN scene_releases sr ON sr.id = srg.release_id;

CREATE TABLE IF NOT EXISTS scene_release_metadata (
  release_id INTEGER PRIMARY KEY REFERENCES scene_releases(id) ON DELETE CASCADE,
  rating INTEGER,
  organized BOOLEAN NOT NULL DEFAULT 0,
  resume_time REAL NOT NULL DEFAULT 0,
  play_duration REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS scene_release_urls (
  release_id INTEGER NOT NULL REFERENCES scene_releases(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  url TEXT NOT NULL,
  PRIMARY KEY(release_id, position, url)
);
CREATE TABLE IF NOT EXISTS scene_release_performers (
  release_id INTEGER NOT NULL REFERENCES scene_releases(id) ON DELETE CASCADE,
  performer_id INTEGER NOT NULL REFERENCES performers(id) ON DELETE CASCADE,
  PRIMARY KEY(release_id, performer_id)
);
CREATE TABLE IF NOT EXISTS scene_release_tags (
  release_id INTEGER NOT NULL REFERENCES scene_releases(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY(release_id, tag_id)
);
CREATE TABLE IF NOT EXISTS scene_release_groups (
  release_id INTEGER NOT NULL REFERENCES scene_releases(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  scene_index TEXT,
  PRIMARY KEY(release_id, group_id)
);
CREATE TABLE IF NOT EXISTS scene_release_stash_ids (
  release_id INTEGER NOT NULL REFERENCES scene_releases(id) ON DELETE CASCADE,
  endpoint TEXT,
  stash_id TEXT,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY(release_id, endpoint, stash_id)
);
CREATE TABLE IF NOT EXISTS scene_release_custom_fields (
  release_id INTEGER NOT NULL REFERENCES scene_releases(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  value BLOB NOT NULL,
  PRIMARY KEY(release_id, field)
);

CREATE TABLE IF NOT EXISTS scene_release_view_dates (
  release_id INTEGER NOT NULL REFERENCES scene_releases(id) ON DELETE CASCADE,
  view_date DATETIME NOT NULL
);
CREATE TABLE IF NOT EXISTS scene_release_o_dates (
  release_id INTEGER NOT NULL REFERENCES scene_releases(id) ON DELETE CASCADE,
  o_date DATETIME NOT NULL,
  video_timestamp REAL
);

CREATE TABLE IF NOT EXISTS scene_release_conversion_requests (
  request_id TEXT PRIMARY KEY,
  direction TEXT NOT NULL CHECK(direction IN ('scene_to_release','release_to_scene')),
  source_id INTEGER NOT NULL,
  target_id INTEGER NOT NULL,
  result_id INTEGER NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scene_release_performers_performer ON scene_release_performers(performer_id);
CREATE INDEX IF NOT EXISTS idx_scene_release_tags_tag ON scene_release_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_scene_release_groups_group ON scene_release_groups(group_id);
CREATE INDEX IF NOT EXISTS idx_scene_release_view_dates_release ON scene_release_view_dates(release_id);
CREATE INDEX IF NOT EXISTS idx_scene_release_o_dates_release ON scene_release_o_dates(release_id);
