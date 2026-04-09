package sqlite

// CUSTOM: Methods for performer store supporting scene marker performers and image blob operations.

import (
	"context"
	"fmt"

	"github.com/doug-martin/goqu/v9"
	"github.com/stashapp/stash/pkg/models"
)

func (qb *PerformerStore) FindBySceneMarkerID(ctx context.Context, sceneMarkerID int) ([]*models.Performer, error) {
	sq := dialect.From(goqu.T("scene_marker_performers")).Select(goqu.C("performer_id")).Where(
		goqu.C("scene_marker_id").Eq(sceneMarkerID),
	)
	ret, err := qb.findBySubquery(ctx, sq)

	if err != nil {
		return nil, fmt.Errorf("getting performers for scene marker %d: %w", sceneMarkerID, err)
	}

	return ret, nil
}

func (qb *PerformerStore) FindBySceneMarkerIDWithRole(ctx context.Context, sceneMarkerID int, role string) ([]*models.Performer, error) {
	sq := dialect.From(goqu.T("scene_marker_performers")).Select(goqu.C("performer_id")).Where(
		goqu.C("scene_marker_id").Eq(sceneMarkerID),
		goqu.C("role").Eq(role),
	)
	ret, err := qb.findBySubquery(ctx, sq)

	if err != nil {
		return nil, fmt.Errorf("getting %s performers for scene marker %d: %w", role, sceneMarkerID, err)
	}

	return ret, nil
}

func (qb *PerformerStore) GetImageBlob(ctx context.Context, performerID int) (*string, error) {
	return qb.blobJoinQueryBuilder.getChecksum(ctx, performerID, performerImageBlobColumn)
}

func (qb *PerformerStore) UpdateImageBlob(ctx context.Context, performerID int, blobChecksum string) error {
	// Bump updated_at so image URLs with ?t=<updated_at> cache-bust correctly.
	sqlQuery := fmt.Sprintf("UPDATE %s SET %s = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", performerTable, performerImageBlobColumn)
	_, err := dbWrapper.Exec(ctx, sqlQuery, blobChecksum, performerID)
	return err
}
