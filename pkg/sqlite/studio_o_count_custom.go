package sqlite

import (
	"context"
	"fmt"
	"strconv"

	"github.com/doug-martin/goqu/v9"
)

// OCountByStudioIDCustom counts scene O's for a studio, optionally including
// child studios (depth) and limited to one performer, plus O's on releases
// credited to those studios.
func (qb *SceneStore) OCountByStudioIDCustom(ctx context.Context, studioID int, depth *int, performerID *string) (int, error) {
	table := qb.table()
	oHistoryTable := goqu.T(scenesODatesTable)

	q := dialect.Select(goqu.COUNT("*")).From(table).InnerJoin(
		oHistoryTable,
		goqu.On(table.Col(idColumn).Eq(oHistoryTable.Col(sceneIDColumn))),
	)

	releaseStudioWhere, releaseStudioArgs := "r.studio_id = ?", []interface{}{studioID}
	if depth != nil && *depth != 0 {
		valuesClause, err := getHierarchicalValues(ctx, []string{strconv.Itoa(studioID)}, studioTable, "", "parent_id", "child_id", depth)
		if err != nil {
			return 0, err
		}
		q = q.Where(goqu.L(fmt.Sprintf("%s.%s IN (SELECT column2 FROM (%s))", sceneTable, studioIDColumn, valuesClause)))
		releaseStudioWhere, releaseStudioArgs = fmt.Sprintf("r.studio_id IN (SELECT column2 FROM (%s))", valuesClause), nil
	} else {
		q = q.Where(table.Col(studioIDColumn).Eq(studioID))
	}

	if performerID != nil && *performerID != "" {
		performersTable := goqu.T(performersScenesTable)
		q = q.InnerJoin(
			performersTable,
			goqu.On(table.Col(idColumn).Eq(performersTable.Col(sceneIDColumn))),
		).Where(performersTable.Col(performerIDColumn).Eq(*performerID))
	}

	var ret int
	if err := querySimple(ctx, q, &ret); err != nil {
		return 0, err
	}
	releaseCount, err := releaseOCountByStudioCustom(ctx, releaseStudioWhere, releaseStudioArgs, performerID)
	if err != nil {
		return 0, err
	}

	return ret + releaseCount, nil
}

// OCountByStudioIDCustom sums image O's for a studio, optionally including
// child studios (depth) and limited to one performer.
func (qb *ImageStore) OCountByStudioIDCustom(ctx context.Context, studioID int, depth *int, performerID *string) (int, error) {
	table := qb.table()
	q := dialect.Select(goqu.COALESCE(goqu.SUM("o_counter"), 0)).From(table)

	if depth != nil && *depth != 0 {
		valuesClause, err := getHierarchicalValues(ctx, []string{strconv.Itoa(studioID)}, studioTable, "", "parent_id", "child_id", depth)
		if err != nil {
			return 0, err
		}
		q = q.Where(goqu.L(fmt.Sprintf("%s.%s IN (SELECT column2 FROM (%s))", imageTable, studioIDColumn, valuesClause)))
	} else {
		q = q.Where(table.Col(studioIDColumn).Eq(studioID))
	}

	if performerID != nil && *performerID != "" {
		performersTable := goqu.T(performersImagesTable)
		q = q.InnerJoin(
			performersTable,
			goqu.On(table.Col(idColumn).Eq(performersTable.Col(imageIDColumn))),
		).Where(performersTable.Col(performerIDColumn).Eq(*performerID))
	}

	var ret int
	if err := querySimple(ctx, q, &ret); err != nil {
		return 0, err
	}

	return ret, nil
}
