package api

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCustomStatsValueConversion(t *testing.T) {
	for _, test := range []struct {
		name  string
		value interface{}
		want  int
	}{
		{name: "int64", value: int64(12), want: 12},
		{name: "int", value: 13, want: 13},
		{name: "bytes", value: []byte("14"), want: 14},
		{name: "string", value: "15", want: 15},
		{name: "convertible default", value: uint(16), want: 16},
		{name: "invalid", value: "not a number", want: 0},
	} {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.want, customStatsIntValue(test.value))
		})
	}

	assert.Equal(t, "Latino", customStatsStringValue("Latino"))
	assert.Equal(t, "Latino", customStatsStringValue([]byte("Latino")))
	assert.Equal(t, "17", customStatsStringValue(17))
	assert.Equal(t, 1.5, customStatsFloatValue(1.5))
	assert.Equal(t, 2.0, customStatsFloatValue(int64(2)))
	assert.Equal(t, 3.25, customStatsFloatValue([]byte("3.25")))
	assert.Zero(t, customStatsFloatValue("not a number"))
	assert.Zero(t, customStatsFirstInt(nil))
	assert.Zero(t, customStatsFirstInt([][]interface{}{{}}))
	assert.Equal(t, 18, customStatsFirstInt([][]interface{}{{int64(18)}}))
}
