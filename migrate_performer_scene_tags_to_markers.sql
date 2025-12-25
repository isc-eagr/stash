-- Migration: Convert performer_scene_tags to scene_marker_performers
-- This is a ONE-TIME MANUAL migration script. Run it yourself when ready.
-- 
-- PREREQUISITES:
-- 1. You must have already created the scene_marker_performers table with giver/receiver roles
--    (scene_marker_performers_giver_receiver.sql should have been run first)
-- 2. Configure the tag IDs below before running
-- 3. Back up your database before running!
--
-- This script will:
-- 1. Add performance indexes for scene_marker_performers queries
-- 2. Create sex markers (0:00) for scenes with top/bottom performer_scene_tags
-- 3. Create oral markers (0:00) for scenes with dicksucked/suckeddick performer_scene_tags
-- 
-- The performer_scene_tags table is LEFT UNTOUCHED for historical reference.

-- ============================================================================
-- CONFIGURATION - Set these tag IDs before running!
-- ============================================================================

-- Find your tag IDs by querying: SELECT id, name FROM tags WHERE name IN ('Top', 'Bottom', 'DickSucked', 'SuckedDick', 'Sex', 'Oral', 'Jerk');
-- Then replace the placeholder values below:

-- performer_scene_tags role tags (used to identify who did what in existing data)
-- These are the tags you used to mark performers in scenes
-- PRODUCTION TAG IDs:
-- Tag ID for "Top" performer role: 62
-- Tag ID for "Bottom" performer role: 63
-- Tag ID for "DickSucked" performer role (giver in oral): 249
-- Tag ID for "SuckedDick" performer role (receiver in oral): 251

-- scene_markers primary tag IDs (the tags that will be assigned to new markers)
-- These are the category tags for the markers themselves
-- Tag ID for "Sex" marker category: 268
-- Tag ID for "Oral" marker category: 196
-- Tag ID for "Jerk/Solo" marker category: 24
-- Tag ID for "Solo" performer_scene_tag (in performer_scene_tags_DEPRECATED): 24

-- ============================================================================
-- STEP 1: Add index for efficient role-based queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS `idx_scene_marker_performers_performer_role` 
  ON `scene_marker_performers` (`performer_id`, `role`);

CREATE INDEX IF NOT EXISTS `idx_scene_marker_performers_role` 
  ON `scene_marker_performers` (`role`);

-- ============================================================================
-- STEP 2: Create sex markers for scenes with top/bottom performer_scene_tags
-- ============================================================================

-- Find scenes that have BOTH a top and bottom performer_scene_tag
-- These are 2-performer sex scenes that need markers created

-- First, create the scene_markers entries at position 0:00
INSERT INTO scene_markers (scene_id, primary_tag_id, title, seconds, created_at, updated_at)
SELECT DISTINCT 
    pst_top.scene_id,
    268,  -- Use configured sex tag ID
    'Sex NEEDS ADJUSTING',
    0,
    datetime('now'),
    datetime('now')
FROM performer_scene_tags pst_top
INNER JOIN performer_scene_tags pst_bottom 
    ON pst_top.scene_id = pst_bottom.scene_id
    AND pst_top.performer_id != pst_bottom.performer_id
WHERE pst_top.tag_id = 62  -- Top tag
  AND pst_bottom.tag_id = 63  -- Bottom tag
  -- Only create if no sex marker already exists at 0:00 for this scene
  AND NOT EXISTS (
      SELECT 1 FROM scene_markers sm 
      WHERE sm.scene_id = pst_top.scene_id 
        AND sm.primary_tag_id = 268 
        AND sm.seconds = 0
  );

-- Now add the giver (top) to scene_marker_performers
INSERT INTO scene_marker_performers (scene_marker_id, performer_id, role)
SELECT 
    sm.id,
    pst_top.performer_id,
    'giver'
FROM scene_markers sm
INNER JOIN performer_scene_tags pst_top 
    ON sm.scene_id = pst_top.scene_id
WHERE sm.primary_tag_id = 268  -- Sex tag
  AND sm.seconds = 0
  AND pst_top.tag_id = 62  -- Top tag
  AND NOT EXISTS (
      SELECT 1 FROM scene_marker_performers smp 
      WHERE smp.scene_marker_id = sm.id 
        AND smp.performer_id = pst_top.performer_id 
        AND smp.role = 'giver'
  );

-- Add the receiver (bottom) to scene_marker_performers
INSERT INTO scene_marker_performers (scene_marker_id, performer_id, role)
SELECT 
    sm.id,
    pst_bottom.performer_id,
    'receiver'
FROM scene_markers sm
INNER JOIN performer_scene_tags pst_bottom 
    ON sm.scene_id = pst_bottom.scene_id
WHERE sm.primary_tag_id = 268  -- Sex tag
  AND sm.seconds = 0
  AND pst_bottom.tag_id = 63  -- Bottom tag
  AND NOT EXISTS (
      SELECT 1 FROM scene_marker_performers smp 
      WHERE smp.scene_marker_id = sm.id 
        AND smp.performer_id = pst_bottom.performer_id 
        AND smp.role = 'receiver'
  );

-- ============================================================================
-- STEP 3: Create oral markers for scenes with dicksucked/suckeddick performer_scene_tags
-- ============================================================================

-- Find scenes that have BOTH dicksucked and suckeddick performer_scene_tags

-- First, create the scene_markers entries at position 0:00
INSERT INTO scene_markers (scene_id, primary_tag_id, title, seconds, created_at, updated_at)
SELECT DISTINCT 
    pst_giver.scene_id,
    196,  -- Use configured oral tag ID
    'Oral NEEDS ADJUSTING',
    0,
    datetime('now'),
    datetime('now')
FROM performer_scene_tags pst_giver
INNER JOIN performer_scene_tags pst_receiver 
    ON pst_giver.scene_id = pst_receiver.scene_id
    AND pst_giver.performer_id != pst_receiver.performer_id
WHERE pst_giver.tag_id = 249  -- DickSucked tag
  AND pst_receiver.tag_id = 251  -- SuckedDick tag
  -- Only create if no oral marker already exists at 0:00 for this scene
  AND NOT EXISTS (
      SELECT 1 FROM scene_markers sm 
      WHERE sm.scene_id = pst_giver.scene_id 
        AND sm.primary_tag_id = 196 
        AND sm.seconds = 0
  );

-- Now add the giver (dicksucked) to scene_marker_performers
INSERT INTO scene_marker_performers (scene_marker_id, performer_id, role)
SELECT 
    sm.id,
    pst_giver.performer_id,
    'giver'
FROM scene_markers sm
INNER JOIN performer_scene_tags pst_giver 
    ON sm.scene_id = pst_giver.scene_id
WHERE sm.primary_tag_id = 196  -- Oral tag
  AND sm.seconds = 0
  AND pst_giver.tag_id = 249  -- DickSucked tag
  AND NOT EXISTS (
      SELECT 1 FROM scene_marker_performers smp 
      WHERE smp.scene_marker_id = sm.id 
        AND smp.performer_id = pst_giver.performer_id 
        AND smp.role = 'giver'
  );

-- Add the receiver (suckeddick) to scene_marker_performers
INSERT INTO scene_marker_performers (scene_marker_id, performer_id, role)
SELECT 
    sm.id,
    pst_receiver.performer_id,
    'receiver'
FROM scene_markers sm
INNER JOIN performer_scene_tags pst_receiver 
    ON sm.scene_id = pst_receiver.scene_id
WHERE sm.primary_tag_id = 196  -- Oral tag
  AND sm.seconds = 0
  AND pst_receiver.tag_id = 251  -- SuckedDick tag
  AND NOT EXISTS (
      SELECT 1 FROM scene_marker_performers smp 
      WHERE smp.scene_marker_id = sm.id 
        AND smp.performer_id = pst_receiver.performer_id 
        AND smp.role = 'receiver'
  );

-- ============================================================================
-- STEP 3b: Create solo markers for single-performer scenes marked as solo
-- ============================================================================

-- Create a solo/jerk marker (configured solo tag ID) at 0:00 for scenes that:
-- 1) Have exactly one performer
-- 2) That performer had the Solo tag in performer_scene_tags_DEPRECATED
-- 3) Do not already have a solo marker at 0:00

INSERT INTO scene_markers (scene_id, primary_tag_id, title, seconds, created_at, updated_at)
SELECT DISTINCT
    pst.scene_id,
    24,  -- Configured solo marker category tag ID
    'Solo NEEDS ADJUSTING',
    0,
    datetime('now'),
    datetime('now')
FROM performer_scene_tags_DEPRECATED pst
WHERE pst.tag_id = 24  -- Solo performer tag in deprecated table
  -- Scene has exactly one performer
  AND (
      SELECT COUNT(DISTINCT ps2.performer_id)
      FROM performers_scenes ps2
      WHERE ps2.scene_id = pst.scene_id
  ) = 1
  -- No existing solo marker at 0:00
  AND NOT EXISTS (
      SELECT 1 FROM scene_markers sm
      WHERE sm.scene_id = pst.scene_id
        AND sm.primary_tag_id = 24
        AND sm.seconds = 0
  );

-- ============================================================================
-- STEP 4: Add performers to existing jerk/solo markers for single-performer scenes
-- ============================================================================

-- For all jerk markers (configured solo tag ID = 24) in scenes with exactly 1 performer,
-- add that performer as the giver in scene_marker_performers

INSERT INTO scene_marker_performers (scene_marker_id, performer_id, role)
SELECT 
    sm.id,
    ps.performer_id,
    'giver'
FROM scene_markers sm
INNER JOIN performers_scenes ps ON ps.scene_id = sm.scene_id
WHERE sm.primary_tag_id = 24  -- Configured solo tag ID (Jerk)
  -- Only for scenes with exactly 1 performer
  AND (SELECT COUNT(*) FROM performers_scenes ps2 WHERE ps2.scene_id = sm.scene_id) = 1
  -- Don't duplicate if already exists
  AND NOT EXISTS (
      SELECT 1 FROM scene_marker_performers smp 
      WHERE smp.scene_marker_id = sm.id 
        AND smp.performer_id = ps.performer_id
  );

-- ============================================================================
-- VERIFICATION QUERIES (uncomment and run to verify migration)
-- ============================================================================

-- Check how many sex markers were created:
-- SELECT COUNT(*) as sex_markers_created FROM scene_markers WHERE primary_tag_id = 268 AND seconds = 0;

-- Check how many oral markers were created:
-- SELECT COUNT(*) as oral_markers_created FROM scene_markers WHERE primary_tag_id = 196 AND seconds = 0;

-- Check scene_marker_performers entries:
-- SELECT role, COUNT(*) as count FROM scene_marker_performers GROUP BY role;

-- View sample of migrated data:
-- SELECT 
--     s.title as scene_title,
--     sm.id as marker_id,
--     t.name as marker_tag,
--     smp.role,
--     p.name as performer_name
-- FROM scene_markers sm
-- JOIN scenes s ON s.id = sm.scene_id
-- JOIN tags t ON t.id = sm.primary_tag_id
-- JOIN scene_marker_performers smp ON smp.scene_marker_id = sm.id
-- JOIN performers p ON p.id = smp.performer_id
-- WHERE sm.seconds = 0 AND t.id IN (268, 196)
-- LIMIT 20;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- The performer_scene_tags table is NOT deleted by this migration.
-- It remains for historical reference and potential rollback.
--
-- If you need to rollback, you can:
-- 1. Delete the created markers:
--    DELETE FROM scene_markers WHERE primary_tag_id IN (268, 196) AND seconds = 0;
--
-- 2. The scene_marker_performers entries will cascade delete automatically.
--
-- After verifying the migration is successful, you may optionally archive
-- or export the performer_scene_tags table, but we recommend keeping it
-- in the database indefinitely as it takes minimal space.
