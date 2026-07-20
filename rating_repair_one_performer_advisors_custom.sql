-- Reset one-performer scenes whose stored advisor state does not fit the solo rubric.
-- Also repairs a non-zero rating left behind without criteria by the old Reset Advisor behavior.
-- Back up the target database before running this script.

BEGIN IMMEDIATE;

CREATE TEMP TABLE one_performer_advisor_repair_targets_custom AS
WITH one_performer_scenes AS (
  SELECT scenes.id, scenes.rating
  FROM scenes
  JOIN performers_scenes ON performers_scenes.scene_id = scenes.id
  GROUP BY scenes.id
  HAVING COUNT(DISTINCT performers_scenes.performer_id) = 1
)
SELECT scene.id
FROM one_performer_scenes scene
WHERE (
    scene.rating IS NOT NULL
    AND scene.rating != 0
    AND NOT EXISTS (
      SELECT 1
      FROM rating_criteria_scores criteria
      WHERE criteria.entity_type = 'scene'
        AND criteria.entity_id = scene.id
    )
  )
  OR EXISTS (
    SELECT 1
    FROM rating_criteria_scores criteria
    WHERE criteria.entity_type = 'scene'
      AND criteria.entity_id = scene.id
      AND criteria.key NOT IN (
        'soloPerformerAppeal',
        'soloPerformance',
        'soloUsability'
      )
  )
  OR EXISTS (
    SELECT 1
    FROM rating_bonus_scores bonus
    WHERE bonus.entity_type = 'scene'
      AND bonus.entity_id = scene.id
      AND bonus.key NOT IN (
        'orgasmBonus',
        'feetBonus',
        'goatElement',
        'theme'
      )
  )
  OR EXISTS (
    SELECT 1
    FROM rating_penalty_scores penalty
    WHERE penalty.entity_type = 'scene'
      AND penalty.entity_id = scene.id
      AND penalty.key NOT IN ('noOrgasm', 'production')
  );

DELETE FROM rating_criteria_scores
WHERE entity_type = 'scene'
  AND entity_id IN (SELECT id FROM one_performer_advisor_repair_targets_custom);

DELETE FROM rating_bonus_scores
WHERE entity_type = 'scene'
  AND entity_id IN (SELECT id FROM one_performer_advisor_repair_targets_custom);

DELETE FROM rating_penalty_scores
WHERE entity_type = 'scene'
  AND entity_id IN (SELECT id FROM one_performer_advisor_repair_targets_custom);

UPDATE scenes
SET rating = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (SELECT id FROM one_performer_advisor_repair_targets_custom);

DROP TABLE one_performer_advisor_repair_targets_custom;

COMMIT;
