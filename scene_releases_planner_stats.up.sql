-- CUSTOM: Run after the standalone Scene Releases activity and rating upgrades.
-- Rebuilding these tables removes their sqlite_stat1 rows even though indexes
-- are recreated. Performer marker-role queries become very slow without them.
-- Safe to rerun; this does not alter application data or upstream migrations.
ANALYZE scene_markers;
ANALYZE scene_negative_markers;
ANALYZE scene_multi_segment_loop_presets;
ANALYZE rating_criteria_scores;
ANALYZE rating_bonus_scores;
ANALYZE rating_penalty_scores;
