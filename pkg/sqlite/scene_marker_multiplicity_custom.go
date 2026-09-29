package sqlite

import "fmt"

// Most marker groups require one match. EXISTS stops at that match instead of
// evaluating expensive effective-tag/performer conditions on every marker.
func sceneMarkerMultiplicityClauseCustom(table, condition string, count int) (string, []any) {
	if count == 1 {
		return fmt.Sprintf("EXISTS (SELECT 1 FROM scene_markers sm WHERE sm.scene_id = %s.id AND %s)", table, condition), nil
	}
	return fmt.Sprintf("(SELECT COUNT(DISTINCT sm.id) FROM scene_markers sm WHERE sm.scene_id = %s.id AND %s) >= ?", table, condition), []any{count}
}
