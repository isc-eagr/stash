package sqlite

// CUSTOM: Transfer o-history between entities, and record/retrieve video timestamps.

import (
	"context"
	"fmt"
	"time"

	"github.com/doug-martin/goqu/v9"
	"github.com/jmoiron/sqlx"
)

func (qb *oDateManager) TransferOHistory(ctx context.Context, fromID int, toID int) error {
	return qb.tableMgr.transferDates(ctx, fromID, toID)
}

// AddOAtVideoTimestamp inserts an O record with the current wall-clock time
// and the provided video timestamp (seconds into the video). Returns the
// updated list of all o_dates for the scene.
func (qb *oDateManager) AddOAtVideoTimestamp(ctx context.Context, id int, videoTimestamp float64) ([]time.Time, error) {
	table := qb.tableMgr.table.table
	now := UTCTimestamp{Timestamp: Timestamp{time.Now()}}

	q := dialect.Insert(table).
		Cols(qb.tableMgr.idColumn.GetCol(), qb.tableMgr.dateColumn.GetCol(), "video_timestamp").
		Vals(goqu.Vals{id, now, videoTimestamp})

	if _, err := exec(ctx, q); err != nil {
		return nil, fmt.Errorf("inserting o with video timestamp: %w", err)
	}

	return qb.tableMgr.getDates(ctx, id)
}

// GetOVideoTimestamps returns video_timestamp values for ALL O entries of the
// given scene, ordered by date DESC (same order as o_history). Entries without
// a recorded video position are returned as nil, keeping the array parallel
// with o_history so callers can zip them together.
func (qb *oDateManager) GetOVideoTimestamps(ctx context.Context, id int) ([]*float64, error) {
	table := qb.tableMgr.table.table
	tsCol := table.Col("video_timestamp")
	dateCol := table.Col(qb.tableMgr.dateColumn.GetCol())

	q := dialect.Select(tsCol).
		From(table).
		Where(qb.tableMgr.idColumn.Eq(id)).
		Order(dateCol.Desc())

	const single = false
	var ret []*float64
	if err := queryFunc(ctx, q, single, func(rows *sqlx.Rows) error {
		var ts *float64
		if err := rows.Scan(&ts); err != nil {
			return err
		}
		ret = append(ret, ts)
		return nil
	}); err != nil {
		return nil, err
	}

	return ret, nil
}
