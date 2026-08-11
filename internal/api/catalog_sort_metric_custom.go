package api

import (
	"context"
	"fmt"
	"strings"

	"github.com/stashapp/stash/internal/manager"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/sqlite"
)

var performerBatchSortMetricsCustom = map[string]bool{
	"play_count":               true,
	"last_played_at":           true,
	"latest_scene":             true,
	"scenes_duration":          true,
	"scenes_size":              true,
	"last_o_at":                true,
	"average_scene_rating":     true,
	"sex_topped_partners":      true,
	"oral_topped_partners":     true,
	"facial_topped_partners":   true,
	"sex_bottomed_partners":    true,
	"oral_bottomed_partners":   true,
	"facial_bottomed_partners": true,
}

var tagBatchSortMetricsCustom = map[string]bool{
	"scenes_duration": true,
	"scenes_size":     true,
}

func queryCatalogSortMetricValuesCustom(
	ctx context.Context,
	table string,
	ids []string,
	expression string,
) ([]*CatalogSortMetricValue, error) {
	idInts, err := handleIDList(ids, "ids")
	if err != nil {
		return nil, err
	}
	if len(idInts) == 0 {
		return []*CatalogSortMetricValue{}, nil
	}

	query := fmt.Sprintf(`
WITH requested(id) AS (VALUES %s)
SELECT %s.id, CAST((%s) AS TEXT)
FROM %s
JOIN requested ON requested.id = %s.id`,
		strings.TrimSuffix(strings.Repeat("(?),", len(idInts)), ","),
		table,
		expression,
		table,
		table,
	)
	args := make([]interface{}, len(idInts))
	for index, id := range idInts {
		args[index] = id
	}

	_, rows, err := manager.GetInstance().Database.QuerySQL(ctx, query, args)
	if err != nil {
		return nil, err
	}

	ret := make([]*CatalogSortMetricValue, 0, len(rows))
	for _, row := range rows {
		if len(row) < 2 {
			continue
		}
		item := &CatalogSortMetricValue{ID: fmt.Sprint(row[0])}
		if row[1] != nil {
			value := fmt.Sprint(row[1])
			if bytes, ok := row[1].([]byte); ok {
				value = string(bytes)
			}
			item.Value = &value
		}
		ret = append(ret, item)
	}
	return ret, nil
}

func groupSortMetricExpressionCustom(parentGroupID *string, direction string) (string, error) {
	expression := `(SELECT groups_relations.order_index
FROM groups_relations
WHERE groups_relations.sub_id = groups.id`
	if parentGroupID != nil {
		parentIDs, err := handleIDList([]string{*parentGroupID}, "parent_group_id")
		if err != nil {
			return "", err
		}
		expression += fmt.Sprintf(" AND groups_relations.containing_id = %d", parentIDs[0])
	}
	expression += fmt.Sprintf(
		" ORDER BY groups_relations.order_index %s LIMIT 1)",
		direction,
	)
	return expression, nil
}

func (r *queryResolver) GroupSortMetricValues(
	ctx context.Context,
	groupIDs []string,
	findFilter *models.FindFilterType,
	parentGroupID *string,
) (ret []*CatalogSortMetricValue, err error) {
	if findFilter == nil || findFilter.GetSort("name") != "sub_group_order" {
		return []*CatalogSortMetricValue{}, nil
	}

	expression, err := groupSortMetricExpressionCustom(
		parentGroupID,
		findFilter.GetDirection(),
	)
	if err != nil {
		return nil, err
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = queryCatalogSortMetricValuesCustom(
			ctx,
			"groups",
			groupIDs,
			expression,
		)
		return err
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

func (r *queryResolver) PerformerSortMetricValues(
	ctx context.Context,
	performerIDs []string,
	findFilter *models.FindFilterType,
) (ret []*CatalogSortMetricValue, err error) {
	sort := "name"
	if findFilter != nil {
		sort = findFilter.GetSort(sort)
	}
	if !performerBatchSortMetricsCustom[sort] {
		return []*CatalogSortMetricValue{}, nil
	}

	expression, err := sqlite.PerformerSortMetricExpressionCustom(sort)
	if err != nil {
		return nil, err
	}
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = queryCatalogSortMetricValuesCustom(
			ctx,
			"performers",
			performerIDs,
			expression,
		)
		return err
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

func (r *queryResolver) TagSortMetricValues(
	ctx context.Context,
	tagIDs []string,
	findFilter *models.FindFilterType,
) (ret []*CatalogSortMetricValue, err error) {
	sort := "name"
	if findFilter != nil {
		sort = findFilter.GetSort(sort)
	}
	if !tagBatchSortMetricsCustom[sort] {
		return []*CatalogSortMetricValue{}, nil
	}

	expression, err := sqlite.TagSortMetricExpressionCustom(sort)
	if err != nil {
		return nil, err
	}
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = queryCatalogSortMetricValuesCustom(
			ctx,
			"tags",
			tagIDs,
			expression,
		)
		return err
	}); err != nil {
		return nil, err
	}
	return ret, nil
}
