package sqlite

// CUSTOM: Scene marker performer association methods (top/bottom roles).

import (
	"context"
	"fmt"
	"strings"

	"github.com/stashapp/stash/pkg/models"
)

func (qb *SceneMarkerStore) UpdatePerformers(ctx context.Context, id int, performerIDs []int) error {
	// Delete the existing joins and then create new ones
	return sceneMarkerRepository.performers.replace(ctx, id, performerIDs)
}

// UpdateTopPerformers replaces all top performers for a scene marker.
// It removes existing top associations and adds new ones with role='top'.
func (qb *SceneMarkerStore) UpdateTopPerformers(ctx context.Context, markerID int, performerIDs []int) error {
	return qb.updatePerformersWithRole(ctx, markerID, performerIDs, "top")
}

// UpdateBottomPerformers replaces all bottom performers for a scene marker.
// It removes existing bottom associations and adds new ones with role='bottom'.
func (qb *SceneMarkerStore) UpdateBottomPerformers(ctx context.Context, markerID int, performerIDs []int) error {
	return qb.updatePerformersWithRole(ctx, markerID, performerIDs, "bottom")
}

// updatePerformersWithRole replaces all performers of a given role for a scene marker.
func (qb *SceneMarkerStore) updatePerformersWithRole(ctx context.Context, markerID int, performerIDs []int, role string) error {
	// Delete existing performers with this role
	deleteStmt := "DELETE FROM scene_marker_performers WHERE scene_marker_id = ? AND role = ?"
	if _, err := dbWrapper.Exec(ctx, deleteStmt, markerID, role); err != nil {
		return fmt.Errorf("deleting existing %s performers: %w", role, err)
	}

	// Insert new performers with the role
	if len(performerIDs) > 0 {
		insertStmt := "INSERT INTO scene_marker_performers (scene_marker_id, performer_id, role) VALUES (?, ?, ?)"
		for _, perfID := range performerIDs {
			if _, err := dbWrapper.Exec(ctx, insertStmt, markerID, perfID, role); err != nil {
				return fmt.Errorf("inserting %s performer %d: %w", role, perfID, err)
			}
		}
	}

	return nil
}

// markerPerformerRow is a helper struct for scanning marker performer rows.
type markerPerformerRow struct {
	PerformerID int    `db:"performer_id"`
	Role        string `db:"role"`
}

// GetPerformers returns all performers associated with a scene marker along with their roles.
func (qb *SceneMarkerStore) GetPerformers(ctx context.Context, markerID int) ([]*models.MarkerPerformer, error) {
	query := "SELECT performer_id, role FROM scene_marker_performers WHERE scene_marker_id = ?"

	var rows []markerPerformerRow
	if err := dbWrapper.Select(ctx, &rows, query, markerID); err != nil {
		return nil, fmt.Errorf("querying marker performers: %w", err)
	}

	result := make([]*models.MarkerPerformer, len(rows))
	for i, r := range rows {
		result[i] = &models.MarkerPerformer{
			PerformerID: r.PerformerID,
			Role:        r.Role,
		}
	}

	return result, nil
}

// GetPerformersForMarkers fetches performer associations for a batch of marker IDs in a single
// SQL query, eliminating the N+1 pattern when iterating over large marker result sets.
// Returns a map of markerID → slice of MarkerPerformer (empty slice if none).
func (qb *SceneMarkerStore) GetPerformersForMarkers(ctx context.Context, markerIDs []int) (map[int][]*models.MarkerPerformer, error) {
	result := make(map[int][]*models.MarkerPerformer, len(markerIDs))
	if len(markerIDs) == 0 {
		return result, nil
	}

	type markerPerformerBatchRow struct {
		SceneMarkerID int    `db:"scene_marker_id"`
		PerformerID   int    `db:"performer_id"`
		Role          string `db:"role"`
	}

	// SQLite bind-parameter limit is ~999; process in chunks to be safe.
	const chunkSize = 900
	for i := 0; i < len(markerIDs); i += chunkSize {
		end := i + chunkSize
		if end > len(markerIDs) {
			end = len(markerIDs)
		}
		chunk := markerIDs[i:end]

		placeholders := strings.Repeat("?,", len(chunk))
		placeholders = placeholders[:len(placeholders)-1]
		query := fmt.Sprintf(
			"SELECT scene_marker_id, performer_id, role FROM scene_marker_performers WHERE scene_marker_id IN (%s)",
			placeholders,
		)
		args := make([]interface{}, len(chunk))
		for j, id := range chunk {
			args[j] = id
		}

		var rows []markerPerformerBatchRow
		if err := dbWrapper.Select(ctx, &rows, query, args...); err != nil {
			return nil, fmt.Errorf("querying marker performers batch: %w", err)
		}

		for _, r := range rows {
			result[r.SceneMarkerID] = append(result[r.SceneMarkerID], &models.MarkerPerformer{
				PerformerID: r.PerformerID,
				Role:        r.Role,
			})
		}
	}

	return result, nil
}

// GetTagIDsForMarkers fetches secondary tag IDs for a batch of marker IDs in a single
// SQL query, eliminating the N+1 pattern when filtering markers by tag.
// Returns a map of markerID → slice of tag IDs (empty slice if none).
func (qb *SceneMarkerStore) GetTagIDsForMarkers(ctx context.Context, markerIDs []int) (map[int][]int, error) {
	result := make(map[int][]int, len(markerIDs))
	if len(markerIDs) == 0 {
		return result, nil
	}

	type markerTagBatchRow struct {
		SceneMarkerID int `db:"scene_marker_id"`
		TagID         int `db:"tag_id"`
	}

	const chunkSize = 900
	for i := 0; i < len(markerIDs); i += chunkSize {
		end := i + chunkSize
		if end > len(markerIDs) {
			end = len(markerIDs)
		}
		chunk := markerIDs[i:end]

		placeholders := strings.Repeat("?,", len(chunk))
		placeholders = placeholders[:len(placeholders)-1]
		query := fmt.Sprintf(
			"SELECT scene_marker_id, tag_id FROM scene_markers_tags WHERE scene_marker_id IN (%s)",
			placeholders,
		)
		args := make([]interface{}, len(chunk))
		for j, id := range chunk {
			args[j] = id
		}

		var rows []markerTagBatchRow
		if err := dbWrapper.Select(ctx, &rows, query, args...); err != nil {
			return nil, fmt.Errorf("querying marker tag IDs batch: %w", err)
		}

		for _, r := range rows {
			result[r.SceneMarkerID] = append(result[r.SceneMarkerID], r.TagID)
		}
	}

	return result, nil
}

// FindPerformerMarkerRoleRows fetches compact marker-role rows for many performers using
// performer_id IN (...) instead of the generic filter's page-size-dependent OR/EXISTS chain.
// CUSTOM
func (qb *SceneMarkerStore) FindPerformerMarkerRoleRows(ctx context.Context, performerIDs []int, tagIDs []int, role string) ([]*models.PerformerMarkerRoleRow, error) {
	performerIDs = uniquePositiveInts(performerIDs)
	tagIDs = uniquePositiveInts(tagIDs)
	if len(performerIDs) == 0 {
		return nil, nil
	}

	type performerMarkerRoleSQLRow struct {
		SceneMarkerID int    `db:"scene_marker_id"`
		SceneID       int    `db:"scene_id"`
		PrimaryTagID  int    `db:"primary_tag_id"`
		PerformerID   int    `db:"performer_id"`
		Role          string `db:"role"`
	}

	const maxBindParams = 900
	tagBindCount := 0
	if len(tagIDs) > 0 {
		tagBindCount = len(tagIDs) * 4
	}
	roleBindCount := 0
	if role != "" {
		roleBindCount = 1
	}
	performerChunkSize := maxBindParams - tagBindCount - roleBindCount
	if performerChunkSize > 300 {
		performerChunkSize = 300
	}
	if performerChunkSize < 1 {
		performerChunkSize = 1
	}

	var ret []*models.PerformerMarkerRoleRow
	seen := make(map[string]bool)
	for i := 0; i < len(performerIDs); i += performerChunkSize {
		end := i + performerChunkSize
		if end > len(performerIDs) {
			end = len(performerIDs)
		}
		performerChunk := performerIDs[i:end]

		whereParts := []string{
			fmt.Sprintf("smp.performer_id IN (%s)", sqlitePlaceholders(len(performerChunk))),
		}
		args := make([]interface{}, 0, len(performerChunk)+roleBindCount+tagBindCount)
		for _, id := range performerChunk {
			args = append(args, id)
		}

		if role != "" {
			whereParts = append(whereParts, "smp.role = ?")
			args = append(args, role)
		}

		if len(tagIDs) > 0 {
			tagBinding := fmt.Sprintf("(%s)", sqlitePlaceholders(len(tagIDs)))
			whereParts = append(whereParts, fmt.Sprintf(`(
				%[1]s
				AND %[2]s
				AND NOT EXISTS (
					SELECT 1
					FROM scene_markers sm_narrow
					WHERE %[3]s
					AND %[4]s
					AND %[5]s
					AND %[6]s
				)
			)`,
				sceneMarkerDirectHasTagInClauseCustom("sm", tagBinding),
				sceneMarkerHasEffectiveTagInClauseCustom("sm", tagBinding),
				sceneMarkerOverlapWhereCustom("sm", "sm_narrow"),
				sceneMarkerDirectHasTagInClauseCustom("sm_narrow", tagBinding),
				sceneMarkerHasEffectiveTagInClauseCustom("sm_narrow", tagBinding),
				sceneMarkerIsNarrowerThanClauseCustom("sm_narrow", "sm"),
			))
			for _, id := range tagIDs {
				args = append(args, id)
			}
			for _, id := range tagIDs {
				args = append(args, id)
			}
			for _, id := range tagIDs {
				args = append(args, id)
			}
			for _, id := range tagIDs {
				args = append(args, id)
			}
		}

		query := fmt.Sprintf(`
			SELECT DISTINCT
				sm.id AS scene_marker_id,
				sm.scene_id,
				sm.primary_tag_id,
				smp.performer_id,
				smp.role
			FROM scene_markers sm
			JOIN scene_marker_performers smp ON smp.scene_marker_id = sm.id
			WHERE %s
		`, strings.Join(whereParts, " AND "))

		var rows []performerMarkerRoleSQLRow
		if err := dbWrapper.Select(ctx, &rows, query, args...); err != nil {
			return nil, fmt.Errorf("querying performer marker role rows: %w", err)
		}

		for _, row := range rows {
			key := fmt.Sprintf("%d:%d:%s", row.SceneMarkerID, row.PerformerID, row.Role)
			if seen[key] {
				continue
			}
			seen[key] = true
			ret = append(ret, &models.PerformerMarkerRoleRow{
				SceneMarkerID: row.SceneMarkerID,
				SceneID:       row.SceneID,
				PrimaryTagID:  row.PrimaryTagID,
				PerformerID:   row.PerformerID,
				Role:          row.Role,
			})
		}
	}

	return ret, nil
}

// FindPerformerPartnerRoleRows fetches distinct partner relationships for many performers
// in one tag-scoped query. This avoids loading all marker performers and deduping partners
// in Go for every performer card.
// CUSTOM
func (qb *SceneMarkerStore) FindPerformerPartnerRoleRows(ctx context.Context, performerIDs []int, tagIDs []int) ([]*models.PerformerPartnerRoleRow, error) {
	performerIDs = uniquePositiveInts(performerIDs)
	tagIDs = uniquePositiveInts(tagIDs)
	if len(performerIDs) == 0 {
		return nil, nil
	}

	type performerPartnerRoleSQLRow struct {
		PerformerID int    `db:"performer_id"`
		Role        string `db:"role"`
		PartnerID   int    `db:"partner_id"`
	}

	const maxBindParams = 900
	tagBindCount := 0
	if len(tagIDs) > 0 {
		tagBindCount = len(tagIDs) * 4
	}
	performerChunkSize := maxBindParams - tagBindCount
	if performerChunkSize > 300 {
		performerChunkSize = 300
	}
	if performerChunkSize < 1 {
		performerChunkSize = 1
	}

	var ret []*models.PerformerPartnerRoleRow
	seen := make(map[string]bool)
	for i := 0; i < len(performerIDs); i += performerChunkSize {
		end := i + performerChunkSize
		if end > len(performerIDs) {
			end = len(performerIDs)
		}
		performerChunk := performerIDs[i:end]

		whereParts := []string{
			fmt.Sprintf("target.performer_id IN (%s)", sqlitePlaceholders(len(performerChunk))),
			"target.role IN ('top', 'bottom')",
			"partner.performer_id <> target.performer_id",
			`(
				(target.role = 'top' AND partner.role = 'bottom')
				OR (target.role = 'bottom' AND partner.role = 'top')
			)`,
		}
		args := make([]interface{}, 0, len(performerChunk)+tagBindCount)
		for _, id := range performerChunk {
			args = append(args, id)
		}

		if len(tagIDs) > 0 {
			tagBinding := fmt.Sprintf("(%s)", sqlitePlaceholders(len(tagIDs)))
			whereParts = append(whereParts, fmt.Sprintf(`(
				%[1]s
				AND %[2]s
				AND NOT EXISTS (
					SELECT 1
					FROM scene_markers sm_narrow
					WHERE %[3]s
					AND %[4]s
					AND %[5]s
					AND %[6]s
				)
			)`,
				sceneMarkerDirectHasTagInClauseCustom("sm", tagBinding),
				sceneMarkerHasEffectiveTagInClauseCustom("sm", tagBinding),
				sceneMarkerOverlapWhereCustom("sm", "sm_narrow"),
				sceneMarkerDirectHasTagInClauseCustom("sm_narrow", tagBinding),
				sceneMarkerHasEffectiveTagInClauseCustom("sm_narrow", tagBinding),
				sceneMarkerIsNarrowerThanClauseCustom("sm_narrow", "sm"),
			))
			for _, id := range tagIDs {
				args = append(args, id)
			}
			for _, id := range tagIDs {
				args = append(args, id)
			}
			for _, id := range tagIDs {
				args = append(args, id)
			}
			for _, id := range tagIDs {
				args = append(args, id)
			}
		}

		query := fmt.Sprintf(`
			SELECT DISTINCT
				target.performer_id,
				target.role,
				partner.performer_id AS partner_id
			FROM scene_markers sm
			JOIN scene_marker_performers target ON target.scene_marker_id = sm.id
			JOIN scene_marker_performers partner ON partner.scene_marker_id = sm.id
			WHERE %s
		`, strings.Join(whereParts, " AND "))

		var rows []performerPartnerRoleSQLRow
		if err := dbWrapper.Select(ctx, &rows, query, args...); err != nil {
			return nil, fmt.Errorf("querying performer partner role rows: %w", err)
		}

		for _, row := range rows {
			key := fmt.Sprintf("%d:%s:%d", row.PerformerID, row.Role, row.PartnerID)
			if seen[key] {
				continue
			}
			seen[key] = true
			ret = append(ret, &models.PerformerPartnerRoleRow{
				PerformerID: row.PerformerID,
				Role:        row.Role,
				PartnerID:   row.PartnerID,
			})
		}
	}

	return ret, nil
}

func sqlitePlaceholders(n int) string {
	return strings.TrimRight(strings.Repeat("?,", n), ",")
}

func uniquePositiveInts(values []int) []int {
	ret := make([]int, 0, len(values))
	seen := make(map[int]bool, len(values))
	for _, value := range values {
		if value <= 0 || seen[value] {
			continue
		}
		seen[value] = true
		ret = append(ret, value)
	}
	return ret
}
