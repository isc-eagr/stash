package sqlite

// CUSTOM: release activity summed per parent scene, so scene-level displays
// can show the scene's own values plus its releases'.

import (
	"context"
	"fmt"
	"time"

	"github.com/stashapp/stash/pkg/models"
)

// GetSceneTotalsCustom returns each scene's release O count and summed release
// StashDB Matches. Scenes without releases are omitted.
func (qb *SceneReleaseStore) GetSceneTotalsCustom(ctx context.Context, sceneIDs []int) (map[int]models.SceneReleaseTotalsCustom, error) {
	ret := make(map[int]models.SceneReleaseTotalsCustom)
	if len(sceneIDs) == 0 {
		return ret, nil
	}
	args := make([]interface{}, len(sceneIDs))
	for i, id := range sceneIDs {
		args[i] = id
	}
	in := getInBinding(len(sceneIDs))

	{
		// One row per O: retroactive O's count but have no date.
		var rows []struct {
			SceneID int        `db:"scene_id"`
			ODate   *time.Time `db:"o_date"`
		}
		if err := dbWrapper.Select(ctx, &rows, `SELECT r.scene_id, o.o_date FROM scene_release_o_dates o
			JOIN scene_releases r ON r.id = o.release_id WHERE r.scene_id IN `+in, args...); err != nil {
			return nil, fmt.Errorf("counting release O's: %w", err)
		}
		for _, row := range rows {
			totals := ret[row.SceneID]
			totals.OCount++
			if row.ODate != nil && (totals.LastODate == nil || row.ODate.After(*totals.LastODate)) {
				totals.LastODate = row.ODate
			}
			ret[row.SceneID] = totals
		}
	}

	{
		var rows []struct {
			SceneID int `db:"scene_id"`
			Matches int `db:"matches"`
		}
		if err := dbWrapper.Select(ctx, &rows, `SELECT r.scene_id, SUM(m.matches) AS matches FROM scene_release_stashdb_matches m
			JOIN scene_releases r ON r.id = m.release_id WHERE r.scene_id IN `+in+` GROUP BY r.scene_id`, args...); err != nil {
			return nil, fmt.Errorf("summing release StashDB matches: %w", err)
		}
		for _, row := range rows {
			totals := ret[row.SceneID]
			matches := row.Matches
			totals.StashDBMatches = &matches
			ret[row.SceneID] = totals
		}
	}
	return ret, nil
}

// releaseOCountByStudioCustom counts O's on releases credited to the studio
// filter (studioWhere on alias r). A release's O's go to its own studio, never
// the parent scene's.
func releaseOCountByStudioCustom(ctx context.Context, studioWhere string, studioArgs []interface{}, performerID *string) (int, error) {
	query := `SELECT COUNT(*) FROM scene_release_o_dates o JOIN scene_releases r ON r.id = o.release_id WHERE ` + studioWhere
	args := append([]interface{}{}, studioArgs...)
	if performerID != nil && *performerID != "" {
		query += ` AND EXISTS (SELECT 1 FROM scene_release_performers rp WHERE rp.release_id = r.id AND rp.performer_id = ?)`
		args = append(args, *performerID)
	}
	var count int
	if err := dbWrapper.Get(ctx, &count, query, args...); err != nil {
		return 0, fmt.Errorf("counting studio release O's: %w", err)
	}
	return count, nil
}

// sceneReleaseOCountCustom counts the O's on a scene's releases.
func sceneReleaseOCountCustom(ctx context.Context, sceneID int) (int, error) {
	var count int
	err := dbWrapper.Get(ctx, &count, `SELECT COUNT(*) FROM scene_release_o_dates rod
		JOIN scene_releases r ON r.id = rod.release_id WHERE r.scene_id = ?`, sceneID)
	return count, err
}
