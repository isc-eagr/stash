CREATE TABLE IF NOT EXISTS rating_criteria_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  raw_value REAL NOT NULL DEFAULT 0,
  weighted_value REAL NOT NULL DEFAULT 0,
  label TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_type, entity_id, key)
);

CREATE INDEX IF NOT EXISTS idx_rating_criteria_scores_entity
  ON rating_criteria_scores(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS rating_bonus_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  raw_value REAL NOT NULL DEFAULT 0,
  weighted_value REAL NOT NULL DEFAULT 0,
  label TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_type, entity_id, key)
);

CREATE INDEX IF NOT EXISTS idx_rating_bonus_scores_entity
  ON rating_bonus_scores(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS rating_penalty_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  raw_value REAL NOT NULL DEFAULT 0,
  weighted_value REAL NOT NULL DEFAULT 0,
  label TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_type, entity_id, key)
);

CREATE INDEX IF NOT EXISTS idx_rating_penalty_scores_entity
  ON rating_penalty_scores(entity_type, entity_id);
