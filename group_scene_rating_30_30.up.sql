-- CUSTOM: Apply after the group scene Rating Advisor weights change to 30/30.
-- Run against the Stash SQLite database. The final query reports affected scene IDs.
BEGIN IMMEDIATE;

DROP TABLE IF EXISTS temp.group_scene_rating_weight_changes_custom;
CREATE TEMP TABLE group_scene_rating_weight_changes_custom AS
SELECT DISTINCT scenes.id AS scene_id, scenes.rating AS previous_rating
FROM scenes
JOIN rating_criteria_scores scores
  ON scores.entity_type = 'scene' AND scores.entity_id = scenes.id
WHERE scores.key IN ('groupTopAttractiveness', 'groupEnergy')
  AND ABS(scores.weighted_value - scores.raw_value * 0.6) > 0.000001
  AND (
    SELECT COUNT(DISTINCT performer_id)
    FROM performers_scenes
    WHERE scene_id = scenes.id
  ) >= 4;

UPDATE rating_criteria_scores
SET weighted_value = raw_value * 0.6,
    updated_at = CURRENT_TIMESTAMP
WHERE entity_type = 'scene'
  AND key IN ('groupTopAttractiveness', 'groupEnergy')
  AND entity_id IN (SELECT scene_id FROM group_scene_rating_weight_changes_custom);

-- Recalculate from raw advisor answers, including bonuses, penalties, and O history.
-- This also handles scores whose old rating had been clamped to zero.
WITH RECURSIVE
criterion_totals AS (
  SELECT scores.entity_id AS scene_id,
    SUM(scores.raw_value * CASE scores.key
      WHEN 'groupTopAttractiveness' THEN 0.6
      WHEN 'groupEnergy' THEN 0.6
      WHEN 'groupPayoff' THEN 0.5
      WHEN 'groupUsability' THEN 0.5
    END) AS points
  FROM rating_criteria_scores scores
  JOIN group_scene_rating_weight_changes_custom changes ON changes.scene_id = scores.entity_id
  WHERE scores.entity_type = 'scene'
    AND scores.key IN ('groupTopAttractiveness', 'groupEnergy', 'groupPayoff', 'groupUsability')
  GROUP BY scores.entity_id
),
adjustment_totals AS (
  SELECT entity_id AS scene_id, SUM(raw_value) AS points
  FROM (
    SELECT bonuses.entity_id, bonuses.raw_value
    FROM rating_bonus_scores bonuses
    JOIN group_scene_rating_weight_changes_custom changes ON changes.scene_id = bonuses.entity_id
    WHERE bonuses.entity_type = 'scene'
      AND bonuses.key IN ('groupBottomAttractiveness', 'groupOralOnly', 'theme', 'godTierOrgasm', 'goatElement')
    UNION ALL
    SELECT penalties.entity_id, penalties.raw_value
    FROM rating_penalty_scores penalties
    JOIN group_scene_rating_weight_changes_custom changes ON changes.scene_id = penalties.entity_id
    WHERE penalties.entity_type = 'scene'
      AND penalties.key IN ('noOrgasm', 'production', 'extremelyPolished')
  )
  GROUP BY entity_id
),
o_counts AS (
  SELECT dates.scene_id, COUNT(*) AS o_count
  FROM scenes_o_dates dates
  JOIN group_scene_rating_weight_changes_custom changes ON changes.scene_id = dates.scene_id
  GROUP BY dates.scene_id
),
o_milestones(scene_id, milestone, o_count, tier, next_tier) AS (
  SELECT scene_id, 3, o_count, 1, 6 FROM o_counts WHERE o_count >= 3
  UNION ALL
  SELECT scene_id, milestone + 1, o_count,
    tier + (milestone + 1 >= next_tier),
    CASE WHEN milestone + 1 >= next_tier THEN next_tier * 2 ELSE next_tier END
  FROM o_milestones WHERE milestone < o_count
),
o_bonuses AS (
  SELECT scene_id, SUM(tier) AS points FROM o_milestones GROUP BY scene_id
)
UPDATE scenes
SET rating = CAST(ROUND(MAX(0,
      COALESCE((SELECT points FROM criterion_totals WHERE scene_id = scenes.id), 0) +
      COALESCE((SELECT points FROM adjustment_totals WHERE scene_id = scenes.id), 0)
    ) * 10) AS INTEGER) +
    COALESCE((SELECT points FROM o_bonuses WHERE scene_id = scenes.id), 0),
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (SELECT scene_id FROM group_scene_rating_weight_changes_custom);

COMMIT;

SELECT changes.scene_id, changes.previous_rating, scenes.rating AS updated_rating
FROM group_scene_rating_weight_changes_custom changes
JOIN scenes ON scenes.id = changes.scene_id
ORDER BY changes.scene_id;
