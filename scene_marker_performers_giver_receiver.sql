-- Migration to add giver/receiver distinction to scene_marker_performers
-- This renames performer_id to giver_performer_id and adds receiver_performer_id

-- NOTE: SQLite does not support renaming columns directly in older versions.
-- This migration uses the table recreation approach.

-- Step 1: Create new table with the updated schema (each row = one performer in one role)
-- A performer can be both giver and receiver on the same marker (two separate rows)
CREATE TABLE IF NOT EXISTS `scene_marker_performers_new` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `scene_marker_id` integer NOT NULL,
  `performer_id` integer NOT NULL,
  `role` text NOT NULL DEFAULT 'giver',  -- 'giver' or 'receiver'
  FOREIGN KEY (`scene_marker_id`) REFERENCES `scene_markers` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`performer_id`) REFERENCES `performers` (`id`) ON DELETE CASCADE,
  UNIQUE(`scene_marker_id`, `performer_id`, `role`)
);

-- Step 2: Migrate existing data (all existing entries become 'giver' role)
INSERT INTO `scene_marker_performers_new` (`scene_marker_id`, `performer_id`, `role`)
SELECT `scene_marker_id`, `performer_id`, 'giver'
FROM `scene_marker_performers`;

-- Step 3: Drop old table
DROP TABLE IF EXISTS `scene_marker_performers`;

-- Step 4: Rename new table to original name
ALTER TABLE `scene_marker_performers_new` RENAME TO `scene_marker_performers`;

-- Step 5: Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS `idx_scene_marker_performers_performer` ON `scene_marker_performers` (`performer_id`);
CREATE INDEX IF NOT EXISTS `idx_scene_marker_performers_marker` ON `scene_marker_performers` (`scene_marker_id`);
CREATE INDEX IF NOT EXISTS `idx_scene_marker_performers_role` ON `scene_marker_performers` (`role`);
CREATE INDEX IF NOT EXISTS `idx_scene_marker_performers_performer_role` ON `scene_marker_performers` (`performer_id`, `role`);
