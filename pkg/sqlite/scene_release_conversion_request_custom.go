package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
)

func (qb *SceneReleaseStore) FindConversionRequestCustom(ctx context.Context, requestID, direction string, sourceID, targetID int) (int, bool, error) {
	if err := validateReleaseConversionRequestCustom(ctx, requestID); err != nil {
		return 0, false, err
	}
	var row struct {
		Direction string `db:"direction"`
		SourceID  int    `db:"source_id"`
		TargetID  int    `db:"target_id"`
		ResultID  int    `db:"result_id"`
	}
	err := dbWrapper.Get(ctx, &row, `SELECT direction,source_id,target_id,result_id FROM scene_release_conversion_requests WHERE request_id = ?`, requestID)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, err
	}
	if row.Direction != direction || row.SourceID != sourceID || row.TargetID != targetID {
		return 0, false, fmt.Errorf("conversion request ID already belongs to another conversion")
	}
	return row.ResultID, true, nil
}

func (qb *SceneReleaseStore) SaveConversionRequestCustom(ctx context.Context, requestID, direction string, sourceID, targetID, resultID int) error {
	if err := validateReleaseConversionRequestCustom(ctx, requestID); err != nil {
		return err
	}
	_, err := dbWrapper.Exec(ctx,
		`INSERT INTO scene_release_conversion_requests(request_id,direction,source_id,target_id,result_id) VALUES (?,?,?,?,?)`,
		requestID, direction, sourceID, targetID, resultID)
	return err
}

func validateReleaseConversionRequestCustom(ctx context.Context, requestID string) error {
	if strings.TrimSpace(requestID) != requestID || requestID == "" || len(requestID) > 128 {
		return fmt.Errorf("conversion request ID must be 1–128 characters without surrounding whitespace")
	}
	exists, err := releaseTransferTableExistsCustom(ctx, "scene_release_conversion_requests")
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("scene release metadata upgrade required: run scene_releases_metadata_v2.up.sql before retryable conversions")
	}
	return nil
}
