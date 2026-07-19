CREATE TABLE IF NOT EXISTS rating_criteria_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('scene', 'performer')),
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
  entity_type TEXT NOT NULL CHECK(entity_type IN ('scene', 'performer')),
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
  entity_type TEXT NOT NULL CHECK(entity_type IN ('scene', 'performer')),
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

DELETE FROM rating_criteria_scores
WHERE (entity_type = 'scene' AND NOT EXISTS (SELECT 1 FROM scenes WHERE id = entity_id))
   OR (entity_type = 'performer' AND NOT EXISTS (SELECT 1 FROM performers WHERE id = entity_id))
   OR entity_type NOT IN ('scene', 'performer');
DELETE FROM rating_bonus_scores
WHERE (entity_type = 'scene' AND NOT EXISTS (SELECT 1 FROM scenes WHERE id = entity_id))
   OR (entity_type = 'performer' AND NOT EXISTS (SELECT 1 FROM performers WHERE id = entity_id))
   OR entity_type NOT IN ('scene', 'performer');
DELETE FROM rating_penalty_scores
WHERE (entity_type = 'scene' AND NOT EXISTS (SELECT 1 FROM scenes WHERE id = entity_id))
   OR (entity_type = 'performer' AND NOT EXISTS (SELECT 1 FROM performers WHERE id = entity_id))
   OR entity_type NOT IN ('scene', 'performer');

-- CUSTOM: Generic entity references cannot use one conventional foreign key,
-- so triggers enforce existence and cascade cleanup for both supported types.
CREATE TRIGGER IF NOT EXISTS rating_criteria_scores_entity_insert_custom
BEFORE INSERT ON rating_criteria_scores
WHEN (NEW.entity_type = 'scene' AND NOT EXISTS (SELECT 1 FROM scenes WHERE id = NEW.entity_id))
  OR (NEW.entity_type = 'performer' AND NOT EXISTS (SELECT 1 FROM performers WHERE id = NEW.entity_id))
  OR NEW.entity_type NOT IN ('scene', 'performer')
BEGIN
  SELECT RAISE(ABORT, 'rating criterion entity does not exist');
END;

CREATE TRIGGER IF NOT EXISTS rating_criteria_scores_entity_update_custom
BEFORE UPDATE OF entity_type, entity_id ON rating_criteria_scores
WHEN (NEW.entity_type = 'scene' AND NOT EXISTS (SELECT 1 FROM scenes WHERE id = NEW.entity_id))
  OR (NEW.entity_type = 'performer' AND NOT EXISTS (SELECT 1 FROM performers WHERE id = NEW.entity_id))
  OR NEW.entity_type NOT IN ('scene', 'performer')
BEGIN
  SELECT RAISE(ABORT, 'rating criterion entity does not exist');
END;

CREATE TRIGGER IF NOT EXISTS rating_bonus_scores_entity_insert_custom
BEFORE INSERT ON rating_bonus_scores
WHEN (NEW.entity_type = 'scene' AND NOT EXISTS (SELECT 1 FROM scenes WHERE id = NEW.entity_id))
  OR (NEW.entity_type = 'performer' AND NOT EXISTS (SELECT 1 FROM performers WHERE id = NEW.entity_id))
  OR NEW.entity_type NOT IN ('scene', 'performer')
BEGIN
  SELECT RAISE(ABORT, 'rating bonus entity does not exist');
END;

CREATE TRIGGER IF NOT EXISTS rating_bonus_scores_entity_update_custom
BEFORE UPDATE OF entity_type, entity_id ON rating_bonus_scores
WHEN (NEW.entity_type = 'scene' AND NOT EXISTS (SELECT 1 FROM scenes WHERE id = NEW.entity_id))
  OR (NEW.entity_type = 'performer' AND NOT EXISTS (SELECT 1 FROM performers WHERE id = NEW.entity_id))
  OR NEW.entity_type NOT IN ('scene', 'performer')
BEGIN
  SELECT RAISE(ABORT, 'rating bonus entity does not exist');
END;

CREATE TRIGGER IF NOT EXISTS rating_penalty_scores_entity_insert_custom
BEFORE INSERT ON rating_penalty_scores
WHEN (NEW.entity_type = 'scene' AND NOT EXISTS (SELECT 1 FROM scenes WHERE id = NEW.entity_id))
  OR (NEW.entity_type = 'performer' AND NOT EXISTS (SELECT 1 FROM performers WHERE id = NEW.entity_id))
  OR NEW.entity_type NOT IN ('scene', 'performer')
BEGIN
  SELECT RAISE(ABORT, 'rating penalty entity does not exist');
END;

CREATE TRIGGER IF NOT EXISTS rating_penalty_scores_entity_update_custom
BEFORE UPDATE OF entity_type, entity_id ON rating_penalty_scores
WHEN (NEW.entity_type = 'scene' AND NOT EXISTS (SELECT 1 FROM scenes WHERE id = NEW.entity_id))
  OR (NEW.entity_type = 'performer' AND NOT EXISTS (SELECT 1 FROM performers WHERE id = NEW.entity_id))
  OR NEW.entity_type NOT IN ('scene', 'performer')
BEGIN
  SELECT RAISE(ABORT, 'rating penalty entity does not exist');
END;

CREATE TRIGGER IF NOT EXISTS rating_scores_scene_delete_custom
AFTER DELETE ON scenes
BEGIN
  DELETE FROM rating_criteria_scores WHERE entity_type = 'scene' AND entity_id = OLD.id;
  DELETE FROM rating_bonus_scores WHERE entity_type = 'scene' AND entity_id = OLD.id;
  DELETE FROM rating_penalty_scores WHERE entity_type = 'scene' AND entity_id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS rating_scores_performer_delete_custom
AFTER DELETE ON performers
BEGIN
  DELETE FROM rating_criteria_scores WHERE entity_type = 'performer' AND entity_id = OLD.id;
  DELETE FROM rating_bonus_scores WHERE entity_type = 'performer' AND entity_id = OLD.id;
  DELETE FROM rating_penalty_scores WHERE entity_type = 'performer' AND entity_id = OLD.id;
END;
