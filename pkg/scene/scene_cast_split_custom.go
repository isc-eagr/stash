package scene

import (
	"context"

	"github.com/stashapp/stash/pkg/models"
)

// SceneCastSplitCustom counts scenes by vato count: Solo (0-1, an anomaly
// for sex/oral scenes), Standard (2), Threesome (3), Group (4+).
type SceneCastSplitCustom struct {
	Solo      int
	Standard  int
	Threesome int
	Group     int
}

// SplitScenesByCastSizeCustom buckets scenes by their performer count.
func SplitScenesByCastSizeCustom(sceneIDs map[int]bool, performerCounts map[int]int) SceneCastSplitCustom {
	var ret SceneCastSplitCustom
	for id := range sceneIDs {
		switch n := performerCounts[id]; {
		case n <= 1:
			ret.Solo++
		case n == 2:
			ret.Standard++
		case n == 3:
			ret.Threesome++
		default:
			ret.Group++
		}
	}
	return ret
}

// oralOnlyScenesCustom drops sex scenes from oral scenes, like the Oral tile count.
func oralOnlyScenesCustom(oral, sex map[int]bool) map[int]bool {
	ret := make(map[int]bool, len(oral))
	for id := range oral {
		if !sex[id] {
			ret[id] = true
		}
	}
	return ret
}

// PerformerSexOralScenesCustom returns the performer's sex scenes and
// oral-only scenes, matching the Sex and Oral tile counts.
func PerformerSexOralScenesCustom(ctx context.Context, r models.SceneMarkerQueryer, performerID, sexTagID, oralTagID int) (sex, oral map[int]bool, err error) {
	sex, err = getScenesByPerformerMarkerRole(ctx, r, performerID, sexTagID, "")
	if err != nil {
		return nil, nil, err
	}
	rawOral, err := getScenesByPerformerMarkerRole(ctx, r, performerID, oralTagID, "")
	if err != nil {
		return nil, nil, err
	}
	return sex, oralOnlyScenesCustom(rawOral, sex), nil
}

// StudioSexOralScenesCustom returns a studio's sex scenes and oral-only
// scenes, matching GetStudioRoleCounts.
func StudioSexOralScenesCustom(ctx context.Context, markerQB models.SceneMarkerQueryer, sceneQB models.SceneQueryer, studioID int, depth *int, sexTagID, oralTagID int) (sex, oral map[int]bool, err error) {
	sex, oral = map[int]bool{}, map[int]bool{}
	studioScenes, err := getStudioSceneIDs(ctx, sceneQB, studioID, depth, nil)
	if err != nil || len(studioScenes) == 0 {
		return sex, oral, err
	}
	if sexTagID != 0 {
		if sex, err = getStudioScenesWithMarkerTag(ctx, markerQB, studioScenes, sexTagID, "", nil); err != nil {
			return nil, nil, err
		}
	}
	if oralTagID != 0 {
		rawOral, err := getStudioScenesWithMarkerTag(ctx, markerQB, studioScenes, oralTagID, "", nil)
		if err != nil {
			return nil, nil, err
		}
		oral = oralOnlyScenesCustom(rawOral, sex)
	}
	return sex, oral, nil
}
