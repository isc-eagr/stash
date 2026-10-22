package api

import (
	"fmt"
	"strings"
)

// statsMissingTextCustom matches the UI's stable Unknown demographic bucket.
func statsMissingTextCustom(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", "<nil>", "null", "unknown", "__unknown__":
		return true
	default:
		return false
	}
}

// Identifiers come only from the fixed statistics queries, never user input.
func statsMissingTextSQLCustom(column string) string {
	return fmt.Sprintf("(%[1]s IS NULL OR TRIM(%[1]s) = '' OR LOWER(TRIM(%[1]s)) IN ('<nil>', 'null', 'unknown', '__unknown__'))", column)
}
