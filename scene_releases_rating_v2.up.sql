-- One-time manual upgrade after scene_releases.up.sql and rating_scores.up.sql.
-- Back up the DB first. The guard fails on reapplication before copying rows.
PRAGMA foreign_keys=OFF;
BEGIN IMMEDIATE;
CREATE TABLE scene_release_rating_upgrade_guard (applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT INTO scene_release_rating_upgrade_guard DEFAULT VALUES;

DROP TRIGGER IF EXISTS rating_criteria_scores_entity_insert_custom;
DROP TRIGGER IF EXISTS rating_criteria_scores_entity_update_custom;
DROP TRIGGER IF EXISTS rating_bonus_scores_entity_insert_custom;
DROP TRIGGER IF EXISTS rating_bonus_scores_entity_update_custom;
DROP TRIGGER IF EXISTS rating_penalty_scores_entity_insert_custom;
DROP TRIGGER IF EXISTS rating_penalty_scores_entity_update_custom;
DROP TRIGGER IF EXISTS rating_scores_scene_delete_custom;
DROP TRIGGER IF EXISTS rating_scores_performer_delete_custom;

CREATE TABLE rating_criteria_scores_release_new (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 entity_type TEXT NOT NULL CHECK(entity_type IN ('scene','scene_release','performer')),
 entity_id INTEGER NOT NULL,
 key TEXT NOT NULL,
 raw_value REAL NOT NULL DEFAULT 0,
 weighted_value REAL NOT NULL DEFAULT 0,
 label TEXT,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(entity_type,entity_id,key)
);
INSERT INTO rating_criteria_scores_release_new SELECT * FROM rating_criteria_scores;
DROP TABLE rating_criteria_scores;
ALTER TABLE rating_criteria_scores_release_new RENAME TO rating_criteria_scores;
CREATE INDEX idx_rating_criteria_scores_entity ON rating_criteria_scores(entity_type,entity_id);

CREATE TABLE rating_bonus_scores_release_new (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 entity_type TEXT NOT NULL CHECK(entity_type IN ('scene','scene_release','performer')),
 entity_id INTEGER NOT NULL,
 key TEXT NOT NULL,
 raw_value REAL NOT NULL DEFAULT 0,
 weighted_value REAL NOT NULL DEFAULT 0,
 label TEXT,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(entity_type,entity_id,key)
);
INSERT INTO rating_bonus_scores_release_new SELECT * FROM rating_bonus_scores;
DROP TABLE rating_bonus_scores;
ALTER TABLE rating_bonus_scores_release_new RENAME TO rating_bonus_scores;
CREATE INDEX idx_rating_bonus_scores_entity ON rating_bonus_scores(entity_type,entity_id);

CREATE TABLE rating_penalty_scores_release_new (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 entity_type TEXT NOT NULL CHECK(entity_type IN ('scene','scene_release','performer')),
 entity_id INTEGER NOT NULL,
 key TEXT NOT NULL,
 raw_value REAL NOT NULL DEFAULT 0,
 weighted_value REAL NOT NULL DEFAULT 0,
 label TEXT,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(entity_type,entity_id,key)
);
INSERT INTO rating_penalty_scores_release_new SELECT * FROM rating_penalty_scores;
DROP TABLE rating_penalty_scores;
ALTER TABLE rating_penalty_scores_release_new RENAME TO rating_penalty_scores;
CREATE INDEX idx_rating_penalty_scores_entity ON rating_penalty_scores(entity_type,entity_id);

CREATE TRIGGER rating_criteria_scores_entity_insert_custom
BEFORE INSERT ON rating_criteria_scores
WHEN (NEW.entity_type='scene' AND NOT EXISTS(SELECT 1 FROM scenes WHERE id=NEW.entity_id))
  OR (NEW.entity_type='scene_release' AND NOT EXISTS(SELECT 1 FROM scene_releases WHERE id=NEW.entity_id))
  OR (NEW.entity_type='performer' AND NOT EXISTS(SELECT 1 FROM performers WHERE id=NEW.entity_id))
  OR NEW.entity_type NOT IN ('scene','scene_release','performer')
BEGIN SELECT RAISE(ABORT,'rating criterion entity does not exist'); END;
CREATE TRIGGER rating_criteria_scores_entity_update_custom
BEFORE UPDATE OF entity_type,entity_id ON rating_criteria_scores
WHEN (NEW.entity_type='scene' AND NOT EXISTS(SELECT 1 FROM scenes WHERE id=NEW.entity_id))
  OR (NEW.entity_type='scene_release' AND NOT EXISTS(SELECT 1 FROM scene_releases WHERE id=NEW.entity_id))
  OR (NEW.entity_type='performer' AND NOT EXISTS(SELECT 1 FROM performers WHERE id=NEW.entity_id))
  OR NEW.entity_type NOT IN ('scene','scene_release','performer')
BEGIN SELECT RAISE(ABORT,'rating criterion entity does not exist'); END;
CREATE TRIGGER rating_bonus_scores_entity_insert_custom
BEFORE INSERT ON rating_bonus_scores
WHEN (NEW.entity_type='scene' AND NOT EXISTS(SELECT 1 FROM scenes WHERE id=NEW.entity_id))
  OR (NEW.entity_type='scene_release' AND NOT EXISTS(SELECT 1 FROM scene_releases WHERE id=NEW.entity_id))
  OR (NEW.entity_type='performer' AND NOT EXISTS(SELECT 1 FROM performers WHERE id=NEW.entity_id))
  OR NEW.entity_type NOT IN ('scene','scene_release','performer')
BEGIN SELECT RAISE(ABORT,'rating bonus entity does not exist'); END;
CREATE TRIGGER rating_bonus_scores_entity_update_custom
BEFORE UPDATE OF entity_type,entity_id ON rating_bonus_scores
WHEN (NEW.entity_type='scene' AND NOT EXISTS(SELECT 1 FROM scenes WHERE id=NEW.entity_id))
  OR (NEW.entity_type='scene_release' AND NOT EXISTS(SELECT 1 FROM scene_releases WHERE id=NEW.entity_id))
  OR (NEW.entity_type='performer' AND NOT EXISTS(SELECT 1 FROM performers WHERE id=NEW.entity_id))
  OR NEW.entity_type NOT IN ('scene','scene_release','performer')
BEGIN SELECT RAISE(ABORT,'rating bonus entity does not exist'); END;
CREATE TRIGGER rating_penalty_scores_entity_insert_custom
BEFORE INSERT ON rating_penalty_scores
WHEN (NEW.entity_type='scene' AND NOT EXISTS(SELECT 1 FROM scenes WHERE id=NEW.entity_id))
  OR (NEW.entity_type='scene_release' AND NOT EXISTS(SELECT 1 FROM scene_releases WHERE id=NEW.entity_id))
  OR (NEW.entity_type='performer' AND NOT EXISTS(SELECT 1 FROM performers WHERE id=NEW.entity_id))
  OR NEW.entity_type NOT IN ('scene','scene_release','performer')
BEGIN SELECT RAISE(ABORT,'rating penalty entity does not exist'); END;
CREATE TRIGGER rating_penalty_scores_entity_update_custom
BEFORE UPDATE OF entity_type,entity_id ON rating_penalty_scores
WHEN (NEW.entity_type='scene' AND NOT EXISTS(SELECT 1 FROM scenes WHERE id=NEW.entity_id))
  OR (NEW.entity_type='scene_release' AND NOT EXISTS(SELECT 1 FROM scene_releases WHERE id=NEW.entity_id))
  OR (NEW.entity_type='performer' AND NOT EXISTS(SELECT 1 FROM performers WHERE id=NEW.entity_id))
  OR NEW.entity_type NOT IN ('scene','scene_release','performer')
BEGIN SELECT RAISE(ABORT,'rating penalty entity does not exist'); END;

CREATE TRIGGER rating_scores_release_delete_custom AFTER DELETE ON scene_releases
BEGIN
 DELETE FROM rating_criteria_scores WHERE entity_type='scene_release' AND entity_id=OLD.id;
 DELETE FROM rating_bonus_scores WHERE entity_type='scene_release' AND entity_id=OLD.id;
 DELETE FROM rating_penalty_scores WHERE entity_type='scene_release' AND entity_id=OLD.id;
END;
CREATE TRIGGER rating_scores_scene_delete_custom AFTER DELETE ON scenes
BEGIN
 DELETE FROM rating_criteria_scores WHERE entity_type='scene' AND entity_id=OLD.id;
 DELETE FROM rating_bonus_scores WHERE entity_type='scene' AND entity_id=OLD.id;
 DELETE FROM rating_penalty_scores WHERE entity_type='scene' AND entity_id=OLD.id;
END;
CREATE TRIGGER rating_scores_performer_delete_custom AFTER DELETE ON performers
BEGIN
 DELETE FROM rating_criteria_scores WHERE entity_type='performer' AND entity_id=OLD.id;
 DELETE FROM rating_bonus_scores WHERE entity_type='performer' AND entity_id=OLD.id;
 DELETE FROM rating_penalty_scores WHERE entity_type='performer' AND entity_id=OLD.id;
END;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_key_check;
