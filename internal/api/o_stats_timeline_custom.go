package api

import (
	"context"
	"fmt"

	"github.com/stashapp/stash/internal/manager"
)

// A page cap bounds scene/tag/ordinal hydration as well as SQL results.
func validateSceneOEventPageCustom(page, perPage int) error {
	if page < 1 || page > 2147483647 || perPage < 1 || perPage > 100 {
		return fmt.Errorf("O timeline needs a positive page and 1–100 events per page")
	}
	return nil
}

func sceneOEventPageFromCustom(scope string) string {
	return ` FROM scenes_o_dates od
JOIN scenes s ON s.id = od.scene_id
WHERE od.o_date IS NOT NULL` + scope
}

func sceneOEventPageQueryCustom(scope string) string {
	return `SELECT od.rowid, od.scene_id, od.o_date, od.video_timestamp` + sceneOEventPageFromCustom(scope) + `
ORDER BY julianday(od.o_date) DESC, COALESCE(od.video_timestamp, -1) DESC, od.rowid DESC
LIMIT ? OFFSET ?`
}

func sceneOEventPageNumberCustom(page, perPage, count int) int {
	last := 1
	if count > 0 {
		last = (count-1)/perPage + 1
	}
	if page > last {
		return last
	}
	return page
}

func (r *queryResolver) SceneOEvents(ctx context.Context, page int, perPage int, studioID *string, depth *int, dateRange *StatsDateRangeInput) (ret *SceneOEventPage, err error) {
	if err := validateSceneOEventPageCustom(page, perPage); err != nil {
		return nil, err
	}
	scope, args, err := sceneOStatsScopeCustom(studioID, depth, dateRange)
	if err != nil {
		return nil, err
	}
	ret = &SceneOEventPage{Events: []*SceneOEvent{}}
	err = r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		_, rows, err := db.QuerySQL(ctx, "SELECT COUNT(*)"+sceneOEventPageFromCustom(scope), args)
		if err != nil {
			return err
		}
		ret.Count = customIntValue(rows[0][0])
		ret.Page = sceneOEventPageNumberCustom(page, perPage, ret.Count)
		pageArgs := append(append([]interface{}{}, args...), perPage, (ret.Page-1)*perPage)
		_, rows, err = db.QuerySQL(ctx, sceneOEventPageQueryCustom(scope), pageArgs)
		if err != nil {
			return err
		}
		ret.Events, err = r.sceneOEventsFromRows(ctx, rows)
		return err
	})
	if err != nil {
		return nil, err
	}
	return ret, nil
}
