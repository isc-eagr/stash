package api

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSceneStatsEffectiveDateValueCustom(t *testing.T) {
	for _, tc := range []struct {
		effective, scene interface{}
		want             string
	}{
		{"2020-01-01", "2021-01-01", "2020-01-01"},
		{"2020-01-01", nil, "2020-01-01"},
		{nil, "2021-01-01", "2021-01-01"},
		{"  ", "2021-01-01", "2021-01-01"},
		{nil, nil, ""},
	} {
		got := sceneStatsEffectiveDateValueCustom(tc.effective, tc.scene)
		if tc.want == "" {
			require.Nil(t, got)
		} else {
			require.NotNil(t, got)
			require.Equal(t, tc.want, *got)
		}
	}
}
