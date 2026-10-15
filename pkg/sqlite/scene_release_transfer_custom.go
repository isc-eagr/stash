package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

func releaseTransferTableExistsCustom(ctx context.Context, name string) (bool, error) {
	var count int
	if err := dbWrapper.Get(ctx, &count, `SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?`, name); err != nil {
		return false, err
	}
	return count == 1, nil
}

func requireReleaseMetadataUpgradeCustom(ctx context.Context) error {
	for _, table := range []string{
		"scene_release_metadata", "scene_release_urls", "scene_release_performers",
		"scene_release_tags", "scene_release_groups", "scene_release_stash_ids",
		"scene_release_custom_fields", "scene_release_view_dates", "scene_release_o_dates",
	} {
		exists, err := releaseTransferTableExistsCustom(ctx, table)
		if err != nil {
			return err
		}
		if !exists {
			return fmt.Errorf("scene release metadata upgrade required: run scene_releases_metadata_v2.up.sql before converting")
		}
	}
	ratingTablesExist, err := releaseTransferTableExistsCustom(ctx, ratingCriteriaScoresTable)
	if err != nil {
		return err
	}
	if ratingTablesExist {
		ratingUpgraded, err := releaseTransferTableExistsCustom(ctx, "scene_release_rating_upgrade_guard")
		if err != nil {
			return err
		}
		if !ratingUpgraded {
			return fmt.Errorf("scene release rating upgrade required: run scene_releases_rating_v2.up.sql before converting")
		}
	}
	return nil
}

// CheckConversionFileConflictsCustom rejects a conversion or scene merge that
// would make the same file belong to two owners in the target family.
func (qb *SceneReleaseStore) CheckConversionFileConflictsCustom(ctx context.Context, sourceSceneID, targetSceneID int) error {
	return checkSceneFamilyFileConflictsCustom(ctx, sourceSceneID, targetSceneID)
}

func checkSceneFamilyFileConflictsCustom(ctx context.Context, sourceSceneID, targetSceneID int) error {
	const query = `WITH source_files AS (
		SELECT file_id FROM scenes_files WHERE scene_id = ?
		UNION SELECT rf.file_id FROM scene_release_files rf
		JOIN scene_releases r ON r.id = rf.release_id WHERE r.scene_id = ?
	), target_files AS (
		SELECT file_id FROM scenes_files WHERE scene_id = ?
		UNION SELECT rf.file_id FROM scene_release_files rf
		JOIN scene_releases r ON r.id = rf.release_id WHERE r.scene_id = ?
	)
	SELECT source_files.file_id FROM source_files JOIN target_files USING(file_id) LIMIT 1`
	var fileID int
	if err := dbWrapper.Get(ctx, &fileID, query, sourceSceneID, sourceSceneID, targetSceneID, targetSceneID); err != nil {
		// sqlx.Get returns sql.ErrNoRows for a clean family merge.
		if errors.Is(err, sql.ErrNoRows) {
			return nil
		}
		return err
	}
	return fmt.Errorf("file %d already belongs to the target scene family", fileID)
}

// updateFirstURLCustom keeps the compatibility URL field in sync with the
// ordered URL collection without replacing additional URLs.
func (qb *SceneReleaseStore) updateFirstURLCustom(ctx context.Context, releaseID int, value string) error {
	exists, err := releaseTransferTableExistsCustom(ctx, "scene_release_urls")
	if err != nil || !exists {
		return err
	}
	var firstPosition *int
	if err := dbWrapper.Get(ctx, &firstPosition,
		`SELECT MIN(position) FROM scene_release_urls WHERE release_id = ?`, releaseID); err != nil {
		return err
	}
	position := 0
	if firstPosition != nil {
		position = *firstPosition
		if _, err := dbWrapper.Exec(ctx,
			`DELETE FROM scene_release_urls WHERE release_id = ? AND position = ?`, releaseID, position); err != nil {
			return err
		}
	}
	if value != "" {
		_, err = dbWrapper.Exec(ctx,
			`INSERT INTO scene_release_urls(release_id,position,url) VALUES (?,?,?)`, releaseID, position, value)
	}
	return err
}

// ensureSceneHasNoUnownedReleaseActivityCustom prevents conversion before the
// one-time owner upgrade when the source has marker or loop records.
func ensureSceneHasNoUnownedReleaseActivityCustom(ctx context.Context, sceneID int) error {
	upgraded, err := releaseTransferTableExistsCustom(ctx, "scene_release_activity_upgrade_guard")
	if err != nil {
		return err
	}
	for _, entry := range []struct{ table, label string }{
		{"scene_markers", "markers"},
		{"scene_negative_markers", "negative markers"},
		{"scene_multi_segment_loop_presets", "loop presets"},
	} {
		exists, err := releaseTransferTableExistsCustom(ctx, entry.table)
		if err != nil {
			return err
		}
		if !exists {
			continue
		}
		var count int
		query := fmt.Sprintf(`SELECT COUNT(*) FROM %s WHERE scene_id = ?`, entry.table)
		if err := dbWrapper.Get(ctx, &count, query, sceneID); err != nil {
			return err
		}
		if count > 0 && !upgraded {
			return fmt.Errorf("cannot convert scene %d with %d %s: run scene_releases_activity_v2.up.sql first", sceneID, count, entry.label)
		}
	}
	return nil
}

// copyStashDBMatchesCustom carries the StashDB count with the Stash IDs it
// belongs to, when both owners have a matches table.
func copyStashDBMatchesCustom(ctx context.Context, query string, toID, fromID int) error {
	ready, err := releaseStashDBMatchesReadyCustom(ctx)
	if err != nil || !ready {
		return err
	}
	if exists, err := releaseTransferTableExistsCustom(ctx, sceneStashDBMatchesTableCustom); err != nil || !exists {
		return err
	}
	_, err = dbWrapper.Exec(ctx, query, toID, fromID)
	return err
}

// TransferSceneMetadataToReleaseCustom moves all supported scene-owned data
// before the source scene row is deleted. Ratings stay with scenes: the caller
// copies or drops the source's. The caller owns the transaction.
func (qb *SceneReleaseStore) TransferSceneMetadataToReleaseCustom(ctx context.Context, sceneID, releaseID int) error {
	if err := requireReleaseMetadataUpgradeCustom(ctx); err != nil {
		return err
	}
	if err := ensureSceneHasNoUnownedReleaseActivityCustom(ctx, sceneID); err != nil {
		return err
	}
	statements := []string{
		`INSERT INTO scene_release_metadata(release_id,organized,resume_time,play_duration)
		 SELECT ?,organized,resume_time,play_duration FROM scenes WHERE id = ?`,
		`INSERT INTO scene_release_urls(release_id,position,url)
		 SELECT ?,position,url FROM scene_urls WHERE scene_id = ?`,
		`INSERT INTO scene_release_performers(release_id,performer_id)
		 SELECT ?,performer_id FROM performers_scenes WHERE scene_id = ?`,
		`INSERT INTO scene_release_tags(release_id,tag_id)
		 SELECT ?,tag_id FROM scenes_tags WHERE scene_id = ?`,
		`INSERT INTO scene_release_groups(release_id,group_id,scene_index)
		 SELECT ?,group_id,scene_index FROM groups_scenes WHERE scene_id = ?`,
		`INSERT INTO scene_release_stash_ids(release_id,endpoint,stash_id,updated_at)
		 SELECT ?,endpoint,stash_id,updated_at FROM scene_stash_ids WHERE scene_id = ?`,
		`INSERT INTO scene_release_custom_fields(release_id,field,value)
		 SELECT ?,field,value FROM scene_custom_fields WHERE scene_id = ?`,
		`INSERT INTO scene_release_view_dates(release_id,view_date)
		 SELECT ?,view_date FROM scenes_view_dates WHERE scene_id = ?`,
		`INSERT INTO scene_release_o_dates(release_id,o_date,video_timestamp)
		 SELECT ?,o_date,video_timestamp FROM scenes_o_dates WHERE scene_id = ?`,
	}
	for _, statement := range statements {
		if _, err := dbWrapper.Exec(ctx, statement, releaseID, sceneID); err != nil {
			return fmt.Errorf("transferring scene metadata: %w", err)
		}
	}
	if err := copyStashDBMatchesCustom(ctx,
		`INSERT INTO scene_release_stashdb_matches(release_id,matches) SELECT ?,matches FROM scene_stashdb_matches WHERE scene_id = ?`,
		releaseID, sceneID); err != nil {
		return fmt.Errorf("transferring StashDB matches: %w", err)
	}
	upgraded, err := releaseTransferTableExistsCustom(ctx, "scene_release_activity_upgrade_guard")
	if err != nil {
		return err
	}
	if upgraded {
		for _, table := range []string{"scene_markers", "scene_negative_markers", "scene_multi_segment_loop_presets"} {
			query := fmt.Sprintf(`UPDATE %s SET scene_id = NULL, release_id = ? WHERE scene_id = ?`, table)
			if _, err := dbWrapper.Exec(ctx, query, releaseID, sceneID); err != nil {
				return fmt.Errorf("transferring release activity: %w", err)
			}
		}
	}
	return nil
}

// CopyRatingFromSceneCustom replaces the target scene's rating and Rating
// Advisor answers with copies of the source scene's.
func (qb *SceneReleaseStore) CopyRatingFromSceneCustom(ctx context.Context, sourceSceneID, targetSceneID int) error {
	if _, err := dbWrapper.Exec(ctx, `UPDATE scenes SET rating = (SELECT rating FROM scenes WHERE id = ?) WHERE id = ?`,
		sourceSceneID, targetSceneID); err != nil {
		return fmt.Errorf("copying scene rating: %w", err)
	}
	for _, table := range ratingScoreTables {
		exists, err := releaseTransferTableExistsCustom(ctx, table.table)
		if err != nil {
			return err
		}
		if !exists {
			continue
		}
		if _, err := dbWrapper.Exec(ctx, fmt.Sprintf(`DELETE FROM %s WHERE entity_type = 'scene' AND entity_id = ?`, table.table), targetSceneID); err != nil {
			return fmt.Errorf("clearing %s advisor scores: %w", table.section, err)
		}
		if _, err := dbWrapper.Exec(ctx, fmt.Sprintf(`INSERT INTO %[1]s(entity_type,entity_id,key,raw_value,weighted_value,label,created_at,updated_at)
			SELECT 'scene',?,key,raw_value,weighted_value,label,created_at,updated_at FROM %[1]s
			WHERE entity_type = 'scene' AND entity_id = ?`, table.table), targetSceneID, sourceSceneID); err != nil {
			return fmt.Errorf("copying %s advisor scores: %w", table.section, err)
		}
	}
	return nil
}

// CopyMarkersToSceneCustom gives the scene a new copy of each release marker,
// with its tags and performers; the release keeps its own.
func (qb *SceneReleaseStore) CopyMarkersToSceneCustom(ctx context.Context, releaseID, sceneID int) error {
	var markerIDs []int
	if err := dbWrapper.Select(ctx, &markerIDs, `SELECT id FROM scene_markers WHERE release_id = ? ORDER BY id`, releaseID); err != nil {
		return fmt.Errorf("finding release markers: %w", err)
	}
	if len(markerIDs) == 0 {
		return nil
	}
	hasPerformers, err := releaseTransferTableExistsCustom(ctx, "scene_marker_performers")
	if err != nil {
		return err
	}
	now := time.Now()
	for _, markerID := range markerIDs {
		result, err := dbWrapper.Exec(ctx, `INSERT INTO scene_markers(title,seconds,end_seconds,primary_tag_id,scene_id,created_at,updated_at)
			SELECT title,seconds,end_seconds,primary_tag_id,?,?,? FROM scene_markers WHERE id = ?`, sceneID, now, now, markerID)
		if err != nil {
			return fmt.Errorf("copying marker %d: %w", markerID, err)
		}
		copyID, err := result.LastInsertId()
		if err != nil {
			return err
		}
		if _, err := dbWrapper.Exec(ctx, `INSERT INTO scene_markers_tags(scene_marker_id,tag_id)
			SELECT ?,tag_id FROM scene_markers_tags WHERE scene_marker_id = ?`, copyID, markerID); err != nil {
			return fmt.Errorf("copying marker %d tags: %w", markerID, err)
		}
		if hasPerformers {
			if _, err := dbWrapper.Exec(ctx, `INSERT INTO scene_marker_performers(scene_marker_id,performer_id,role)
				SELECT ?,performer_id,role FROM scene_marker_performers WHERE scene_marker_id = ?`, copyID, markerID); err != nil {
				return fmt.Errorf("copying marker %d performers: %w", markerID, err)
			}
		}
	}
	return nil
}

// TransferReleaseMetadataToSceneCustom restores only the selected release's
// data; it never changes metadata on the parent scene. The caller gives the
// new scene its rating, which releases inherit from their parent.
func (qb *SceneReleaseStore) TransferReleaseMetadataToSceneCustom(ctx context.Context, releaseID, sceneID int) error {
	if err := requireReleaseMetadataUpgradeCustom(ctx); err != nil {
		return err
	}
	if _, err := dbWrapper.Exec(ctx, `UPDATE scenes SET
		organized = COALESCE((SELECT organized FROM scene_release_metadata WHERE release_id = ?), 0),
		resume_time = COALESCE((SELECT resume_time FROM scene_release_metadata WHERE release_id = ?), 0),
		play_duration = COALESCE((SELECT play_duration FROM scene_release_metadata WHERE release_id = ?), 0)
		WHERE id = ?`, releaseID, releaseID, releaseID, sceneID); err != nil {
		return err
	}
	var urlCount int
	if err := dbWrapper.Get(ctx, &urlCount, `SELECT COUNT(*) FROM scene_release_urls WHERE release_id = ?`, releaseID); err != nil {
		return err
	}
	if urlCount > 0 {
		if _, err := dbWrapper.Exec(ctx, `DELETE FROM scene_urls WHERE scene_id = ?`, sceneID); err != nil {
			return err
		}
		if _, err := dbWrapper.Exec(ctx, `INSERT INTO scene_urls(scene_id,position,url)
			SELECT ?,position,url FROM scene_release_urls WHERE release_id = ?`, sceneID, releaseID); err != nil {
			return err
		}
	}
	statements := []string{
		`INSERT INTO performers_scenes(scene_id,performer_id)
		 SELECT ?,performer_id FROM scene_release_performers WHERE release_id = ?`,
		`INSERT INTO scenes_tags(scene_id,tag_id)
		 SELECT ?,tag_id FROM scene_release_tags WHERE release_id = ?`,
		`INSERT INTO groups_scenes(scene_id,group_id,scene_index)
		 SELECT ?,group_id,scene_index FROM scene_release_groups WHERE release_id = ?`,
		`INSERT INTO scene_stash_ids(scene_id,endpoint,stash_id,updated_at)
		 SELECT ?,endpoint,stash_id,updated_at FROM scene_release_stash_ids WHERE release_id = ?`,
		`INSERT INTO scene_custom_fields(scene_id,field,value)
		 SELECT ?,field,value FROM scene_release_custom_fields WHERE release_id = ?`,
		`INSERT INTO scenes_view_dates(scene_id,view_date)
		 SELECT ?,view_date FROM scene_release_view_dates WHERE release_id = ?`,
		`INSERT INTO scenes_o_dates(scene_id,o_date,video_timestamp)
		 SELECT ?,o_date,video_timestamp FROM scene_release_o_dates WHERE release_id = ?`,
	}
	for _, statement := range statements {
		if _, err := dbWrapper.Exec(ctx, statement, sceneID, releaseID); err != nil {
			return fmt.Errorf("restoring release metadata: %w", err)
		}
	}
	if err := copyStashDBMatchesCustom(ctx,
		`INSERT INTO scene_stashdb_matches(scene_id,matches) SELECT ?,matches FROM scene_release_stashdb_matches WHERE release_id = ?`,
		sceneID, releaseID); err != nil {
		return fmt.Errorf("restoring StashDB matches: %w", err)
	}
	upgraded, err := releaseTransferTableExistsCustom(ctx, "scene_release_activity_upgrade_guard")
	if err != nil {
		return err
	}
	if upgraded {
		for _, table := range []string{"scene_markers", "scene_negative_markers", "scene_multi_segment_loop_presets"} {
			query := fmt.Sprintf(`UPDATE %s SET release_id = NULL, scene_id = ? WHERE release_id = ?`, table)
			if _, err := dbWrapper.Exec(ctx, query, sceneID, releaseID); err != nil {
				return fmt.Errorf("restoring release activity: %w", err)
			}
		}
	}
	return nil
}
