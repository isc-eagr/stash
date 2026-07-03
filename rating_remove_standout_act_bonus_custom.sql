BEGIN;

CREATE TEMP TABLE retired_standout_act_bonus_custom AS
SELECT entity_type, entity_id, weighted_value
FROM rating_bonus_scores
WHERE key = 'standoutAct';

UPDATE scenes
SET rating = MAX(
    0,
    COALESCE(rating, 0) - COALESCE(
      (
        SELECT CAST(ROUND(SUM(weighted_value) * 10) AS INTEGER)
        FROM retired_standout_act_bonus_custom retired
        WHERE retired.entity_type = 'scene'
          AND retired.entity_id = scenes.id
      ),
      0
    )
  ),
  updated_at = CURRENT_TIMESTAMP
WHERE id IN (
  SELECT entity_id
  FROM retired_standout_act_bonus_custom
  WHERE entity_type = 'scene'
);

UPDATE performers
SET rating = MAX(
    0,
    COALESCE(rating, 0) - COALESCE(
      (
        SELECT CAST(ROUND(SUM(weighted_value) * 10) AS INTEGER)
        FROM retired_standout_act_bonus_custom retired
        WHERE retired.entity_type = 'performer'
          AND retired.entity_id = performers.id
      ),
      0
    )
  ),
  updated_at = CURRENT_TIMESTAMP
WHERE id IN (
  SELECT entity_id
  FROM retired_standout_act_bonus_custom
  WHERE entity_type = 'performer'
);

DELETE FROM rating_bonus_scores
WHERE key = 'standoutAct';

DROP TABLE retired_standout_act_bonus_custom;

COMMIT;
