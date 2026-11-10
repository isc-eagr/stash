package sqlite

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSceneUsesSoloRatingByCastCustom(t *testing.T) {
	assert.False(t, sceneUsesSoloRatingByCastCustom(0))
	assert.True(t, sceneUsesSoloRatingByCastCustom(1))
	assert.False(t, sceneUsesSoloRatingByCastCustom(2))
	assert.False(t, sceneUsesSoloRatingByCastCustom(4))
}
