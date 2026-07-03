BEGIN;

DELETE FROM rating_penalty_scores;
DELETE FROM rating_bonus_scores;
DELETE FROM rating_criteria_scores;

COMMIT;
