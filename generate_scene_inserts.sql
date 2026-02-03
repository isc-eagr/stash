-- Script to generate INSERT statements for scene 32794 from scene 30493
-- This script queries the data and outputs INSERT statements

PRAGMA foreign_keys=OFF;

-- Generate INSERT statements for SCENES_O_DATES
SELECT 'INSERT INTO scenes_o_dates (scene_id, o_date) VALUES (' || 32794 || ', ''' || o_date || ''');'
FROM scenes_o_dates
WHERE scene_id = 30493;

-- Generate INSERT statements for SCENE_MARKERS
SELECT 'INSERT INTO scene_markers (title, seconds, primary_tag_id, scene_id, created_at, updated_at) VALUES (''' || 
       REPLACE(title, '''', '''''') || ''', ' || 
       seconds || ', ' || 
       primary_tag_id || ', ' || 
       32794 || ', ''' || 
       created_at || ''', ''' || 
       updated_at || ''');'
FROM scene_markers
WHERE scene_id = 30493;

PRAGMA foreign_keys=ON;
