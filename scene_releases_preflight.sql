-- Read-only checks. Run against a COPY of the DB before either v2 upgrade.
-- A nonzero issue_count needs review; do not discard rows to force a pass.
-- Migration bookkeeping differs by Stash version; list the installed tables
-- without assuming a particular migration table or column.
SELECT name AS migration_table FROM sqlite_master
WHERE type = 'table' AND name LIKE '%migration%' ORDER BY name;
SELECT name AS installed_release_object FROM sqlite_master
WHERE name IN ('scene_releases','scene_release_metadata','scene_release_activity_upgrade_guard','scene_all_galleries_custom')
ORDER BY name;
SELECT 'scene_count' AS check_name, COUNT(*) AS value FROM scenes
UNION ALL SELECT 'release_count', COUNT(*) FROM scene_releases
UNION ALL SELECT 'release_file_count', COUNT(*) FROM scene_release_files
UNION ALL SELECT 'release_cover_count', COUNT(*) FROM scene_releases WHERE cover_blob IS NOT NULL;

SELECT 'dangling_release_covers' AS check_name, COUNT(*) AS issue_count
FROM scene_releases sr LEFT JOIN blobs b ON b.checksum = sr.cover_blob
WHERE sr.cover_blob IS NOT NULL AND b.checksum IS NULL;
SELECT sr.id AS release_id, sr.cover_blob AS missing_checksum
FROM scene_releases sr LEFT JOIN blobs b ON b.checksum = sr.cover_blob
WHERE sr.cover_blob IS NOT NULL AND b.checksum IS NULL;

SELECT 'missing_release_files' AS check_name, COUNT(*) AS issue_count
FROM scene_release_files rf LEFT JOIN files f ON f.id = rf.file_id
WHERE f.id IS NULL;
SELECT rf.release_id, rf.file_id FROM scene_release_files rf
LEFT JOIN files f ON f.id = rf.file_id WHERE f.id IS NULL;

WITH owners AS (
  SELECT file_id, scene_id AS family_id FROM scenes_files
  UNION ALL
  SELECT rf.file_id, sr.scene_id FROM scene_release_files rf
  JOIN scene_releases sr ON sr.id = rf.release_id
)
SELECT file_id, COUNT(*) AS owner_count, COUNT(DISTINCT family_id) AS family_count
FROM owners GROUP BY file_id HAVING COUNT(*) > 1;

SELECT 'invalid_main_primary' AS check_name, COUNT(*) AS issue_count FROM (
  SELECT scene_id FROM scenes_files GROUP BY scene_id HAVING SUM("primary" = 1) != 1
)
UNION ALL
SELECT 'invalid_release_primary', COUNT(*) FROM (
  SELECT release_id FROM scene_release_files GROUP BY release_id HAVING SUM("primary" = 1) != 1
);

PRAGMA foreign_key_check;
