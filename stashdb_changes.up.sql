-- CUSTOM: StashDB Changes report (latest check per kind and the entries that differ).
-- Stash creates these automatically at startup; kept here as the schema record.
CREATE TABLE IF NOT EXISTS stashdb_changes_runs (
  kind TEXT PRIMARY KEY CHECK(kind IN ('scene', 'performer')),
  started_at DATETIME NOT NULL,
  finished_at DATETIME NOT NULL,
  endpoint TEXT NOT NULL,
  checked INTEGER NOT NULL,
  failed INTEGER NOT NULL,
  cancelled BOOLEAN NOT NULL
);
-- fields is a JSON array of field differences.
CREATE TABLE IF NOT EXISTS stashdb_changes_entries (
  kind TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  stash_id TEXT NOT NULL,
  status TEXT NOT NULL,
  merged_into_id TEXT,
  fields TEXT NOT NULL,
  PRIMARY KEY(kind, entity_id, stash_id),
  FOREIGN KEY(kind) REFERENCES stashdb_changes_runs(kind) ON DELETE CASCADE
);
