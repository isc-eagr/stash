package sqlite

// CUSTOM: Transfer o-history between entities.

import "context"

func (qb *oDateManager) TransferOHistory(ctx context.Context, fromID int, toID int) error {
	return qb.tableMgr.transferDates(ctx, fromID, toID)
}
