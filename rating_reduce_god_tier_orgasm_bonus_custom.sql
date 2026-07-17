-- Reduce active scene God-tier orgasm bonuses from +20 to +10 rating points.
-- Run against each Stash SQLite database while the matching application is stopped.

BEGIN IMMEDIATE;

UPDATE scenes
SET rating = MAX(0, COALESCE(rating, 0) - 10),
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (
  SELECT entity_id
  FROM rating_bonus_scores
  WHERE entity_type = 'scene'
    AND key = 'godTierOrgasm'
    AND weighted_value = 2
);

UPDATE rating_bonus_scores
SET raw_value = 1,
    weighted_value = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE entity_type = 'scene'
  AND key = 'godTierOrgasm'
  AND weighted_value = 2;

COMMIT;
