CREATE TABLE `performer_scene_tags` (
  `performer_id` integer NOT NULL,
  `scene_id` integer NOT NULL,
  `tag_id` integer NOT NULL,
  foreign key(`performer_id`) references `performers`(`id`) on delete CASCADE,
  foreign key(`scene_id`) references `scenes`(`id`) on delete CASCADE,
  foreign key(`tag_id`) references `tags`(`id`) on delete CASCADE
);

CREATE INDEX `index_performer_scene_tags_on_tag_id` on `performer_scene_tags` (`tag_id`);
CREATE INDEX `index_performer_scene_tags_on_performer_id` on `performer_scene_tags` (`performer_id`);
CREATE INDEX `index_performer_scene_tags_on_scene_id` on `performer_scene_tags` (`scene_id`);


-- Create unique index to prevent duplicate performer-scene-tag entries
CREATE UNIQUE INDEX IF NOT EXISTS performer_scene_tags_unique_idx ON performer_scene_tags (performer_id, scene_id, tag_id);
