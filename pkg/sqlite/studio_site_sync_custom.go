package sqlite

// CUSTOM: Queries for the studio site sync task.

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/stashapp/stash/pkg/models"
)

type StudioSiteSyncStoreCustom struct{}

// Scenes lists the studio's scenes with their primary file, ordered by ID.
func (StudioSiteSyncStoreCustom) Scenes(ctx context.Context, studioID int) ([]models.SiteSyncSceneCustom, error) {
	var ret []models.SiteSyncSceneCustom
	if err := dbWrapper.Select(ctx, &ret, `
SELECT s.id,
       COALESCE(s.title, '') AS title,
       COALESCE(s.code, '') AS code,
       COALESCE(s.date, '') AS date,
       COALESCE(s.details, '') AS details,
       f.basename,
       f.size,
       EXISTS(SELECT 1 FROM scenes_galleries sg WHERE sg.scene_id = s.id) AS has_gallery,
       EXISTS(SELECT 1 FROM scenes_tags st JOIN tags t ON t.id = st.tag_id
               WHERE st.scene_id = s.id AND LOWER(t.name) = 'postpone') AS postponed
  FROM scenes s
  JOIN scenes_files sf ON sf.scene_id = s.id AND sf."primary" = 1
  JOIN files f ON f.id = sf.file_id
 WHERE s.studio_id = ?
 ORDER BY s.id`, studioID); err != nil {
		return nil, fmt.Errorf("listing studio %d scenes: %w", studioID, err)
	}

	var urls []struct {
		SceneID int    `db:"scene_id"`
		URL     string `db:"url"`
	}
	if err := dbWrapper.Select(ctx, &urls, `
SELECT su.scene_id, su.url
  FROM scene_urls su
  JOIN scenes s ON s.id = su.scene_id
 WHERE s.studio_id = ?
 ORDER BY su.scene_id, su.position`, studioID); err != nil {
		return nil, fmt.Errorf("listing studio %d scene urls: %w", studioID, err)
	}
	index := make(map[int]int, len(ret))
	for i, s := range ret {
		index[s.ID] = i
	}
	for _, u := range urls {
		if i, ok := index[u.SceneID]; ok {
			ret[i].URLs = append(ret[i].URLs, u.URL)
		}
	}
	return ret, nil
}

// FolderID finds a folder by path ignoring case; found is false when Stash
// has not scanned it.
func (StudioSiteSyncStoreCustom) FolderID(ctx context.Context, path string) (id int, found bool, err error) {
	err = dbWrapper.Get(ctx, &id, `SELECT id FROM folders WHERE LOWER(path) = LOWER(?) LIMIT 1`, path)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, false, nil
	}
	return id, err == nil, err
}

// ChildFolderImageIDs lists the images inside the named child of parentID and
// its subfolders (zips extracted into a folder of their own name), ordered by
// file name; none when that folder is unknown.
func (StudioSiteSyncStoreCustom) ChildFolderImageIDs(ctx context.Context, parentID int, basename string) ([]int, error) {
	var ids []int
	err := dbWrapper.Select(ctx, &ids, `
WITH RECURSIVE tree(id) AS (
  SELECT id FROM folders WHERE parent_folder_id = ? AND basename = ? COLLATE NOCASE
  UNION
  SELECT fo.id FROM folders fo JOIN tree ON fo.parent_folder_id = tree.id
)
SELECT ifl.image_id
  FROM tree
  JOIN files f ON f.parent_folder_id = tree.id
  JOIN images_files ifl ON ifl.file_id = f.id
 GROUP BY ifl.image_id
 ORDER BY MIN(f.basename)`, parentID, basename)
	return ids, err
}

// SetImagesStudio assigns studioID to the images that have no studio.
func (StudioSiteSyncStoreCustom) SetImagesStudio(ctx context.Context, imageIDs []int, studioID int) error {
	now := time.Now()
	return batchExec(imageIDs, 500, func(batch []int) error {
		args := []interface{}{studioID, now}
		for _, id := range batch {
			args = append(args, id)
		}
		if _, err := dbWrapper.Exec(ctx, `
UPDATE images SET studio_id = ?, updated_at = ?
 WHERE studio_id IS NULL AND id IN (`+strings.TrimSuffix(strings.Repeat("?,", len(batch)), ",")+`)`, args...); err != nil {
			return fmt.Errorf("setting image studio: %w", err)
		}
		return nil
	})
}
