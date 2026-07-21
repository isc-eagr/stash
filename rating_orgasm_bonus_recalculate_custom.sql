-- Recalculate persisted scene and performer advisor ratings with the progressive
-- O-count bonus. Each qualifying O earns +1 at counts 3-5, +2 at 6-11,
-- +3 at 12-23, and one additional point whenever the tier range doubles.
-- Scenes qualify on every O from the 3rd; performers qualify at 3, 5, 7, etc.
-- Manual ratings without persisted advisor rows are intentionally untouched.
-- Run against each Stash SQLite database while the matching application is stopped.

BEGIN IMMEDIATE;

DROP TABLE IF EXISTS rating_orgasm_bonus_recalculation_custom;

CREATE TEMP TABLE rating_orgasm_bonus_recalculation_custom AS
WITH RECURSIVE
advisor_entities(entity_type, entity_id) AS (
  SELECT entity_type, entity_id FROM rating_criteria_scores
  UNION
  SELECT entity_type, entity_id FROM rating_bonus_scores
  UNION
  SELECT entity_type, entity_id FROM rating_penalty_scores
),
scene_rubrics(entity_id, rubric) AS (
  SELECT entities.entity_id,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM rating_criteria_scores scores
        WHERE scores.entity_type = 'scene'
          AND scores.entity_id = entities.entity_id
          AND scores.key IN ('groupTopAttractiveness', 'groupEnergy', 'groupPayoff', 'groupUsability')
      ) THEN 'group'
      WHEN EXISTS (
        SELECT 1
        FROM rating_criteria_scores scores
        WHERE scores.entity_type = 'scene'
          AND scores.entity_id = entities.entity_id
          AND scores.key IN ('soloPerformerAppeal', 'soloPerformance', 'soloUsability')
      ) THEN 'solo'
      ELSE 'default'
    END
  FROM advisor_entities entities
  WHERE entities.entity_type = 'scene'
),
score_rows(entity_type, entity_id, section, key, raw_value) AS (
  SELECT entity_type, entity_id, 'criterion', key, raw_value FROM rating_criteria_scores
  UNION ALL
  SELECT entity_type, entity_id, 'bonus', key, raw_value FROM rating_bonus_scores
  UNION ALL
  SELECT entity_type, entity_id, 'penalty', key, raw_value FROM rating_penalty_scores
),
allowed_score_rows(entity_type, entity_id, section, key, raw_value) AS (
  SELECT rows.entity_type, rows.entity_id, rows.section, rows.key, rows.raw_value
  FROM score_rows rows
  LEFT JOIN scene_rubrics ON scene_rubrics.entity_id = rows.entity_id
    AND rows.entity_type = 'scene'
  WHERE (
      rows.entity_type = 'performer'
      AND (
        (rows.section = 'criterion' AND rows.key IN ('face', 'body', 'performance', 'ethnicity', 'masculinity'))
        OR (rows.section = 'bonus' AND rows.key IN ('consistency', 'dick', 'tattoosBonus'))
        OR (rows.section = 'penalty' AND rows.key = 'feminine')
      )
    ) OR (
      rows.entity_type = 'scene'
      AND scene_rubrics.rubric = 'default'
      AND (
        (rows.section = 'criterion' AND rows.key IN ('topAttractiveness', 'bottomAttractiveness', 'chemistry', 'payoff', 'standout'))
        OR (rows.section = 'bonus' AND rows.key IN ('theme', 'oralOnly', 'godTierOrgasm', 'goatElement', 'unlikelyTop'))
        OR (rows.section = 'penalty' AND rows.key IN ('noOrgasm', 'production'))
      )
    ) OR (
      rows.entity_type = 'scene'
      AND scene_rubrics.rubric = 'solo'
      AND (
        (rows.section = 'criterion' AND rows.key IN ('soloPerformerAppeal', 'soloPerformance', 'soloUsability'))
        OR (rows.section = 'bonus' AND rows.key IN ('orgasmBonus', 'feetBonus', 'goatElement', 'theme'))
        OR (rows.section = 'penalty' AND rows.key IN ('noOrgasm', 'production'))
      )
    ) OR (
      rows.entity_type = 'scene'
      AND scene_rubrics.rubric = 'group'
      AND (
        (rows.section = 'criterion' AND rows.key IN ('groupTopAttractiveness', 'groupEnergy', 'groupPayoff', 'groupUsability'))
        OR (rows.section = 'bonus' AND rows.key IN ('groupBottomAttractiveness', 'groupOralOnly', 'theme', 'godTierOrgasm', 'goatElement'))
        OR (rows.section = 'penalty' AND rows.key IN ('noOrgasm', 'production'))
      )
    )
),
canonical_subtotals(entity_type, entity_id, subtotal) AS (
  SELECT entities.entity_type, entities.entity_id,
    COALESCE(SUM(
      CASE
        WHEN rows.section = 'criterion' AND rows.key IN ('topAttractiveness', 'face', 'body') THEN
          (CASE
            WHEN rows.raw_value <= 0.5 THEN 0 WHEN rows.raw_value <= 1.5 THEN 1
            WHEN rows.raw_value <= 2.5 THEN 2 WHEN rows.raw_value <= 3.5 THEN 3
            WHEN rows.raw_value <= 4.5 THEN 4 ELSE 5
          END) * 0.6
        WHEN rows.section = 'criterion' AND rows.key = 'bottomAttractiveness' THEN
          (CASE
            WHEN rows.raw_value <= 0.5 THEN 0 WHEN rows.raw_value <= 1.5 THEN 1
            WHEN rows.raw_value <= 2.5 THEN 2 WHEN rows.raw_value <= 3.5 THEN 3
            WHEN rows.raw_value <= 4.5 THEN 4 ELSE 5
          END) * 0.2
        WHEN rows.section = 'criterion' AND rows.key = 'chemistry' THEN
          (CASE
            WHEN rows.raw_value <= 0.5 THEN 0 WHEN rows.raw_value <= 1.5 THEN 1
            WHEN rows.raw_value <= 2.5 THEN 2 WHEN rows.raw_value <= 3.5 THEN 3
            WHEN rows.raw_value <= 4.5 THEN 4 ELSE 5
          END) * 0.4
        WHEN rows.section = 'criterion' AND rows.key IN ('payoff', 'groupPayoff') THEN
          (CASE
            WHEN rows.raw_value <= 1 THEN 0 WHEN rows.raw_value <= 2.5 THEN 2
            WHEN rows.raw_value <= 3.5 THEN 3 ELSE 4
          END) * 0.5
        WHEN rows.section = 'criterion' AND rows.key IN ('standout', 'groupUsability', 'soloUsability') THEN
          (CASE
            WHEN rows.raw_value <= 0.5 THEN 0 WHEN rows.raw_value <= 1.5 THEN 1
            WHEN rows.raw_value <= 2.5 THEN 2 WHEN rows.raw_value <= 3.5 THEN 3 ELSE 4
          END) * 0.5
        WHEN rows.section = 'criterion' AND rows.key = 'groupTopAttractiveness' THEN
          (CASE
            WHEN rows.raw_value <= 0.5 THEN 0 WHEN rows.raw_value <= 1.5 THEN 1
            WHEN rows.raw_value <= 2.5 THEN 2 WHEN rows.raw_value <= 3.5 THEN 3
            WHEN rows.raw_value <= 4.5 THEN 4 ELSE 5
          END) * 0.4
        WHEN rows.section = 'criterion' AND rows.key = 'groupEnergy' THEN
          (CASE
            WHEN rows.raw_value <= 0.5 THEN 0 WHEN rows.raw_value <= 1.5 THEN 1
            WHEN rows.raw_value <= 2.5 THEN 2 WHEN rows.raw_value <= 3.5 THEN 3
            WHEN rows.raw_value <= 4.5 THEN 4 ELSE 5
          END) * 0.8
        WHEN rows.section = 'criterion' AND rows.key = 'soloPerformerAppeal' THEN
          CASE
            WHEN rows.raw_value <= 0.5 THEN 0 WHEN rows.raw_value <= 1.5 THEN 1
            WHEN rows.raw_value <= 2.5 THEN 2 WHEN rows.raw_value <= 3.5 THEN 3
            WHEN rows.raw_value <= 4.5 THEN 4 ELSE 5
          END
        WHEN rows.section = 'criterion' AND rows.key = 'soloPerformance' THEN
          (CASE
            WHEN rows.raw_value <= 0.5 THEN 0 WHEN rows.raw_value <= 1.5 THEN 1
            WHEN rows.raw_value <= 2.5 THEN 2 WHEN rows.raw_value <= 3.5 THEN 3 ELSE 4
          END) * 0.75
        WHEN rows.section = 'criterion' AND rows.key = 'performance' THEN
          (CASE
            WHEN rows.raw_value <= 0.5 THEN 0 WHEN rows.raw_value <= 1.5 THEN 1
            WHEN rows.raw_value <= 2.5 THEN 2 WHEN rows.raw_value <= 3.5 THEN 3
            WHEN rows.raw_value <= 4.5 THEN 4 ELSE 5
          END) * 0.4
        WHEN rows.section = 'criterion' AND rows.key IN ('ethnicity', 'masculinity') THEN
          (CASE
            WHEN rows.raw_value <= 0.5 THEN 0 WHEN rows.raw_value <= 1.5 THEN 1
            WHEN rows.raw_value <= 2.5 THEN 2 ELSE 3
          END) / 3.0
        WHEN rows.section = 'bonus' AND rows.key IN ('theme', 'oralOnly', 'unlikelyTop', 'consistency', 'dick', 'tattoosBonus') THEN
          CASE WHEN rows.raw_value <= 0.25 THEN 0 ELSE 0.5 END
        WHEN rows.section = 'bonus' AND rows.key IN ('godTierOrgasm', 'orgasmBonus', 'feetBonus', 'groupBottomAttractiveness') THEN
          CASE WHEN rows.raw_value <= 0.5 THEN 0 ELSE 1 END
        WHEN rows.section = 'bonus' AND rows.key IN ('goatElement', 'groupOralOnly') THEN
          CASE WHEN rows.raw_value <= 1 THEN 0 ELSE 2 END
        WHEN rows.section = 'penalty' AND rows.key = 'noOrgasm' THEN
          CASE WHEN rows.raw_value < -1 THEN -2 ELSE 0 END
        WHEN rows.section = 'penalty' AND rows.key IN ('production', 'feminine') THEN
          CASE WHEN rows.raw_value < -0.5 THEN -1 ELSE 0 END
        ELSE 0
      END
    ), 0)
  FROM advisor_entities entities
  LEFT JOIN allowed_score_rows rows
    ON rows.entity_type = entities.entity_type
    AND rows.entity_id = entities.entity_id
  GROUP BY entities.entity_type, entities.entity_id
),
orgasm_counts(entity_type, entity_id, orgasm_count) AS (
  SELECT entities.entity_type, entities.entity_id,
    CASE entities.entity_type
      WHEN 'scene' THEN (
        SELECT COUNT(*) FROM scenes_o_dates WHERE scenes_o_dates.scene_id = entities.entity_id
      )
      WHEN 'performer' THEN (
        SELECT COUNT(*)
        FROM performers_scenes
        JOIN scenes_o_dates ON scenes_o_dates.scene_id = performers_scenes.scene_id
        WHERE performers_scenes.performer_id = entities.entity_id
      )
      ELSE 0
    END
  FROM advisor_entities entities
),
progressive_tiers(tier, lower_bound, upper_bound) AS (
  VALUES (1, 3, 5)
  UNION ALL
  SELECT tier + 1, lower_bound * 2, upper_bound * 2 + 1
  FROM progressive_tiers
  WHERE upper_bound < (SELECT COALESCE(MAX(orgasm_count), 0) FROM orgasm_counts)
),
orgasm_bonuses(entity_type, entity_id, bonus) AS (
  SELECT counts.entity_type, counts.entity_id,
    COALESCE(SUM(
      CASE counts.entity_type
        WHEN 'scene' THEN
          (MIN(counts.orgasm_count, tiers.upper_bound) - tiers.lower_bound + 1) * tiers.tier
        WHEN 'performer' THEN
          (((MIN(counts.orgasm_count, tiers.upper_bound) + 1) / 2) - (tiers.lower_bound / 2)) * tiers.tier
        ELSE 0
      END
    ), 0)
  FROM orgasm_counts counts
  LEFT JOIN progressive_tiers tiers ON tiers.lower_bound <= counts.orgasm_count
  GROUP BY counts.entity_type, counts.entity_id
)
SELECT subtotals.entity_type, subtotals.entity_id,
  CAST(ROUND(MAX(0, subtotals.subtotal) * 10) AS INTEGER) + bonuses.bonus AS rating100
FROM canonical_subtotals subtotals
JOIN orgasm_bonuses bonuses
  ON bonuses.entity_type = subtotals.entity_type
  AND bonuses.entity_id = subtotals.entity_id;

UPDATE scenes
SET rating = (
      SELECT recalculated.rating100
      FROM rating_orgasm_bonus_recalculation_custom recalculated
      WHERE recalculated.entity_type = 'scene'
        AND recalculated.entity_id = scenes.id
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1
  FROM rating_orgasm_bonus_recalculation_custom recalculated
  WHERE recalculated.entity_type = 'scene'
    AND recalculated.entity_id = scenes.id
);

UPDATE performers
SET rating = (
      SELECT recalculated.rating100
      FROM rating_orgasm_bonus_recalculation_custom recalculated
      WHERE recalculated.entity_type = 'performer'
        AND recalculated.entity_id = performers.id
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1
  FROM rating_orgasm_bonus_recalculation_custom recalculated
  WHERE recalculated.entity_type = 'performer'
    AND recalculated.entity_id = performers.id
);

DROP TABLE rating_orgasm_bonus_recalculation_custom;

COMMIT;
