-- Create table for storing additional performer images
CREATE TABLE `performer_images` (
    `id` integer NOT NULL PRIMARY KEY AUTOINCREMENT,
    `performer_id` integer NOT NULL,
    `image_blob` varchar(255) NOT NULL REFERENCES `blobs`(`checksum`),
    `position` integer NOT NULL DEFAULT 0,
    FOREIGN KEY (`performer_id`) REFERENCES `performers`(`id`) ON DELETE CASCADE
);

CREATE INDEX `index_performer_images_on_performer_id` on `performer_images` (`performer_id`);
CREATE INDEX `index_performer_images_on_position` on `performer_images` (`performer_id`, `position`);
