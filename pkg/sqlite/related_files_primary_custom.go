package sqlite

import (
	"context"

	"github.com/jmoiron/sqlx"
	"github.com/stashapp/stash/pkg/models"
)

// ensurePrimaryFileCustom repairs legacy zero/multiple-primary associations.
// It preserves a single existing primary, otherwise picks the lowest primary
// file ID (or the lowest file ID when none has the flag).
func ensurePrimaryFileCustom(ctx context.Context, files *relatedFilesTable, ownerID int) error {
	table := files.table.table
	q := dialect.From(table).Select(table.Col(fileIDColumn), table.Col("primary")).
		Where(files.idColumn.Eq(ownerID)).
		Order(table.Col("primary").Desc(), table.Col(fileIDColumn).Asc())
	var chosen models.FileID
	var primaryCount, total int
	if err := queryFunc(ctx, q, false, func(rows *sqlx.Rows) error {
		var id models.FileID
		var primary bool
		if err := rows.Scan(&id, &primary); err != nil {
			return err
		}
		if total == 0 {
			chosen = id
		}
		total++
		if primary {
			primaryCount++
		}
		return nil
	}); err != nil {
		return err
	}
	if total == 0 || primaryCount == 1 {
		return nil
	}
	return files.setPrimary(ctx, ownerID, chosen)
}
