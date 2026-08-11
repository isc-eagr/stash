package sqlite

import (
	"strings"
	"testing"
)

func TestCatalogSortExpressionFromOrderCustom(t *testing.T) {
	t.Parallel()

	expression, err := catalogSortExpressionFromOrderCustom(
		" ORDER BY (SELECT COUNT(*) FROM sample WHERE sample.id = performers.id) ASC, COALESCE(performers.name, performers.id) COLLATE NATURAL_CI ASC",
		"ASC",
	)
	if err != nil {
		t.Fatalf("extract expression: %v", err)
	}
	if expression != "(SELECT COUNT(*) FROM sample WHERE sample.id = performers.id)" {
		t.Fatalf("unexpected expression: %s", expression)
	}
}

func TestCatalogSortMetricExpressionsReuseValidatedSorts(t *testing.T) {
	t.Parallel()

	performerExpression, err := PerformerSortMetricExpressionCustom("scenes_duration")
	if err != nil {
		t.Fatalf("performer expression: %v", err)
	}
	if !strings.Contains(performerExpression, "video_files.duration") {
		t.Fatalf("performer expression did not use scene duration: %s", performerExpression)
	}

	performerSceneAverageExpression, err := PerformerSortMetricExpressionCustom("average_scene_rating")
	if err != nil {
		t.Fatalf("performer scene average expression: %v", err)
	}
	if !strings.Contains(performerSceneAverageExpression, "AVG(performer_rating_scene.rating)") {
		t.Fatalf("performer expression did not use the scene rating average: %s", performerSceneAverageExpression)
	}
	if !strings.Contains(performerSceneAverageExpression, "soloPerformerAppeal") ||
		!strings.Contains(performerSceneAverageExpression, "topAttractiveness") ||
		!strings.Contains(performerSceneAverageExpression, "groupTopAttractiveness") {
		t.Fatalf("performer expression did not include every Rating Advisor rubric: %s", performerSceneAverageExpression)
	}

	tagExpression, err := TagSortMetricExpressionCustom("scenes_size")
	if err != nil {
		t.Fatalf("tag expression: %v", err)
	}
	if !strings.Contains(tagExpression, "files.size") {
		t.Fatalf("tag expression did not use scene file size: %s", tagExpression)
	}
}

func TestCatalogSortMetricExpressionRejectsUnknownSort(t *testing.T) {
	t.Parallel()

	if _, err := PerformerSortMetricExpressionCustom("definitely_not_a_sort"); err == nil {
		t.Fatal("expected unknown performer sort to be rejected")
	}
}
