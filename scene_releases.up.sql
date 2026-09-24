-- Scene Releases Migration
-- Run this SQL manually to add scene releases support
-- This does not use the main database versioning system

-- Main releases table - stores release metadata
CREATE TABLE IF NOT EXISTS `scene_releases` (
    `id` integer primary key autoincrement NOT NULL,
    `scene_id` integer NOT NULL,
    `title` varchar(255),
    `code` varchar(255),
    `details` text,
    `director` varchar(255),
    `url` varchar(255),
    `date` date,
    `date_precision` tinyint,
    `studio_id` integer,
    `cover_blob` varchar(255) REFERENCES `blobs`(`checksum`),
    `play_order` integer NOT NULL DEFAULT 0,
    `created_at` datetime NOT NULL,
    `updated_at` datetime NOT NULL,
    FOREIGN KEY(`scene_id`) REFERENCES `scenes`(`id`) ON DELETE CASCADE,
    FOREIGN KEY(`studio_id`) REFERENCES `studios`(`id`) ON DELETE SET NULL
);

-- Index for fast lookups by scene
CREATE INDEX IF NOT EXISTS `idx_scene_releases_scene_id` ON `scene_releases`(`scene_id`);
CREATE INDEX IF NOT EXISTS `idx_scene_releases_studio_id` ON `scene_releases`(`studio_id`);
CREATE INDEX IF NOT EXISTS `idx_scene_releases_date` ON `scene_releases`(`date`);

-- Files associated with releases (mirrors scenes_files pattern)
CREATE TABLE IF NOT EXISTS `scene_release_files` (
    `release_id` integer NOT NULL,
    `file_id` integer NOT NULL,
    `primary` boolean NOT NULL DEFAULT 0,
    PRIMARY KEY(`release_id`, `file_id`),
    FOREIGN KEY(`release_id`) REFERENCES `scene_releases`(`id`) ON DELETE CASCADE,
    FOREIGN KEY(`file_id`) REFERENCES `files`(`id`) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS `idx_scene_release_files_file_id` ON `scene_release_files`(`file_id`);

-- Galleries associated with releases (mirrors scenes_galleries pattern)
CREATE TABLE IF NOT EXISTS `scene_release_galleries` (
    `release_id` integer NOT NULL,
    `gallery_id` integer NOT NULL,
    PRIMARY KEY(`release_id`, `gallery_id`),
    FOREIGN KEY(`release_id`) REFERENCES `scene_releases`(`id`) ON DELETE CASCADE,
    FOREIGN KEY(`gallery_id`) REFERENCES `galleries`(`id`) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS `idx_scene_release_galleries_gallery_id` ON `scene_release_galleries`(`gallery_id`);

CREATE VIEW IF NOT EXISTS scene_all_galleries_custom AS
SELECT scene_id, gallery_id FROM scenes_galleries
UNION
SELECT sr.scene_id, srg.gallery_id FROM scene_release_galleries srg
JOIN scene_releases sr ON sr.id = srg.release_id;

-- Metadata ownership tables are also supplied in scene_releases_metadata_v2.up.sql
-- for existing installations. Run that script after this one on fresh installs.
