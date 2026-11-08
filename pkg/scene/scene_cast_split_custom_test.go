package scene

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// 0-1 vatos go to Solo, then Standard 2, Threesome 3, Group 4+.
func TestSplitScenesByCastSizeCustom(t *testing.T) {
	scenes := map[int]bool{1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true}
	counts := map[int]int{1: 1, 2: 2, 3: 2, 4: 3, 5: 4, 6: 9}
	assert.Equal(t,
		SceneCastSplitCustom{Solo: 2, Standard: 2, Threesome: 1, Group: 2},
		SplitScenesByCastSizeCustom(scenes, counts),
	)
	assert.Equal(t, SceneCastSplitCustom{}, SplitScenesByCastSizeCustom(nil, counts))
}

// Oral-only scenes drop scenes that also have sex markers.
func TestOralOnlyScenesCustom(t *testing.T) {
	assert.Equal(t,
		map[int]bool{2: true},
		oralOnlyScenesCustom(map[int]bool{1: true, 2: true}, map[int]bool{1: true, 3: true}),
	)
}
