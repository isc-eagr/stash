-- CUSTOM: Apply once to existing databases that already have scene_releases.
-- Protect release cover blobs until the release table can be rebuilt with a
-- direct foreign key. SQLite raises a constraint error that BlobStore.Delete
-- already treats as a still-referenced blob.
CREATE TRIGGER scene_releases_cover_blob_guard
BEFORE DELETE ON blobs
FOR EACH ROW
WHEN EXISTS (
    SELECT 1 FROM scene_releases WHERE cover_blob = OLD.checksum
)
BEGIN
    SELECT RAISE(ABORT, 'release cover blob is still referenced');
END;
