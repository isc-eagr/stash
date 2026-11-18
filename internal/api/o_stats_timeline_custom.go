package api

import (
	"context"
	"fmt"

	"github.com/stashapp/stash/internal/manager"
	"github.com/stashapp/stash/pkg/sqlite"
)

// A page cap bounds scene/tag/ordinal hydration as well as SQL results.
func validateSceneOEventPageCustom(page, perPage int) error {
	if page < 1 || page > 2147483647 || perPage < 1 || perPage > 100 {
		return fmt.Errorf("O timeline needs a positive page and 1–100 events per page")
	}
	return nil
}

func sceneOEventPageFromCustom(scope string) string {
	return ` FROM ` + sqlite.SceneOEventsSQLCustom() + ` od
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

// An offset replaces paging so O Stats can merge another instance's timeline.
func (r *queryResolver) SceneOEvents(ctx context.Context, page int, perPage int, studioID *string, depth *int, dateRange *StatsDateRangeInput, offset *int) (ret *SceneOEventPage, err error) {
	if err := validateSceneOEventPageCustom(page, perPage); err != nil {
		return nil, err
	}
	if offset != nil && *offset < 0 {
		return nil, fmt.Errorf("O timeline offset must not be negative")
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
		skip := (ret.Page - 1) * perPage
		if offset != nil {
			skip = *offset
			ret.Page = skip/perPage + 1
		}
		pageArgs := append(append([]interface{}{}, args...), perPage, skip)
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

// sceneOEventMomentsQueryCustom lists dated O's in the sceneOEvents order, with
// a UTC time to interleave instances and the local day the charts use.
func sceneOEventMomentsQueryCustom(scope string) string {
	return `SELECT strftime('%Y-%m-%dT%H:%M:%fZ', od.o_date) AS at, date(od.o_date, 'localtime') AS day` +
		sceneOEventPageFromCustom(scope) + `
ORDER BY julianday(od.o_date) DESC, COALESCE(od.video_timestamp, -1) DESC, od.rowid DESC`
}

func (r *queryResolver) SceneOEventMoments(ctx context.Context, studioID *string, depth *int, dateRange *StatsDateRangeInput) (ret []*SceneOEventMoment, err error) {
	scope, args, err := sceneOStatsScopeCustom(studioID, depth, dateRange)
	if err != nil {
		return nil, err
	}
	err = r.withReadTxn(ctx, func(ctx context.Context) error {
		_, rows, err := manager.GetInstance().Database.QuerySQL(ctx, sceneOEventMomentsQueryCustom(scope), args)
		if err != nil {
			return err
		}
		ret = make([]*SceneOEventMoment, 0, len(rows))
		for _, row := range rows {
			if len(row) < 2 || row[0] == nil || row[1] == nil {
				continue
			}
			ret = append(ret, &SceneOEventMoment{At: customStringValue(row[0]), Day: customStringValue(row[1])})
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return ret, nil
}
