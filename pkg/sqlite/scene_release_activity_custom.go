package sqlite

import (
	"context"
	"fmt"
	"math"
	"time"
)

// SaveActivityCustom records playback against the release, never its parent scene.
func (qb *SceneReleaseStore) SaveActivityCustom(ctx context.Context, releaseID int, resumeTime, playDuration *float64) error {
	if err := requireReleaseMetadataUpgradeCustom(ctx); err != nil {
		return err
	}
	if err := qb.requireReleaseCustom(ctx, releaseID); err != nil {
		return err
	}
	for _, value := range []*float64{resumeTime, playDuration} {
		if value != nil && (math.IsNaN(*value) || math.IsInf(*value, 0) || *value < 0) {
			return fmt.Errorf("playback activity must be finite and non-negative")
		}
	}
	if _, err := dbWrapper.Exec(ctx, `INSERT OR IGNORE INTO scene_release_metadata(release_id) VALUES (?)`, releaseID); err != nil {
		return err
	}
	_, err := dbWrapper.Exec(ctx, `UPDATE scene_release_metadata SET
		resume_time = COALESCE(?,resume_time),
		play_duration = play_duration + COALESCE(?,0)
		WHERE release_id = ?`, resumeTime, playDuration, releaseID)
	return err
}

func (qb *SceneReleaseStore) AddPlayCustom(ctx context.Context, releaseID int) (int, error) {
	if err := requireReleaseMetadataUpgradeCustom(ctx); err != nil {
		return 0, err
	}
	if err := qb.requireReleaseCustom(ctx, releaseID); err != nil {
		return 0, err
	}
	if _, err := dbWrapper.Exec(ctx, `INSERT INTO scene_release_view_dates(release_id,view_date) VALUES (?,?)`, releaseID, time.Now()); err != nil {
		return 0, err
	}
	var count int
	err := dbWrapper.Get(ctx, &count, `SELECT COUNT(*) FROM scene_release_view_dates WHERE release_id = ?`, releaseID)
	return count, err
}

func (qb *SceneReleaseStore) AddOAtTimestampCustom(ctx context.Context, releaseID int, videoTimestamp float64) (int, error) {
	if math.IsNaN(videoTimestamp) || math.IsInf(videoTimestamp, 0) || videoTimestamp < 0 {
		return 0, fmt.Errorf("video timestamp must be finite and non-negative")
	}
	if err := requireReleaseMetadataUpgradeCustom(ctx); err != nil {
		return 0, err
	}
	if err := qb.requireReleaseCustom(ctx, releaseID); err != nil {
		return 0, err
	}
	if _, err := dbWrapper.Exec(ctx, `INSERT INTO scene_release_o_dates(release_id,o_date,video_timestamp) VALUES (?,?,?)`, releaseID, time.Now(), videoTimestamp); err != nil {
		return 0, err
	}
	var count int
	err := dbWrapper.Get(ctx, &count, `SELECT COUNT(*) FROM scene_release_o_dates WHERE release_id = ?`, releaseID)
	return count, err
}

func (qb *SceneReleaseStore) requireReleaseCustom(ctx context.Context, releaseID int) error {
	var count int
	if err := dbWrapper.Get(ctx, &count, `SELECT COUNT(*) FROM scene_releases WHERE id = ?`, releaseID); err != nil {
		return err
	}
	if count == 0 {
		return fmt.Errorf("release %d not found", releaseID)
	}
	return nil
}

// EditHistoryCustom changes only the selected release and removes one duplicate
// at a time. Call it inside the mutation transaction.
func (qb *SceneReleaseStore) EditHistoryCustom(ctx context.Context, releaseID int, kind, action string, at *time.Time) error {
	if err := requireReleaseMetadataUpgradeCustom(ctx); err != nil {
		return err
	}
	if err := qb.requireReleaseCustom(ctx, releaseID); err != nil {
		return err
	}
	table, dateColumn := "scene_release_view_dates", "view_date"
	if kind == "o" {
		table, dateColumn = "scene_release_o_dates", "o_date"
	} else if kind != "play" {
		return fmt.Errorf("invalid release history kind %q", kind)
	}
	switch action {
	case "add":
		date := time.Now()
		if at != nil {
			date = *at
		}
		_, err := dbWrapper.Exec(ctx, fmt.Sprintf(`INSERT INTO %s(release_id,%s) VALUES (?,?)`, table, dateColumn), releaseID, date)
		return err
	case "delete":
		query := fmt.Sprintf(`DELETE FROM %s WHERE rowid = (
			SELECT rowid FROM %s WHERE release_id = ?`, table, table)
		args := []interface{}{releaseID}
		if at != nil {
			query += fmt.Sprintf(` AND %s = ?`, dateColumn)
			args = append(args, *at)
		}
		query += ` ORDER BY rowid DESC LIMIT 1)`
		result, err := dbWrapper.Exec(ctx, query, args...)
		if err != nil {
			return err
		}
		changed, err := result.RowsAffected()
		if err != nil {
			return err
		}
		if changed == 0 {
			return fmt.Errorf("release history event not found")
		}
		return nil
	case "clear":
		_, err := dbWrapper.Exec(ctx, fmt.Sprintf(`DELETE FROM %s WHERE release_id = ?`, table), releaseID)
		return err
	default:
		return fmt.Errorf("invalid release history action %q", action)
	}
}

func (qb *SceneReleaseStore) ResetActivityCustom(ctx context.Context, releaseID int, resetResume, resetDuration bool) error {
	if err := requireReleaseMetadataUpgradeCustom(ctx); err != nil {
		return err
	}
	if err := qb.requireReleaseCustom(ctx, releaseID); err != nil {
		return err
	}
	if _, err := dbWrapper.Exec(ctx, `INSERT OR IGNORE INTO scene_release_metadata(release_id) VALUES (?)`, releaseID); err != nil {
		return err
	}
	_, err := dbWrapper.Exec(ctx, `UPDATE scene_release_metadata SET
		resume_time = CASE WHEN ? THEN 0 ELSE resume_time END,
		play_duration = CASE WHEN ? THEN 0 ELSE play_duration END
		WHERE release_id = ?`, resetResume, resetDuration, releaseID)
	return err
}
