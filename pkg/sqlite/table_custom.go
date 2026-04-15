package sqlite

// CUSTOM: Transfer dates between entities (used for o-history merging).

import (
	"context"
	"fmt"

	"github.com/doug-martin/goqu/v9"
)

func (t *viewHistoryTable) transferDates(ctx context.Context, fromID int, toID int) error {
	table := t.table.table

	// Use Set with the identifier expression directly using SET clause
	q := dialect.Update(table).Set(
		goqu.C(t.idColumn.GetCol().(string)).Set(toID),
	).Where(t.idColumn.Eq(fromID))

	if _, err := exec(ctx, q); err != nil {
		return fmt.Errorf("transferring dates from %d to %d: %w", fromID, toID, err)
	}

	return nil
}
