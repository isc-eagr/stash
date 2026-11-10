package sqlite

import (
	"fmt"
	"strings"

	"github.com/stashapp/stash/pkg/models"
)

// CUSTOM: Extract the primary SQL expression from a validated catalog sort.
// This lets the API return the exact value shown on each card without
// duplicating the sort formulas.
func catalogSortExpressionFromOrderCustom(orderBy, direction string) (string, error) {
	const prefix = " ORDER BY "
	if !strings.HasPrefix(orderBy, prefix) {
		return "", fmt.Errorf("invalid catalog sort clause")
	}

	body := strings.TrimPrefix(orderBy, prefix)
	delimiter := " " + getSortDirection(direction) + ", COALESCE("
	index := strings.LastIndex(body, delimiter)
	if index < 0 {
		return "", fmt.Errorf("catalog sort clause is missing its stable fallback")
	}

	expression := strings.TrimSpace(body[:index])
	if expression == "" {
		return "", fmt.Errorf("catalog sort expression is empty")
	}
	return expression, nil
}

// PerformerSortMetricExpressionCustom returns the same global expression used
// by the performer list for the requested sort. Studio-scoped role values are
// already supplied by the existing performer-card stats payload instead.
func PerformerSortMetricExpressionCustom(sort string) (string, error) {
	direction := models.SortDirectionEnumAsc
	filter := &models.FindFilterType{Sort: &sort, Direction: &direction}
	orderBy, err := (&PerformerStore{}).getPerformerSort(filter, nil)
	if err != nil {
		return "", err
	}
	return catalogSortExpressionFromOrderCustom(orderBy, direction.String())
}

// TagSortMetricExpressionCustom returns the same expression used by the tag
// list for aggregate scene duration and size sorts.
func TagSortMetricExpressionCustom(sort string) (string, error) {
	direction := models.SortDirectionEnumAsc
	filter := &models.FindFilterType{Sort: &sort, Direction: &direction}
	orderBy, err := (&TagStore{}).getTagSort(&queryBuilder{}, filter)
	if err != nil {
		return "", err
	}
	return catalogSortExpressionFromOrderCustom(orderBy, direction.String())
}
