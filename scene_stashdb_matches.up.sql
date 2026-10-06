-- CUSTOM: StashDB Matches per scene (summed PHASH submissions from stashdb.org).
-- Stash creates this automatically at startup; kept here as the schema record.
CREATE TABLE IF NOT EXISTS scene_stashdb_matches (
  scene_id INTEGER PRIMARY KEY,
  matches INTEGER NOT NULL CHECK(matches >= 0),
  FOREIGN KEY(scene_id) REFERENCES scenes(id) ON DELETE CASCADE
);

-- Latest refresh-task run (one row) and the counts it changed.
CREATE TABLE IF NOT EXISTS stashdb_matches_refresh_report (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  started_at DATETIME NOT NULL,
  finished_at DATETIME NOT NULL,
  checked INTEGER NOT NULL,
  changed INTEGER NOT NULL,
  unchanged INTEGER NOT NULL,
  not_found INTEGER NOT NULL,
  failed INTEGER NOT NULL,
  cancelled BOOLEAN NOT NULL
);
CREATE TABLE IF NOT EXISTS stashdb_matches_refresh_changes (
  scene_id INTEGER PRIMARY KEY,
  previous INTEGER,
  current INTEGER NOT NULL,
  FOREIGN KEY(scene_id) REFERENCES scenes(id) ON DELETE CASCADE
);

-- Account submission checks; empty until a refresh with this version runs.
CREATE TABLE IF NOT EXISTS stashdb_matches_refresh_submission_check (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  endpoint TEXT NOT NULL,
  FOREIGN KEY(id) REFERENCES stashdb_matches_refresh_report(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS stashdb_matches_refresh_unsubmitted (
  scene_id INTEGER PRIMARY KEY,
  stash_id TEXT NOT NULL,
  matches INTEGER NOT NULL CHECK(matches >= 0),
  FOREIGN KEY(scene_id) REFERENCES scenes(id) ON DELETE CASCADE
);
