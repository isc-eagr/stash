package sqlite

import (
	"context"
	"time"

	"github.com/stashapp/stash/pkg/models"
)

func (t *viewHistoryTable) resultDatesCustom(ctx context.Context, id int) ([]time.Time, error) {
	if !models.HistoryMutationCountOnlyCustom(ctx) {
		return t.getDates(ctx, id)
	}

	count, err := t.getCount(ctx, id)
	if err != nil {
		return nil, err
	}

	models.SetHistoryMutationResultCountCustom(ctx, count)
	return nil, nil
}
