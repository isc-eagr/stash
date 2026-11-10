package sqlite

import (
	"context"

	"github.com/stashapp/stash/pkg/models"
)

// QueryDurationCustom sums matching marker ranges without hydrating every marker
// or sorting the full result. The ID subquery preserves filter/search semantics
// and prevents joins from counting the same marker more than once.
func (qb *SceneMarkerStore) QueryDurationCustom(ctx context.Context, filter *models.SceneMarkerFilterType, findFilter *models.FindFilterType) (float64, error) {
	search := &models.FindFilterType{}
	if findFilter != nil {
		search.Q = findFilter.Q
	}
	query, err := qb.makeQuery(ctx, filter, search)
	if err != nil {
		return 0, err
	}
	sql := `SELECT COALESCE(SUM(CASE WHEN end_seconds > seconds
		THEN end_seconds - seconds ELSE 0 END), 0)
		FROM scene_markers WHERE id IN (` + query.toSQL(false) + `)`
	var duration float64
	err = dbWrapper.Get(ctx, &duration, sql, query.allArgs()...)
	return duration, err
}
