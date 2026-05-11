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
