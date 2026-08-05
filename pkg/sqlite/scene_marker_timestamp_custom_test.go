package sqlite

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestResolveSceneMarkerTimestampCustom(t *testing.T) {
	value := time.Date(2025, time.January, 2, 3, 4, 5, 0, time.UTC)
	fallback := time.Date(2026, time.February, 3, 4, 5, 6, 0, time.UTC)

	t.Run("keeps the stored timestamp", func(t *testing.T) {
		assert.Equal(t, value, resolveSceneMarkerTimestampCustom(value, fallback))
	})

	t.Run("uses the other marker timestamp for legacy zero values", func(t *testing.T) {
		assert.Equal(t, fallback, resolveSceneMarkerTimestampCustom(time.Time{}, fallback))
	})

	t.Run("keeps the GraphQL non-null contract when both values are zero", func(t *testing.T) {
		resolved := resolveSceneMarkerTimestampCustom(time.Time{}, time.Time{})

		assert.False(t, resolved.IsZero())
		assert.Equal(t, time.Unix(0, 0).UTC(), resolved)
	})
}

func TestSceneMarkerRowResolveLegacyTimestampCustom(t *testing.T) {
	updatedAt := time.Date(2026, time.July, 21, 12, 15, 54, 0, time.UTC)
	row := sceneMarkerRow{
		CreatedAt: Timestamp{},
		UpdatedAt: Timestamp{Timestamp: updatedAt},
	}

	marker := row.resolve()

	assert.Equal(t, updatedAt, marker.CreatedAt)
	assert.Equal(t, updatedAt, marker.UpdatedAt)
}
