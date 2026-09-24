package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/doug-martin/goqu/v9"
	"github.com/stashapp/stash/pkg/models"
)

func (qb *SceneReleaseStore) UpdateExtendedCustom(ctx context.Context, releaseID int, update models.SceneReleaseExtendedUpdateCustom) error {
	if err := requireReleaseMetadataUpgradeCustom(ctx); err != nil {
		return err
	}
	if update.RatingSet || update.OrganizedSet {
		if _, err := dbWrapper.Exec(ctx,
			`INSERT OR IGNORE INTO scene_release_metadata(release_id) VALUES (?)`, releaseID); err != nil {
			return err
		}
	}
	if update.RatingSet {
		if _, err := dbWrapper.Exec(ctx,
			`UPDATE scene_release_metadata SET rating = ? WHERE release_id = ?`, update.Rating, releaseID); err != nil {
			return err
		}
	}
	if update.OrganizedSet {
		if _, err := dbWrapper.Exec(ctx,
			`UPDATE scene_release_metadata SET organized = ? WHERE release_id = ?`, update.Organized, releaseID); err != nil {
			return err
		}
	}
	if update.URLsSet {
		if _, err := dbWrapper.Exec(ctx, `DELETE FROM scene_release_urls WHERE release_id = ?`, releaseID); err != nil {
			return err
		}
		for position, url := range update.URLs {
			if url == "" {
				return fmt.Errorf("release URL %d cannot be empty", position+1)
			}
			if _, err := dbWrapper.Exec(ctx,
				`INSERT INTO scene_release_urls(release_id,position,url) VALUES (?,?,?)`, releaseID, position, url); err != nil {
				return err
			}
		}
		first := ""
		if len(update.URLs) > 0 {
			first = update.URLs[0]
		}
		if _, err := dbWrapper.Exec(ctx, `UPDATE scene_releases SET url = ? WHERE id = ?`, first, releaseID); err != nil {
			return err
		}
	}
	if update.PerformerIDsSet {
		if _, err := dbWrapper.Exec(ctx, `DELETE FROM scene_release_performers WHERE release_id = ?`, releaseID); err != nil {
			return err
		}
		for _, performerID := range update.PerformerIDs {
			if _, err := dbWrapper.Exec(ctx,
				`INSERT OR IGNORE INTO scene_release_performers(release_id,performer_id) VALUES (?,?)`, releaseID, performerID); err != nil {
				return err
			}
		}
	}
	if update.TagIDsSet {
		if _, err := dbWrapper.Exec(ctx, `DELETE FROM scene_release_tags WHERE release_id = ?`, releaseID); err != nil {
			return err
		}
		for _, tagID := range update.TagIDs {
			if _, err := dbWrapper.Exec(ctx,
				`INSERT OR IGNORE INTO scene_release_tags(release_id,tag_id) VALUES (?,?)`, releaseID, tagID); err != nil {
				return err
			}
		}
	}
	if update.GroupsSet {
		if _, err := dbWrapper.Exec(ctx, `DELETE FROM scene_release_groups WHERE release_id = ?`, releaseID); err != nil {
			return err
		}
		for _, group := range update.Groups {
			if _, err := dbWrapper.Exec(ctx,
				`INSERT INTO scene_release_groups(release_id,group_id,scene_index) VALUES (?,?,?)`,
				releaseID, group.GroupID, group.SceneIndex); err != nil {
				return err
			}
		}
	}
	if update.StashIDsSet {
		if _, err := dbWrapper.Exec(ctx, `DELETE FROM scene_release_stash_ids WHERE release_id = ?`, releaseID); err != nil {
			return err
		}
		for _, stashID := range update.StashIDs {
			if stashID.Endpoint == "" || stashID.StashID == "" {
				return fmt.Errorf("release Stash ID endpoint and ID cannot be empty")
			}
			if _, err := dbWrapper.Exec(ctx,
				`INSERT OR IGNORE INTO scene_release_stash_ids(release_id,endpoint,stash_id,updated_at) VALUES (?,?,?,?)`,
				releaseID, stashID.Endpoint, stashID.StashID, stashID.UpdatedAt); err != nil {
				return err
			}
		}
	}
	if update.CustomFields != nil {
		store := customFieldsStore{
			table: goqu.T("scene_release_custom_fields"),
			fk:    goqu.T("scene_release_custom_fields").Col("release_id"),
		}
		if err := store.SetCustomFields(ctx, releaseID, *update.CustomFields); err != nil {
			return err
		}
	}
	return nil
}

func (qb *SceneReleaseStore) GetMetadataCustom(ctx context.Context, releaseID int) (models.SceneReleaseMetadataCustom, error) {
	var ret models.SceneReleaseMetadataCustom
	exists, err := releaseTransferTableExistsCustom(ctx, "scene_release_metadata")
	if err != nil || !exists {
		return ret, err
	}
	var row struct {
		Rating       sql.NullInt64 `db:"rating"`
		Organized    bool          `db:"organized"`
		ResumeTime   float64       `db:"resume_time"`
		PlayDuration float64       `db:"play_duration"`
	}
	if err := dbWrapper.Get(ctx, &row,
		`SELECT rating,organized,resume_time,play_duration FROM scene_release_metadata WHERE release_id = ?`, releaseID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ret, nil
		}
		return ret, err
	}
	if row.Rating.Valid {
		rating := int(row.Rating.Int64)
		ret.Rating = &rating
	}
	ret.Organized = row.Organized
	ret.ResumeTime = row.ResumeTime
	ret.PlayDuration = row.PlayDuration
	return ret, nil
}

func (qb *SceneReleaseStore) GetURLsCustom(ctx context.Context, releaseID int) ([]string, error) {
	exists, err := releaseTransferTableExistsCustom(ctx, "scene_release_urls")
	if err != nil || !exists {
		return nil, err
	}
	var urls []string
	err = dbWrapper.Select(ctx, &urls,
		`SELECT url FROM scene_release_urls WHERE release_id = ? ORDER BY position,url`, releaseID)
	return urls, err
}

func (qb *SceneReleaseStore) GetPerformerIDsCustom(ctx context.Context, releaseID int) ([]int, error) {
	exists, err := releaseTransferTableExistsCustom(ctx, "scene_release_performers")
	if err != nil || !exists {
		return nil, err
	}
	var ids []int
	err = dbWrapper.Select(ctx, &ids,
		`SELECT performer_id FROM scene_release_performers WHERE release_id = ? ORDER BY performer_id`, releaseID)
	return ids, err
}

func (qb *SceneReleaseStore) GetTagIDsCustom(ctx context.Context, releaseID int) ([]int, error) {
	exists, err := releaseTransferTableExistsCustom(ctx, "scene_release_tags")
	if err != nil || !exists {
		return nil, err
	}
	var ids []int
	err = dbWrapper.Select(ctx, &ids,
		`SELECT tag_id FROM scene_release_tags WHERE release_id = ? ORDER BY tag_id`, releaseID)
	return ids, err
}

func (qb *SceneReleaseStore) GetGroupsCustom(ctx context.Context, releaseID int) ([]models.GroupsScenes, error) {
	exists, err := releaseTransferTableExistsCustom(ctx, "scene_release_groups")
	if err != nil || !exists {
		return nil, err
	}
	var rows []struct {
		GroupID    int            `db:"group_id"`
		SceneIndex sql.NullString `db:"scene_index"`
	}
	if err := dbWrapper.Select(ctx, &rows,
		`SELECT group_id,scene_index FROM scene_release_groups WHERE release_id = ? ORDER BY group_id`, releaseID); err != nil {
		return nil, err
	}
	ret := make([]models.GroupsScenes, len(rows))
	for i, row := range rows {
		ret[i].GroupID = row.GroupID
		if row.SceneIndex.Valid && row.SceneIndex.String != "" {
			idx, err := strconv.Atoi(row.SceneIndex.String)
			if err != nil {
				return nil, fmt.Errorf("invalid release group index %q: %w", row.SceneIndex.String, err)
			}
			ret[i].SceneIndex = &idx
		}
	}
	return ret, nil
}

func (qb *SceneReleaseStore) GetStashIDsCustom(ctx context.Context, releaseID int) ([]models.StashID, error) {
	exists, err := releaseTransferTableExistsCustom(ctx, "scene_release_stash_ids")
	if err != nil || !exists {
		return nil, err
	}
	var ids []models.StashID
	err = dbWrapper.Select(ctx, &ids,
		`SELECT endpoint,stash_id,updated_at FROM scene_release_stash_ids WHERE release_id = ? ORDER BY endpoint,stash_id`, releaseID)
	return ids, err
}

func (qb *SceneReleaseStore) GetCustomFieldsCustom(ctx context.Context, releaseID int) (map[string]interface{}, error) {
	exists, err := releaseTransferTableExistsCustom(ctx, "scene_release_custom_fields")
	if err != nil || !exists {
		return map[string]interface{}{}, err
	}
	store := customFieldsStore{
		table: goqu.T("scene_release_custom_fields"),
		fk:    goqu.T("scene_release_custom_fields").Col("release_id"),
	}
	return store.GetCustomFields(ctx, releaseID)
}

func (qb *SceneReleaseStore) GetViewHistoryCustom(ctx context.Context, releaseID int) ([]time.Time, error) {
	exists, err := releaseTransferTableExistsCustom(ctx, "scene_release_view_dates")
	if err != nil || !exists {
		return nil, err
	}
	var dates []time.Time
	err = dbWrapper.Select(ctx, &dates,
		`SELECT view_date FROM scene_release_view_dates WHERE release_id = ? ORDER BY view_date DESC,rowid DESC`, releaseID)
	return dates, err
}

func (qb *SceneReleaseStore) GetOHistoryCustom(ctx context.Context, releaseID int) ([]time.Time, error) {
	exists, err := releaseTransferTableExistsCustom(ctx, "scene_release_o_dates")
	if err != nil || !exists {
		return nil, err
	}
	var dates []time.Time
	err = dbWrapper.Select(ctx, &dates,
		`SELECT o_date FROM scene_release_o_dates WHERE release_id = ? ORDER BY o_date DESC,rowid DESC`, releaseID)
	return dates, err
}

func (qb *SceneReleaseStore) GetOVideoTimestampsCustom(ctx context.Context, releaseID int) ([]*float64, error) {
	exists, err := releaseTransferTableExistsCustom(ctx, "scene_release_o_dates")
	if err != nil || !exists {
		return nil, err
	}
	var timestamps []*float64
	err = dbWrapper.Select(ctx, &timestamps,
		`SELECT video_timestamp FROM scene_release_o_dates WHERE release_id = ? ORDER BY o_date DESC,rowid DESC`, releaseID)
	return timestamps, err
}
