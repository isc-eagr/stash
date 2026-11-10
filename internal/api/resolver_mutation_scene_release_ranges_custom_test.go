package api

import (
	"math"
	"testing"
)

func TestValidReleaseRangeCustom(t *testing.T) {
	for _, test := range []struct {
		start, end float64
		want       bool
	}{
		{0, 1, true},
		{1.25, 4.5, true},
		{1, 1, false},
		{2, 1, false},
		{-1, 2, false},
		{math.NaN(), 2, false},
		{0, math.Inf(1), false},
	} {
		if got := validReleaseRangeCustom(test.start, test.end); got != test.want {
			t.Errorf("validReleaseRangeCustom(%v, %v) = %v, want %v", test.start, test.end, got, test.want)
		}
	}
}
