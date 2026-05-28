-- Add video_timestamp column to scenes_o_dates to record where in the video the O happened.
-- This is nullable; existing records and O entries added without a video context will have NULL.
ALTER TABLE scenes_o_dates ADD COLUMN video_timestamp REAL;
