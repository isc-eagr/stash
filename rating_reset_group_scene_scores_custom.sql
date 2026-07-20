BEGIN;

CREATE TEMP TABLE group_scene_rating_reset_targets_custom AS
SELECT ps.scene_id
FROM performers_scenes ps
GROUP BY ps.scene_id
HAVING COUNT(DISTINCT ps.performer_id) >= 4
  AND (
    EXISTS (
      SELECT 1
      FROM rating_criteria_scores rcs
      WHERE rcs.entity_type = 'scene' AND rcs.entity_id = ps.scene_id
    )
    OR EXISTS (
      SELECT 1
      FROM rating_bonus_scores rbs
      WHERE rbs.entity_type = 'scene' AND rbs.entity_id = ps.scene_id
    )
    OR EXISTS (
      SELECT 1
      FROM rating_penalty_scores rps
      WHERE rps.entity_type = 'scene' AND rps.entity_id = ps.scene_id
    )
  );

DELETE FROM rating_criteria_scores
WHERE entity_type = 'scene'
  AND entity_id IN (SELECT scene_id FROM group_scene_rating_reset_targets_custom);

DELETE FROM rating_bonus_scores
WHERE entity_type = 'scene'
  AND entity_id IN (SELECT scene_id FROM group_scene_rating_reset_targets_custom);

DELETE FROM rating_penalty_scores
WHERE entity_type = 'scene'
  AND entity_id IN (SELECT scene_id FROM group_scene_rating_reset_targets_custom);

UPDATE scenes
SET rating = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (SELECT scene_id FROM group_scene_rating_reset_targets_custom);

DROP TABLE group_scene_rating_reset_targets_custom;

COMMIT;
