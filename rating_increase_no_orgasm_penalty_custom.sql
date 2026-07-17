-- Increase active scene No orgasm penalties from -10 to -20 rating points.
-- Inactive zero-valued rows remain inactive.
-- Run against each Stash SQLite database while the matching application is stopped.

BEGIN IMMEDIATE;

UPDATE scenes
SET rating = MAX(
      0,
      COALESCE(rating, 0) + CAST(
        ROUND(
          (
            SELECT (-2 - penalties.weighted_value) * 10
            FROM rating_penalty_scores penalties
            WHERE penalties.entity_type = 'scene'
              AND penalties.entity_id = scenes.id
              AND penalties.key = 'noOrgasm'
              AND (penalties.raw_value != 0 OR penalties.weighted_value != 0)
          )
        ) AS INTEGER
      )
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1
  FROM rating_penalty_scores penalties
  WHERE penalties.entity_type = 'scene'
    AND penalties.entity_id = scenes.id
    AND penalties.key = 'noOrgasm'
    AND (penalties.raw_value != 0 OR penalties.weighted_value != 0)
    AND penalties.weighted_value != -2
);

UPDATE rating_penalty_scores
SET raw_value = -2,
    weighted_value = -2,
    updated_at = CURRENT_TIMESTAMP
WHERE entity_type = 'scene'
  AND key = 'noOrgasm'
  AND (raw_value != 0 OR weighted_value != 0);

COMMIT;
