-- Rebalance persisted solo and group scene advisor rows for the July 2026 rubrics.
-- Solo: attractiveness 50, performance 30, usability 20.
-- Group: top attractiveness 20, energy/coordination 40, orgasm quality 20,
-- usability 20; retired standout values are intentionally not carried forward.
-- Run against each Stash SQLite database while the matching application is stopped.

BEGIN IMMEDIATE;

CREATE TEMP TABLE solo_scene_rating_rebalance_custom AS
WITH solo_targets AS (
  SELECT entity_id AS scene_id
  FROM rating_criteria_scores
  WHERE entity_type = 'scene'
    AND key IN ('soloPerformerAppeal', 'cameraWork')
  UNION
  SELECT entity_id AS scene_id
  FROM rating_bonus_scores
  WHERE entity_type = 'scene'
    AND key = 'outstandingPerformance'
), converted AS (
  SELECT
    target.scene_id,
    CASE WHEN attractiveness.id IS NOT NULL
      THEN MIN(5, MAX(0, ROUND(
        CASE
          WHEN attractiveness.raw_value BETWEEN 0 AND 5
           AND ABS(attractiveness.weighted_value - attractiveness.raw_value) < 0.0001
            THEN attractiveness.raw_value
          ELSE attractiveness.weighted_value / 1.4
        END
      )))
    END AS attractiveness_raw,
    CASE WHEN camera.id IS NOT NULL
      THEN MIN(4, MAX(0, ROUND(camera.raw_value)))
    END AS usability_raw,
    CASE WHEN performance.id IS NOT NULL
      THEN 4
    END AS performance_raw,
    COALESCE(attractiveness.weighted_value, 0) +
      COALESCE(camera.weighted_value, 0) +
      COALESCE(performance.weighted_value, 0) AS old_contribution
  FROM solo_targets target
  LEFT JOIN rating_criteria_scores attractiveness
    ON attractiveness.entity_type = 'scene'
   AND attractiveness.entity_id = target.scene_id
   AND attractiveness.key = 'soloPerformerAppeal'
  LEFT JOIN rating_criteria_scores camera
    ON camera.entity_type = 'scene'
   AND camera.entity_id = target.scene_id
   AND camera.key = 'cameraWork'
  LEFT JOIN rating_bonus_scores performance
    ON performance.entity_type = 'scene'
   AND performance.entity_id = target.scene_id
   AND performance.key = 'outstandingPerformance'
   AND (performance.raw_value != 0 OR performance.weighted_value != 0)
)
SELECT
  scene_id,
  attractiveness_raw,
  usability_raw,
  performance_raw,
  old_contribution,
  COALESCE(attractiveness_raw, 0) +
    COALESCE(usability_raw * 0.5, 0) +
    COALESCE(performance_raw * 0.75, 0) AS new_contribution
FROM converted;

UPDATE scenes
SET rating = MAX(
      0,
      COALESCE(rating, 0) + CAST(
        ROUND(
          (
            SELECT new_contribution - old_contribution
            FROM solo_scene_rating_rebalance_custom migration
            WHERE migration.scene_id = scenes.id
          ) * 10
        ) AS INTEGER
      )
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (SELECT scene_id FROM solo_scene_rating_rebalance_custom);

UPDATE rating_criteria_scores
SET raw_value = (
      SELECT attractiveness_raw
      FROM solo_scene_rating_rebalance_custom migration
      WHERE migration.scene_id = rating_criteria_scores.entity_id
    ),
    weighted_value = (
      SELECT attractiveness_raw
      FROM solo_scene_rating_rebalance_custom migration
      WHERE migration.scene_id = rating_criteria_scores.entity_id
    ),
    label = CASE CAST((
      SELECT attractiveness_raw
      FROM solo_scene_rating_rebalance_custom migration
      WHERE migration.scene_id = rating_criteria_scores.entity_id
    ) AS INTEGER)
      WHEN 0 THEN 'Not attractive'
      WHEN 1 THEN 'Some appeal'
      WHEN 2 THEN 'Decent'
      WHEN 3 THEN 'Attractive'
      WHEN 4 THEN 'Very attractive'
      ELSE 'Perfect'
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE entity_type = 'scene'
  AND key = 'soloPerformerAppeal'
  AND entity_id IN (SELECT scene_id FROM solo_scene_rating_rebalance_custom);

INSERT INTO rating_criteria_scores (
  entity_type, entity_id, key, raw_value, weighted_value, label, created_at, updated_at
)
SELECT
  'scene',
  scene_id,
  'soloPerformance',
  performance_raw,
  performance_raw * 0.75,
  'Loving it',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM solo_scene_rating_rebalance_custom
WHERE performance_raw IS NOT NULL
ON CONFLICT(entity_type, entity_id, key) DO UPDATE SET
  raw_value = excluded.raw_value,
  weighted_value = excluded.weighted_value,
  label = excluded.label,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO rating_criteria_scores (
  entity_type, entity_id, key, raw_value, weighted_value, label, created_at, updated_at
)
SELECT
  'scene',
  scene_id,
  'soloUsability',
  usability_raw,
  usability_raw * 0.5,
  CASE CAST(usability_raw AS INTEGER)
    WHEN 0 THEN 'Mostly unusable'
    WHEN 1 THEN 'Limited use'
    WHEN 2 THEN 'Mixed / standard'
    WHEN 3 THEN 'Highly usable'
    ELSE 'Nearly unskippable'
  END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM solo_scene_rating_rebalance_custom
WHERE usability_raw IS NOT NULL
ON CONFLICT(entity_type, entity_id, key) DO UPDATE SET
  raw_value = excluded.raw_value,
  weighted_value = excluded.weighted_value,
  label = excluded.label,
  updated_at = CURRENT_TIMESTAMP;

DELETE FROM rating_criteria_scores
WHERE entity_type = 'scene'
  AND key = 'cameraWork'
  AND entity_id IN (SELECT scene_id FROM solo_scene_rating_rebalance_custom);

DELETE FROM rating_bonus_scores
WHERE entity_type = 'scene'
  AND key = 'outstandingPerformance'
  AND entity_id IN (SELECT scene_id FROM solo_scene_rating_rebalance_custom);

DROP TABLE solo_scene_rating_rebalance_custom;

CREATE TEMP TABLE group_scene_rating_rebalance_custom AS
WITH group_targets AS (
  SELECT scores.entity_id AS scene_id
  FROM rating_criteria_scores scores
  WHERE scores.entity_type = 'scene'
    AND scores.key IN (
      'groupTopAttractiveness',
      'groupEnergy',
      'groupParticipation',
      'groupPayoff',
      'groupStandout'
    )
    AND (
      SELECT COUNT(DISTINCT ps.performer_id)
      FROM performers_scenes ps
      WHERE ps.scene_id = scores.entity_id
    ) >= 4
  UNION
  SELECT bonus.entity_id AS scene_id
  FROM rating_bonus_scores bonus
  WHERE bonus.entity_type = 'scene'
    AND bonus.key = 'unlikelyTop'
    AND (
      SELECT COUNT(DISTINCT ps.performer_id)
      FROM performers_scenes ps
      WHERE ps.scene_id = bonus.entity_id
    ) >= 4
), source_values AS (
  SELECT
    target.scene_id,
    CASE WHEN top_score.id IS NOT NULL
      THEN MIN(5, MAX(0, ROUND(top_score.raw_value)))
    END AS top_raw,
    CASE WHEN energy.id IS NOT NULL OR coordination.id IS NOT NULL
      THEN MIN(5, MAX(0, ROUND(
        (
          CASE WHEN energy.id IS NOT NULL THEN energy.raw_value * 0.7 ELSE 0 END +
          CASE WHEN coordination.id IS NOT NULL THEN coordination.raw_value * 0.4 ELSE 0 END
        ) / (
          CASE WHEN energy.id IS NOT NULL THEN 0.7 ELSE 0 END +
          CASE WHEN coordination.id IS NOT NULL THEN 0.4 ELSE 0 END
        )
      )))
    END AS energy_coordination_raw,
    COALESCE(top_score.weighted_value, 0) +
      COALESCE(energy.weighted_value, 0) +
      COALESCE(coordination.weighted_value, 0) +
      COALESCE(standout.weighted_value, 0) +
      COALESCE(unlikely_top.weighted_value, 0) AS old_contribution
  FROM group_targets target
  LEFT JOIN rating_criteria_scores top_score
    ON top_score.entity_type = 'scene'
   AND top_score.entity_id = target.scene_id
   AND top_score.key = 'groupTopAttractiveness'
  LEFT JOIN rating_criteria_scores energy
    ON energy.entity_type = 'scene'
   AND energy.entity_id = target.scene_id
   AND energy.key = 'groupEnergy'
  LEFT JOIN rating_criteria_scores coordination
    ON coordination.entity_type = 'scene'
   AND coordination.entity_id = target.scene_id
   AND coordination.key = 'groupParticipation'
  LEFT JOIN rating_criteria_scores standout
    ON standout.entity_type = 'scene'
   AND standout.entity_id = target.scene_id
   AND standout.key = 'groupStandout'
  LEFT JOIN rating_bonus_scores unlikely_top
    ON unlikely_top.entity_type = 'scene'
   AND unlikely_top.entity_id = target.scene_id
   AND unlikely_top.key = 'unlikelyTop'
)
SELECT
  scene_id,
  top_raw,
  energy_coordination_raw,
  old_contribution,
  COALESCE(top_raw * 0.4, 0) +
    COALESCE(energy_coordination_raw * 0.8, 0) AS new_contribution
FROM source_values;

UPDATE scenes
SET rating = MAX(
      0,
      COALESCE(rating, 0) + CAST(
        ROUND(
          (
            SELECT new_contribution - old_contribution
            FROM group_scene_rating_rebalance_custom migration
            WHERE migration.scene_id = scenes.id
          ) * 10
        ) AS INTEGER
      )
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (SELECT scene_id FROM group_scene_rating_rebalance_custom);

UPDATE rating_criteria_scores
SET raw_value = (
      SELECT top_raw
      FROM group_scene_rating_rebalance_custom migration
      WHERE migration.scene_id = rating_criteria_scores.entity_id
    ),
    weighted_value = (
      SELECT top_raw * 0.4
      FROM group_scene_rating_rebalance_custom migration
      WHERE migration.scene_id = rating_criteria_scores.entity_id
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE entity_type = 'scene'
  AND key = 'groupTopAttractiveness'
  AND entity_id IN (SELECT scene_id FROM group_scene_rating_rebalance_custom);

INSERT INTO rating_criteria_scores (
  entity_type, entity_id, key, raw_value, weighted_value, label, created_at, updated_at
)
SELECT
  'scene',
  scene_id,
  'groupEnergy',
  energy_coordination_raw,
  energy_coordination_raw * 0.8,
  CASE CAST(energy_coordination_raw AS INTEGER)
    WHEN 0 THEN 'Disconnected'
    WHEN 1 THEN 'Weak'
    WHEN 2 THEN 'Uneven'
    WHEN 3 THEN 'Strong'
    WHEN 4 THEN 'Excellent'
    ELSE 'Perfect execution'
  END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM group_scene_rating_rebalance_custom
WHERE energy_coordination_raw IS NOT NULL
ON CONFLICT(entity_type, entity_id, key) DO UPDATE SET
  raw_value = excluded.raw_value,
  weighted_value = excluded.weighted_value,
  label = excluded.label,
  updated_at = CURRENT_TIMESTAMP;

DELETE FROM rating_criteria_scores
WHERE entity_type = 'scene'
  AND key IN ('groupParticipation', 'groupStandout')
  AND entity_id IN (SELECT scene_id FROM group_scene_rating_rebalance_custom);

DELETE FROM rating_bonus_scores
WHERE entity_type = 'scene'
  AND key = 'unlikelyTop'
  AND entity_id IN (SELECT scene_id FROM group_scene_rating_rebalance_custom);

DROP TABLE group_scene_rating_rebalance_custom;

COMMIT;
