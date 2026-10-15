-- CUSTOM: let release O history keep retroactive O's (no date) when a scene
-- converts to a release. Run after scene_releases_metadata_v2.up.sql.
-- rowid is copied explicitly to keep row identity.

PRAGMA foreign_keys=OFF;

BEGIN TRANSACTION;

CREATE TABLE scene_release_o_dates_new (
  release_id INTEGER NOT NULL REFERENCES scene_releases(id) ON DELETE CASCADE,
  o_date DATETIME,
  video_timestamp REAL
);

INSERT INTO scene_release_o_dates_new (rowid, release_id, o_date, video_timestamp)
  SELECT rowid, release_id, o_date, video_timestamp FROM scene_release_o_dates;

DROP INDEX IF EXISTS idx_scene_release_o_dates_release;
DROP TABLE scene_release_o_dates;
ALTER TABLE scene_release_o_dates_new RENAME TO scene_release_o_dates;
CREATE INDEX idx_scene_release_o_dates_release ON scene_release_o_dates(release_id);

COMMIT;

PRAGMA foreign_keys=ON;
