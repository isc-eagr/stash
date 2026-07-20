-- Clear scene and performer ratings when no Rating Advisor criterion is set.
-- An intentional zero-valued criterion counts as set. Bonuses and penalties do not.
-- Back up the target database before running this script.

BEGIN IMMEDIATE;

UPDATE scenes
SET rating = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE rating IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM rating_criteria_scores criteria
    WHERE criteria.entity_type = 'scene'
      AND criteria.entity_id = scenes.id
  );

UPDATE performers
SET rating = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE rating IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM rating_criteria_scores criteria
    WHERE criteria.entity_type = 'performer'
      AND criteria.entity_id = performers.id
  );

COMMIT;
