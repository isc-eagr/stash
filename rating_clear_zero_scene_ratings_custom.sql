-- A stored zero is not a real scene rating. Normalize it to the same NULL
-- no-rating state used by scenes that have never been rated.

BEGIN IMMEDIATE;

UPDATE scenes
SET rating = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE rating = 0;

COMMIT;
