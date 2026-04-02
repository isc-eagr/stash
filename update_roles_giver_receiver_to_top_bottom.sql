-- Migration: Update scene_marker_performers roles from giver/receiver to top/bottom
-- Run this ONCE after deploying the new code to update existing data.
-- 
-- BACKUP YOUR DATABASE BEFORE RUNNING!

-- Update 'giver' role to 'top'
UPDATE scene_marker_performers 
SET role = 'top' 
WHERE role = 'giver';

-- Update 'receiver' role to 'bottom'
UPDATE scene_marker_performers 
SET role = 'bottom' 
WHERE role = 'receiver';

-- Verification queries (uncomment to check results):
-- SELECT role, COUNT(*) as count FROM scene_marker_performers GROUP BY role;
