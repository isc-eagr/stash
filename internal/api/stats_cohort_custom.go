package api

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

// JSON arrays avoid SQLite's parameter limit for large dashboard selections.
func statsCohortIDsCustom(ids []string) (string, error) {
	for _, id := range ids {
		parsed, err := strconv.Atoi(id)
		if err != nil || parsed < 1 {
			return "", fmt.Errorf("invalid stats cohort ID: %s", id)
		}
	}
	value, err := json.Marshal(ids)
	return string(value), err
}

func applyStatsCohortCustom(scope string, args []interface{}, cohort *StatsCohortInput) (string, []interface{}, error) {
	if cohort == nil {
		return scope, args, nil
	}
	conditions := ""
	args = append([]interface{}{}, args...)
	if cohort.SceneIds != nil {
		ids, err := statsCohortIDsCustom(cohort.SceneIds)
		if err != nil {
			return "", nil, err
		}
		conditions += "\n  AND scenes.id IN (SELECT CAST(value AS INTEGER) FROM json_each(?))"
		args = append(args, ids)
	}
	if cohort.PerformerIds != nil {
		conditions += "\n  AND EXISTS (SELECT 1 FROM performers_scenes ps WHERE ps.scene_id = scenes.id AND ps.performer_id IN (SELECT id FROM cohort_performers))"
	}
	if conditions != "" {
		end := strings.LastIndex(scope, ")")
		if end < 0 {
			return "", nil, fmt.Errorf("invalid stats scene scope")
		}
		scope = scope[:end] + conditions + "\n" + scope[end:]
	}
	if cohort.PerformerIds != nil {
		ids, err := statsCohortIDsCustom(cohort.PerformerIds)
		if err != nil {
			return "", nil, err
		}
		scope += ",\ncohort_performers(id) AS (SELECT id FROM performers WHERE id IN (SELECT CAST(value AS INTEGER) FROM json_each(?)))"
		args = append(args, ids)
	}
	return scope, args, nil
}
