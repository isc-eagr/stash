BEGIN;

-- CUSTOM: Snapshot legacy GOAT rows before relabeling them. New tiered choices use
-- labels such as "GOAT +20", so rerunning this script cannot tag later choices.
DROP TABLE IF EXISTS temp.goat_review_scene_ids_custom;
CREATE TEMP TABLE goat_review_scene_ids_custom AS
SELECT DISTINCT entity_id AS scene_id
FROM rating_bonus_scores
WHERE entity_type = 'scene'
  AND key = 'goatElement'
  AND raw_value = 2
  AND weighted_value = 2
  AND label = 'GOAT element';

INSERT INTO tags (name, description, ignore_auto_tag, created_at, updated_at)
SELECT
  'reviewGOAT',
  'Review legacy GOAT bonuses migrated at +20 for possible +5/+10/+15 reassignment.',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM tags WHERE lower(name) = lower('reviewGOAT')
);

INSERT OR IGNORE INTO scenes_tags (scene_id, tag_id)
SELECT scene_id, (
  SELECT id
  FROM tags
  WHERE lower(name) = lower('reviewGOAT')
  ORDER BY id
  LIMIT 1
)
FROM goat_review_scene_ids_custom;

UPDATE rating_bonus_scores
SET label = 'GOAT +20',
    updated_at = CURRENT_TIMESTAMP
WHERE entity_type = 'scene'
  AND key = 'goatElement'
  AND entity_id IN (SELECT scene_id FROM goat_review_scene_ids_custom);

DROP TABLE goat_review_scene_ids_custom;

COMMIT;
