package sqlite

// CUSTOM: batched scene totals used by performer role insights.

import (
	"context"

	"github.com/doug-martin/goqu/v9"
)

type performerSceneCountRowCustom struct {
	PerformerID int `db:"performer_id"`
	SceneCount  int `db:"scene_count"`
}

// CountByPerformerIDs returns attached-scene totals for several performers in
// one query so scene-card insight grids do not create an N+1 query pattern.
func (qb *SceneStore) CountByPerformerIDs(ctx context.Context, performerIDs []int) (map[int]int, error) {
	performerIDs = uniquePositiveInts(performerIDs)
	ret := make(map[int]int, len(performerIDs))
	if len(performerIDs) == 0 {
		return ret, nil
	}

	const chunkSize = 900
	for start := 0; start < len(performerIDs); start += chunkSize {
		end := start + chunkSize
		if end > len(performerIDs) {
			end = len(performerIDs)
		}
		query := dialect.
			From(scenesPerformersJoinTable).
			Select(
				scenesPerformersJoinTable.Col(performerIDColumn),
				goqu.COUNT("*").As("scene_count"),
			).
			Where(scenesPerformersJoinTable.Col(performerIDColumn).In(performerIDs[start:end])).
			GroupBy(scenesPerformersJoinTable.Col(performerIDColumn))
		sql, args, err := query.ToSQL()
		if err != nil {
			return nil, err
		}

		var rows []performerSceneCountRowCustom
		if err := dbWrapper.Select(ctx, &rows, sql, args...); err != nil {
			return nil, err
		}
		for _, row := range rows {
			ret[row.PerformerID] = row.SceneCount
		}
	}
	return ret, nil
}
