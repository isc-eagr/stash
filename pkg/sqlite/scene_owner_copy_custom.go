package sqlite

// CUSTOM: copy markers, skip ranges, and loop presets between a scene and its
// releases. Copies are new rows on the target; the source is never changed.

import (
	"context"
	"fmt"
	"time"

	"github.com/stashapp/stash/pkg/models"
)

// sceneOwnerColumnCustom returns the owner column and ID for the owner tables.
func sceneOwnerColumnCustom(owner models.SceneOwnerCustom) (string, int, error) {
	switch {
	case owner.SceneID != 0 && owner.ReleaseID == 0:
		return "scene_id", owner.SceneID, nil
	case owner.ReleaseID != 0 && owner.SceneID == 0:
		return "release_id", owner.ReleaseID, nil
	default:
		return "", 0, fmt.Errorf("owner must be exactly one scene or release: %+v", owner)
	}
}

// ownerValuesCustom gives the scene_id and release_id values for an insert.
func ownerValuesCustom(owner models.SceneOwnerCustom) (sceneID, releaseID any) {
	if owner.ReleaseID != 0 {
		return nil, owner.ReleaseID
	}
	return owner.SceneID, nil
}

func (qb *SceneReleaseStore) CopyOwnerItemsCustom(ctx context.Context, from, to models.SceneOwnerCustom, kinds models.SceneOwnerCopyKindsCustom) (models.SceneOwnerCopyResultCustom, error) {
	var ret models.SceneOwnerCopyResultCustom
	fromColumn, fromID, err := sceneOwnerColumnCustom(from)
	if err != nil {
		return ret, err
	}
	toColumn, toID, err := sceneOwnerColumnCustom(to)
	if err != nil {
		return ret, err
	}
	if fromColumn == toColumn && fromID == toID {
		return ret, fmt.Errorf("cannot copy items onto their own owner")
	}
	now := time.Now()
	if kinds.Markers {
		if ret.Markers, err = copyOwnerMarkersCustom(ctx, fromColumn, fromID, toColumn, toID, to, now); err != nil {
			return ret, err
		}
	}
	if kinds.NegativeMarkers {
		if ret.NegativeMarkers, err = copyOwnerNegativeMarkersCustom(ctx, fromColumn, fromID, toColumn, toID, to, now); err != nil {
			return ret, err
		}
	}
	if kinds.LoopPresets {
		if ret.LoopPresets, err = copyOwnerLoopPresetsCustom(ctx, fromColumn, fromID, toColumn, toID, to, now); err != nil {
			return ret, err
		}
	}
	return ret, nil
}

type ownerMarkerKeyRowCustom struct {
	ID           int      `db:"id"`
	Title        string   `db:"title"`
	Seconds      float64  `db:"seconds"`
	EndSeconds   *float64 `db:"end_seconds"`
	PrimaryTagID int      `db:"primary_tag_id"`
}

func (r ownerMarkerKeyRowCustom) key() string {
	end := "-"
	if r.EndSeconds != nil {
		end = fmt.Sprint(*r.EndSeconds)
	}
	return fmt.Sprintf("%v|%s|%d|%s", r.Seconds, end, r.PrimaryTagID, r.Title)
}

func copyOwnerMarkersCustom(ctx context.Context, fromColumn string, fromID int, toColumn string, toID int, to models.SceneOwnerCustom, now time.Time) (int, error) {
	const columns = `id,title,seconds,end_seconds,primary_tag_id`
	var source, target []ownerMarkerKeyRowCustom
	if err := dbWrapper.Select(ctx, &source, `SELECT `+columns+` FROM scene_markers WHERE `+fromColumn+` = ? ORDER BY seconds,id`, fromID); err != nil {
		return 0, fmt.Errorf("finding source markers: %w", err)
	}
	if err := dbWrapper.Select(ctx, &target, `SELECT `+columns+` FROM scene_markers WHERE `+toColumn+` = ?`, toID); err != nil {
		return 0, fmt.Errorf("finding target markers: %w", err)
	}
	existing := make(map[string]bool, len(target))
	for _, row := range target {
		existing[row.key()] = true
	}
	copied := 0
	for _, row := range source {
		if existing[row.key()] {
			continue
		}
		existing[row.key()] = true
		copyID, err := copyMarkerRowCustom(ctx, row.ID, to, now)
		if err != nil {
			return copied, err
		}
		// A new marker's tags are incoming tracker work, as on create.
		afterTags, err := taskProgressTagSnapshotCustom(ctx, "scene_marker", copyID)
		if err != nil {
			return copied, err
		}
		if err := recordTaskProgressTagDiffCustom(ctx, "scene_marker", copyID, nil, afterTags); err != nil {
			return copied, err
		}
		copied++
	}
	return copied, nil
}

type ownerRangeRowCustom struct {
	Name         string  `db:"name"`
	StartSeconds float64 `db:"start_seconds"`
	EndSeconds   float64 `db:"end_seconds"`
}

func copyOwnerNegativeMarkersCustom(ctx context.Context, fromColumn string, fromID int, toColumn string, toID int, to models.SceneOwnerCustom, now time.Time) (int, error) {
	const columns = `name,start_seconds,end_seconds`
	var source, target []ownerRangeRowCustom
	if err := dbWrapper.Select(ctx, &source, `SELECT `+columns+` FROM scene_negative_markers WHERE `+fromColumn+` = ? ORDER BY start_seconds,id`, fromID); err != nil {
		return 0, fmt.Errorf("finding source skip ranges: %w", err)
	}
	if err := dbWrapper.Select(ctx, &target, `SELECT `+columns+` FROM scene_negative_markers WHERE `+toColumn+` = ?`, toID); err != nil {
		return 0, fmt.Errorf("finding target skip ranges: %w", err)
	}
	type rangeKey struct{ start, end float64 }
	existing := make(map[rangeKey]bool, len(target))
	for _, row := range target {
		existing[rangeKey{row.StartSeconds, row.EndSeconds}] = true
	}
	sceneID, releaseID := ownerValuesCustom(to)
	copied := 0
	for _, row := range source {
		key := rangeKey{row.StartSeconds, row.EndSeconds}
		if existing[key] {
			continue
		}
		existing[key] = true
		if _, err := dbWrapper.Exec(ctx, `INSERT INTO scene_negative_markers(scene_id,release_id,name,start_seconds,end_seconds,created_at,updated_at)
			VALUES (?,?,?,?,?,?,?)`, sceneID, releaseID, row.Name, row.StartSeconds, row.EndSeconds, now, now); err != nil {
			return copied, fmt.Errorf("copying skip range %v-%v: %w", row.StartSeconds, row.EndSeconds, err)
		}
		copied++
	}
	return copied, nil
}

type ownerPresetRowCustom struct {
	Name                string `db:"name"`
	Segments            string `db:"segments"`
	Enabled             bool   `db:"enabled"`
	CurrentSegmentIndex int    `db:"current_segment_index"`
}

// copyOwnerLoopPresetsCustom skips a same-name preset with identical segments
// and renames a differing one "Name (2)", as scene merge does.
func copyOwnerLoopPresetsCustom(ctx context.Context, fromColumn string, fromID int, toColumn string, toID int, to models.SceneOwnerCustom, now time.Time) (int, error) {
	const columns = `name,segments,enabled,current_segment_index`
	var source, target []ownerPresetRowCustom
	if err := dbWrapper.Select(ctx, &source, `SELECT `+columns+` FROM scene_multi_segment_loop_presets WHERE `+fromColumn+` = ? ORDER BY name,id`, fromID); err != nil {
		return 0, fmt.Errorf("finding source loop presets: %w", err)
	}
	if err := dbWrapper.Select(ctx, &target, `SELECT `+columns+` FROM scene_multi_segment_loop_presets WHERE `+toColumn+` = ?`, toID); err != nil {
		return 0, fmt.Errorf("finding target loop presets: %w", err)
	}
	targetSegments := make(map[string]string, len(target))
	for _, row := range target {
		targetSegments[row.Name] = row.Segments
	}
	sceneID, releaseID := ownerValuesCustom(to)
	copied := 0
	insert := func(row ownerPresetRowCustom, name string) error {
		if _, err := dbWrapper.Exec(ctx, `INSERT INTO scene_multi_segment_loop_presets(scene_id,release_id,name,segments,enabled,current_segment_index,created_at,updated_at)
			VALUES (?,?,?,?,?,?,?,?)`, sceneID, releaseID, name, row.Segments, row.Enabled, row.CurrentSegmentIndex, now, now); err != nil {
			return fmt.Errorf("copying loop preset %q: %w", row.Name, err)
		}
		targetSegments[name] = row.Segments
		copied++
		return nil
	}

	// Claim free names first so a renamed preset cannot take a source name.
	var conflicts []ownerPresetRowCustom
	for _, row := range source {
		segments, taken := targetSegments[row.Name]
		switch {
		case !taken:
			if err := insert(row, row.Name); err != nil {
				return copied, err
			}
		case segments != row.Segments:
			conflicts = append(conflicts, row)
		}
	}
	for _, row := range conflicts {
		for i := 2; ; i++ {
			name := fmt.Sprintf("%s (%d)", row.Name, i)
			segments, taken := targetSegments[name]
			if taken && segments == row.Segments {
				break
			}
			if !taken {
				if err := insert(row, name); err != nil {
					return copied, err
				}
				break
			}
		}
	}
	return copied, nil
}
