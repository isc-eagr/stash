-- Rebalance regular scene Energy / sex quality from 30 to 20 points and
-- retire all persisted Standout moment answers before introducing Usable factor.
-- Run against each Stash SQLite database while the matching application is stopped.

BEGIN IMMEDIATE;

UPDATE scenes
SET rating = MAX(
      0,
      COALESCE(rating, 0) - CAST(
        ROUND(
          COALESCE(
            (
              SELECT SUM(
                CASE
                  WHEN scores.key = 'chemistry'
                    THEN (scores.weighted_value - (scores.raw_value * 0.4)) * 10
                  WHEN scores.key = 'standout'
                    THEN scores.weighted_value * 10
                  ELSE 0
                END
              )
              FROM rating_criteria_scores scores
              WHERE scores.entity_type = 'scene'
                AND scores.entity_id = scenes.id
                AND scores.key IN ('chemistry', 'standout')
            ),
            0
          )
        ) AS INTEGER
      )
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1
  FROM rating_criteria_scores scores
  WHERE scores.entity_type = 'scene'
    AND scores.entity_id = scenes.id
    AND scores.key IN ('chemistry', 'standout')
);

UPDATE rating_criteria_scores
SET weighted_value = raw_value * 0.4,
    updated_at = CURRENT_TIMESTAMP
WHERE entity_type = 'scene'
  AND key = 'chemistry';

DELETE FROM rating_criteria_scores
WHERE entity_type = 'scene'
  AND key = 'standout';

COMMIT;
