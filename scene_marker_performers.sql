-- Add scene_marker_performers join table for associating performers with markers
CREATE TABLE IF NOT EXISTS `scene_marker_performers` (
  `scene_marker_id` integer NOT NULL,
  `performer_id` integer NOT NULL,
  PRIMARY KEY (`scene_marker_id`, `performer_id`),
  FOREIGN KEY (`scene_marker_id`) REFERENCES `scene_markers` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`performer_id`) REFERENCES `performers` (`id`) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS `idx_scene_marker_performers_performer` ON `scene_marker_performers` (`performer_id`);
