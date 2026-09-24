package sqlite

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/stashapp/stash/pkg/models"
)

func (qb *SceneReleaseStore) GetMarkersCustom(ctx context.Context, releaseID int) ([]*models.SceneMarker, error) {
	upgraded, err := releaseTransferTableExistsCustom(ctx, "scene_release_activity_upgrade_guard")
	if err != nil || !upgraded {
		return nil, err
	}
	var rows []sceneMarkerRow
	if err := dbWrapper.Select(ctx, &rows,
		`SELECT * FROM scene_markers WHERE release_id = ? ORDER BY seconds,id`, releaseID); err != nil {
		return nil, err
	}
	ret := make([]*models.SceneMarker, len(rows))
	for i := range rows {
		ret[i] = rows[i].resolve()
	}
	return ret, nil
}

func (qb *SceneReleaseStore) SaveNegativeMarkerCustom(ctx context.Context, releaseID int, marker *models.SceneNegativeMarker) error {
	upgraded, err := releaseTransferTableExistsCustom(ctx, "scene_release_activity_upgrade_guard")
	if err != nil {
		return err
	}
	if !upgraded {
		return fmt.Errorf("scene release activity upgrade required")
	}
	if marker.ID == 0 {
		result, err := dbWrapper.Exec(ctx, `INSERT INTO scene_negative_markers (scene_id,release_id,name,start_seconds,end_seconds,created_at,updated_at) VALUES (NULL,?,?,?,?,?,?)`, releaseID, marker.Name, marker.StartSeconds, marker.EndSeconds, time.Now(), time.Now())
		if err != nil {
			return err
		}
		id, err := result.LastInsertId()
		if err != nil {
			return err
		}
		marker.ID = int(id)
	} else {
		result, err := dbWrapper.Exec(ctx, `UPDATE scene_negative_markers SET name=?,start_seconds=?,end_seconds=?,updated_at=? WHERE id=? AND release_id=?`, marker.Name, marker.StartSeconds, marker.EndSeconds, time.Now(), marker.ID, releaseID)
		if err != nil {
			return err
		}
		changed, err := result.RowsAffected()
		if err != nil {
			return err
		}
		if changed != 1 {
			return fmt.Errorf("negative marker %d does not belong to release %d", marker.ID, releaseID)
		}
	}
	var row sceneNegativeMarkerRow
	if err := dbWrapper.Get(ctx, &row, `SELECT * FROM scene_negative_markers WHERE id=? AND release_id=?`, marker.ID, releaseID); err != nil {
		return err
	}
	*marker = *row.resolve()
	return nil
}

func (qb *SceneReleaseStore) DeleteNegativeMarkerCustom(ctx context.Context, releaseID, markerID int) error {
	result, err := dbWrapper.Exec(ctx, `DELETE FROM scene_negative_markers WHERE id=? AND release_id=?`, markerID, releaseID)
	if err != nil {
		return err
	}
	changed, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if changed != 1 {
		return fmt.Errorf("negative marker %d does not belong to release %d", markerID, releaseID)
	}
	return nil
}

func (qb *SceneReleaseStore) SaveLoopPresetCustom(ctx context.Context, releaseID int, preset *models.SceneLoopPreset) error {
	upgraded, err := releaseTransferTableExistsCustom(ctx, "scene_release_activity_upgrade_guard")
	if err != nil {
		return err
	}
	if !upgraded {
		return fmt.Errorf("scene release activity upgrade required")
	}
	segments, err := json.Marshal(preset.Segments)
	if err != nil {
		return err
	}
	var existingID int
	err = dbWrapper.Get(ctx, &existingID, `SELECT id FROM scene_multi_segment_loop_presets WHERE release_id=? AND name=?`, releaseID, preset.Name)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if existingID == 0 {
		result, err := dbWrapper.Exec(ctx, `INSERT INTO scene_multi_segment_loop_presets (scene_id,release_id,name,segments,enabled,current_segment_index,created_at,updated_at) VALUES (NULL,?,?,?,?,?,?,?)`, releaseID, preset.Name, string(segments), preset.Enabled, preset.CurrentSegmentIndex, time.Now(), time.Now())
		if err != nil {
			return err
		}
		id, err := result.LastInsertId()
		if err != nil {
			return err
		}
		preset.ID = int(id)
	} else {
		preset.ID = existingID
		if _, err := dbWrapper.Exec(ctx, `UPDATE scene_multi_segment_loop_presets SET segments=?,enabled=?,current_segment_index=?,updated_at=? WHERE id=? AND release_id=?`, string(segments), preset.Enabled, preset.CurrentSegmentIndex, time.Now(), existingID, releaseID); err != nil {
			return err
		}
	}
	var row sceneLoopPresetRow
	if err := dbWrapper.Get(ctx, &row, `SELECT * FROM scene_multi_segment_loop_presets WHERE id=? AND release_id=?`, preset.ID, releaseID); err != nil {
		return err
	}
	*preset = *row.resolve()
	return nil
}

func (qb *SceneReleaseStore) DeleteLoopPresetCustom(ctx context.Context, releaseID int, name string) error {
	result, err := dbWrapper.Exec(ctx, `DELETE FROM scene_multi_segment_loop_presets WHERE release_id=? AND name=?`, releaseID, name)
	if err != nil {
		return err
	}
	changed, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if changed != 1 {
		return fmt.Errorf("loop preset %q does not belong to release %d", name, releaseID)
	}
	return nil
}

func (qb *SceneReleaseStore) MoveMarkerToReleaseCustom(ctx context.Context, markerID, releaseID int) error {
	upgraded, err := releaseTransferTableExistsCustom(ctx, "scene_release_activity_upgrade_guard")
	if err != nil {
		return err
	}
	if !upgraded {
		return fmt.Errorf("scene release activity upgrade required")
	}
	result, err := dbWrapper.Exec(ctx, `UPDATE scene_markers SET scene_id=NULL, release_id=? WHERE id=?`, releaseID, markerID)
	if err != nil {
		return err
	}
	changed, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if changed != 1 {
		return fmt.Errorf("scene marker %d not found", markerID)
	}
	return nil
}

func (qb *SceneReleaseStore) GetNegativeMarkersCustom(ctx context.Context, releaseID int) ([]*models.SceneNegativeMarker, error) {
	upgraded, err := releaseTransferTableExistsCustom(ctx, "scene_release_activity_upgrade_guard")
	if err != nil || !upgraded {
		return nil, err
	}
	var rows []sceneNegativeMarkerRow
	if err := dbWrapper.Select(ctx, &rows,
		`SELECT * FROM scene_negative_markers WHERE release_id = ? ORDER BY start_seconds,id`, releaseID); err != nil {
		return nil, err
	}
	ret := make([]*models.SceneNegativeMarker, len(rows))
	for i := range rows {
		ret[i] = rows[i].resolve()
	}
	return ret, nil
}

func (qb *SceneReleaseStore) GetLoopPresetsCustom(ctx context.Context, releaseID int) ([]*models.SceneLoopPreset, error) {
	upgraded, err := releaseTransferTableExistsCustom(ctx, "scene_release_activity_upgrade_guard")
	if err != nil || !upgraded {
		return nil, err
	}
	var rows []sceneLoopPresetRow
	if err := dbWrapper.Select(ctx, &rows,
		`SELECT * FROM scene_multi_segment_loop_presets WHERE release_id = ? ORDER BY name,id`, releaseID); err != nil {
		return nil, err
	}
	ret := make([]*models.SceneLoopPreset, len(rows))
	for i := range rows {
		ret[i] = rows[i].resolve()
	}
	return ret, nil
}
