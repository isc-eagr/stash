package sqlite

// CUSTOM: Legacy scene marker imports can contain Go's zero timestamp even
// though the database and GraphQL schemas declare marker timestamps non-null.

import "time"

func resolveSceneMarkerTimestampCustom(value time.Time, fallback time.Time) time.Time {
	if !value.IsZero() {
		return value
	}
	if !fallback.IsZero() {
		return fallback
	}

	return time.Unix(0, 0).UTC()
}
