-- CUSTOM: allow retroactive O's without a date.
-- Rebuilds scenes_o_dates with a nullable o_date.
-- rowid is copied explicitly so O screenshot files (named by rowid) stay valid.
-- Run after 86_o_video_timestamp.up.sql. If scene releases are installed, also
-- run scene_releases_retroactive_o.up.sql.

PRAGMA foreign_keys=OFF;

BEGIN TRANSACTION;

CREATE TABLE `scenes_o_dates_new` (
  `scene_id` integer not null,
  `o_date` datetime,
  `video_timestamp` REAL,
  foreign key(`scene_id`) references `scenes`(`id`) on delete CASCADE
);

INSERT INTO `scenes_o_dates_new` (`rowid`, `scene_id`, `o_date`, `video_timestamp`)
  SELECT `rowid`, `scene_id`, `o_date`, `video_timestamp` FROM `scenes_o_dates`;

DROP INDEX IF EXISTS `index_scenes_o_dates`;
DROP TABLE `scenes_o_dates`;
ALTER TABLE `scenes_o_dates_new` RENAME TO `scenes_o_dates`;
CREATE INDEX `index_scenes_o_dates` ON `scenes_o_dates` (`scene_id`);

COMMIT;

PRAGMA foreign_keys=ON;
