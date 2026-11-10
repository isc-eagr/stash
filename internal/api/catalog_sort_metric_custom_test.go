package api

import (
	"strings"
	"testing"
)

func TestGroupSortMetricExpressionCustomScopesParentAndDirection(t *testing.T) {
	t.Parallel()

	parentID := "38"
	expression, err := groupSortMetricExpressionCustom(&parentID, "DESC")
	if err != nil {
		t.Fatalf("group sort expression: %v", err)
	}
	if !strings.Contains(expression, "groups_relations.containing_id = 38") {
		t.Fatalf("parent group was not applied: %s", expression)
	}
	if !strings.Contains(expression, "order_index DESC") {
		t.Fatalf("sort direction was not applied: %s", expression)
	}
}

func TestGroupSortMetricExpressionCustomRejectsInvalidParent(t *testing.T) {
	t.Parallel()

	parentID := "not-an-id"
	if _, err := groupSortMetricExpressionCustom(&parentID, "ASC"); err == nil {
		t.Fatal("expected invalid parent group ID to be rejected")
	}
}
