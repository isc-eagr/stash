package sqlite

// CUSTOM: Scene merge support for fork-owned scene data.

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"slices"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/sliceutil"
)

// MergeCustomDataCustom moves fork-owned data from each source scene to
// destID. It must run before the sources are destroyed, because most of this
// data cascades with its scene; rows left on a source are deleted with it.
// Releases left on the sources move to the destination. It returns the source
// whose Rating Advisor answers were adopted, or 0 when none were.
func (qb *SceneStore) MergeCustomDataCustom(ctx context.Context, sourceIDs []int, destID int, options models.SceneMergeOptionsCustom) (int, error) {
	sourceIDs = sliceutil.AppendUniques(nil, sourceIDs)
	if slices.Contains(sourceIDs, destID) {
		return 0, errors.New("destination scene cannot be in source list")
	}
	for _, sceneID := range []*int{options.RatingSceneID, options.StashDBMatchesSceneID} {
		if sceneID != nil && *sceneID != destID && !slices.Contains(sourceIDs, *sceneID) {
			return 0, fmt.Errorf("scene %d is not part of the merge", *sceneID)
		}
	}

	if err := mergeSceneNegativeMarkersCustom(ctx, sourceIDs, destID, options.NegativeMarkerIDs); err != nil {
		return 0, err
	}
	if err := mergeSceneLoopPresetsCustom(ctx, sourceIDs, destID, options.LoopPresetIDs); err != nil {
		return 0, err
	}
	if err := mergeSceneStashDBMatchesCustom(ctx, sourceIDs, destID, options.StashDBMatchesSceneID); err != nil {
		return 0, err
	}
	for _, sourceID := range sourceIDs {
		if err := mergeSceneReleasesCustom(ctx, sourceID, destID); err != nil {
			return 0, err
		}
		if options.IncludeOHistory {
			// Copy rows directly so each O keeps its video timestamp.
			if _, err := dbWrapper.Exec(ctx, fmt.Sprintf(
				`INSERT INTO %[1]s(scene_id,o_date,video_timestamp) SELECT ?,o_date,video_timestamp FROM %[1]s WHERE scene_id = ?`,
				scenesODatesTable), destID, sourceID); err != nil {
				return 0, fmt.Errorf("merging O history from scene %d: %w", sourceID, err)
			}
		}
	}

	return mergeSceneRatingCustom(ctx, sourceIDs, destID, options.RatingSceneID)
}

func mergeSceneReleasesCustom(ctx context.Context, sourceID, destID int) error {
	exists, err := releaseTransferTableExistsCustom(ctx, "scene_releases")
	if err != nil || !exists {
		return err
	}
	if err := checkSceneFamilyFileConflictsCustom(ctx, sourceID, destID); err != nil {
		return fmt.Errorf("merging scene %d: %w", sourceID, err)
	}
	if _, err := dbWrapper.Exec(ctx, `UPDATE scene_releases SET scene_id = ? WHERE scene_id = ?`, destID, sourceID); err != nil {
		return fmt.Errorf("moving releases from scene %d: %w", sourceID, err)
	}
	return nil
}

// keepMergeRowsCustom deletes destination rows missing from keep and returns
// the kept source row IDs in source order. It rejects IDs outside the merge.
func keepMergeRowsCustom(ctx context.Context, table, label string, sourceIDs []int, destID int, keep []int) ([]int, error) {
	pending := make(map[int]bool, len(keep))
	for _, id := range keep {
		pending[id] = true
	}

	var keptSourceIDs []int
	for _, sceneID := range append([]int{destID}, sourceIDs...) {
		var ids []int
		if err := dbWrapper.Select(ctx, &ids, fmt.Sprintf(`SELECT id FROM %s WHERE scene_id = ? ORDER BY id`, table), sceneID); err != nil {
			return nil, fmt.Errorf("finding %ss for scene %d: %w", label, sceneID, err)
		}
		for _, id := range ids {
			switch {
			case pending[id] && sceneID != destID:
				keptSourceIDs = append(keptSourceIDs, id)
			case !pending[id] && sceneID == destID:
				if _, err := dbWrapper.Exec(ctx, fmt.Sprintf(`DELETE FROM %s WHERE id = ?`, table), id); err != nil {
					return nil, fmt.Errorf("deleting %s %d: %w", label, id, err)
				}
			}
			delete(pending, id)
		}
	}
	if len(pending) > 0 {
		return nil, fmt.Errorf("%s %d is not part of the merge", label, slices.Min(slices.Collect(maps.Keys(pending))))
	}
	return keptSourceIDs, nil
}

// mergeSceneNegativeMarkersCustom moves the kept skip ranges. Without a
// selection it moves every range except exact duplicates of a kept one.
func mergeSceneNegativeMarkersCustom(ctx context.Context, sourceIDs []int, destID int, keep []int) error {
	const table = "scene_negative_markers"
	exists, err := releaseTransferTableExistsCustom(ctx, table)
	if err != nil || !exists {
		return err
	}

	if keep != nil {
		ids, err := keepMergeRowsCustom(ctx, table, "negative marker", sourceIDs, destID, keep)
		if err != nil {
			return err
		}
		for _, id := range ids {
			if _, err := dbWrapper.Exec(ctx, `UPDATE scene_negative_markers SET scene_id = ? WHERE id = ?`, destID, id); err != nil {
				return fmt.Errorf("moving negative marker %d: %w", id, err)
			}
		}
		return nil
	}

	for _, sourceID := range sourceIDs {
		if _, err := dbWrapper.Exec(ctx, `UPDATE scene_negative_markers SET scene_id = ?
			WHERE scene_id = ? AND NOT EXISTS (
				SELECT 1 FROM scene_negative_markers d
				WHERE d.scene_id = ?
				AND d.name = scene_negative_markers.name
				AND d.start_seconds = scene_negative_markers.start_seconds
				AND d.end_seconds = scene_negative_markers.end_seconds
			)`, destID, sourceID, destID); err != nil {
			return fmt.Errorf("moving negative markers from scene %d: %w", sourceID, err)
		}
	}
	return nil
}

// mergeSceneLoopPresetsCustom moves the kept loop presets, renaming one whose
// name is already used on the destination with a numeric suffix. Without a
// selection it moves every preset and drops identical same-name presets.
func mergeSceneLoopPresetsCustom(ctx context.Context, sourceIDs []int, destID int, keep []int) error {
	exists, err := releaseTransferTableExistsCustom(ctx, sceneLoopPresetTable)
	if err != nil || !exists {
		return err
	}

	var keptIDs []int
	if keep != nil {
		if keptIDs, err = keepMergeRowsCustom(ctx, sceneLoopPresetTable, "loop preset", sourceIDs, destID, keep); err != nil {
			return err
		}
	}

	type presetRow struct {
		ID       int    `db:"id"`
		Name     string `db:"name"`
		Segments string `db:"segments"`
	}
	query := fmt.Sprintf(`SELECT id, name, segments FROM %s WHERE scene_id = ? ORDER BY id`, sceneLoopPresetTable)
	var destRows []presetRow
	if err := dbWrapper.Select(ctx, &destRows, query, destID); err != nil {
		return fmt.Errorf("finding loop presets for scene %d: %w", destID, err)
	}
	var sourceRows []presetRow
	for _, sourceID := range sourceIDs {
		var rows []presetRow
		if err := dbWrapper.Select(ctx, &rows, query, sourceID); err != nil {
			return fmt.Errorf("finding loop presets for scene %d: %w", sourceID, err)
		}
		for _, row := range rows {
			if keep == nil || slices.Contains(keptIDs, row.ID) {
				sourceRows = append(sourceRows, row)
			}
		}
	}

	destSegments := make(map[string]string, len(destRows))
	for _, row := range destRows {
		destSegments[row.Name] = row.Segments
	}

	move := func(row presetRow, name string) error {
		if _, err := dbWrapper.Exec(ctx, fmt.Sprintf(`UPDATE %s SET scene_id = ?, name = ? WHERE id = ?`, sceneLoopPresetTable),
			destID, name, row.ID); err != nil {
			return fmt.Errorf("moving loop preset %d: %w", row.ID, err)
		}
		destSegments[name] = row.Segments
		return nil
	}

	// Claim free names first so a renamed preset cannot take a source name.
	var conflicts []presetRow
	for _, row := range sourceRows {
		segments, taken := destSegments[row.Name]
		switch {
		case !taken:
			if err := move(row, row.Name); err != nil {
				return err
			}
		case keep != nil || segments != row.Segments:
			conflicts = append(conflicts, row)
		}
	}
	for _, row := range conflicts {
		for i := 2; ; i++ {
			name := fmt.Sprintf("%s (%d)", row.Name, i)
			if _, taken := destSegments[name]; !taken {
				if err := move(row, name); err != nil {
					return err
				}
				break
			}
		}
	}
	return nil
}

// mergeSceneStashDBMatchesCustom uses the chosen scene's count. Without a
// choice it keeps the destination's count, or takes the first source count
// when the destination was never scraped.
func mergeSceneStashDBMatchesCustom(ctx context.Context, sourceIDs []int, destID int, sceneID *int) error {
	if sceneID != nil {
		if *sceneID == destID {
			return nil
		}
		if _, err := dbWrapper.Exec(ctx, `DELETE FROM scene_stashdb_matches WHERE scene_id = ?`, destID); err != nil {
			return fmt.Errorf("clearing StashDB matches for scene %d: %w", destID, err)
		}
		sourceIDs = []int{*sceneID}
	}
	for _, sourceID := range sourceIDs {
		if _, err := dbWrapper.Exec(ctx, `INSERT OR IGNORE INTO scene_stashdb_matches(scene_id, matches)
			SELECT ?, matches FROM scene_stashdb_matches WHERE scene_id = ?`, destID, sourceID); err != nil {
			return fmt.Errorf("merging StashDB matches from scene %d: %w", sourceID, err)
		}
	}
	return nil
}

// mergeSceneRatingCustom gives the destination the chosen scene's rating and
// advisor answers. Without a choice the destination keeps its answers when it
// has any; otherwise it adopts the first source with answers, or, when no
// scene has answers, an unrated destination takes the first source's rating.
func mergeSceneRatingCustom(ctx context.Context, sourceIDs []int, destID int, sceneID *int) (int, error) {
	hasScores := func(sceneID int) (bool, error) {
		var count int
		if err := dbWrapper.Get(ctx, &count, fmt.Sprintf(`SELECT
			(SELECT COUNT(*) FROM %s WHERE entity_type = 'scene' AND entity_id = ?) +
			(SELECT COUNT(*) FROM %s WHERE entity_type = 'scene' AND entity_id = ?) +
			(SELECT COUNT(*) FROM %s WHERE entity_type = 'scene' AND entity_id = ?)`,
			ratingCriteriaScoresTable, ratingBonusScoresTable, ratingPenaltyScoresTable),
			sceneID, sceneID, sceneID); err != nil {
			return false, fmt.Errorf("counting advisor scores for scene %d: %w", sceneID, err)
		}
		return count > 0, nil
	}
	adoptScores := func(sourceID int) error {
		for _, table := range ratingScoreTables {
			if _, err := dbWrapper.Exec(ctx, fmt.Sprintf(`UPDATE %s SET entity_id = ? WHERE entity_type = 'scene' AND entity_id = ?`, table.table),
				destID, sourceID); err != nil {
				return fmt.Errorf("moving %s advisor scores from scene %d: %w", table.section, sourceID, err)
			}
		}
		return nil
	}
	copyRating := func(sourceID int, onlyUnrated bool) error {
		query := fmt.Sprintf(`UPDATE %[1]s SET rating = (SELECT rating FROM %[1]s WHERE id = ?) WHERE id = ?`, sceneTable)
		if onlyUnrated {
			query += " AND rating IS NULL"
		}
		if _, err := dbWrapper.Exec(ctx, query, sourceID, destID); err != nil {
			return fmt.Errorf("merging rating from scene %d: %w", sourceID, err)
		}
		return nil
	}

	if sceneID != nil {
		if *sceneID == destID {
			return 0, nil
		}
		for _, table := range ratingScoreTables {
			if _, err := dbWrapper.Exec(ctx, fmt.Sprintf(`DELETE FROM %s WHERE entity_type = 'scene' AND entity_id = ?`, table.table), destID); err != nil {
				return 0, fmt.Errorf("clearing %s advisor scores for scene %d: %w", table.section, destID, err)
			}
		}
		if err := copyRating(*sceneID, false); err != nil {
			return 0, err
		}
		sourceHasScores, err := hasScores(*sceneID)
		if err != nil || !sourceHasScores {
			return 0, err
		}
		if err := adoptScores(*sceneID); err != nil {
			return 0, err
		}
		return *sceneID, nil
	}

	destHasScores, err := hasScores(destID)
	if err != nil || destHasScores {
		return 0, err
	}
	for _, sourceID := range sourceIDs {
		sourceHasScores, err := hasScores(sourceID)
		if err != nil {
			return 0, err
		}
		if sourceHasScores {
			if err := adoptScores(sourceID); err != nil {
				return 0, err
			}
			return sourceID, nil
		}
	}
	for _, sourceID := range sourceIDs {
		if err := copyRating(sourceID, true); err != nil {
			return 0, err
		}
	}
	return 0, nil
}
