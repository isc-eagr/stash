package scene

// CUSTOM: nuts and facials by quality for the Vato and Studio Detail Nut tiles,
// counted like the scene card nut report: one event per Orgasm or Facial
// marker he tops (a Facial tag makes it a facial), graded GOAT, then Really
// Hot, else plain.

import (
	"context"
	"strconv"

	"github.com/stashapp/stash/pkg/models"
)

// Quality indexes into NutQualityCountsCustom.
const (
	nutQualityPlainCustom = iota
	nutQualityReallyHotCustom
	nutQualityGoatCustom
)

// NutQualityCountsCustom holds plain, Really Hot, and GOAT counts.
type NutQualityCountsCustom [3]int

type NutTypeCountsCustom struct {
	Nut    NutQualityCountsCustom
	Facial NutQualityCountsCustom
}

func (c *NutTypeCountsCustom) add(facial bool, quality int) {
	if facial {
		c.Facial[quality]++
	} else {
		c.Nut[quality]++
	}
}

func nutQualityCustom(tagIDs []int, goatTags, reallyHotTags map[int]bool) int {
	switch {
	case containsAnyTag(tagIDs, goatTags):
		return nutQualityGoatCustom
	case containsAnyTag(tagIDs, reallyHotTags):
		return nutQualityReallyHotCustom
	default:
		return nutQualityPlainCustom
	}
}

// studioNutMarkerReaderCustom is what StudioNutTypeCountsCustom reads markers through.
type studioNutMarkerReaderCustom interface {
	models.SceneMarkerQueryer
	GetPerformersForMarkers(ctx context.Context, markerIDs []int) (map[int][]*models.MarkerPerformer, error)
	GetTagIDsForMarkers(ctx context.Context, markerIDs []int) (map[int][]int, error)
}

// StudioNutTypeCountsCustom counts a studio's nuts and facials by quality for
// the Studio Detail Nut tile, like the scene card nut report: one event per
// top vato on each Orgasm or Facial marker (one when it has no top), 2nd
// camera and release markers left out.
func StudioNutTypeCountsCustom(
	ctx context.Context,
	markerQB studioNutMarkerReaderCustom,
	sceneQB models.SceneQueryer,
	tagFinder models.TagFinder,
	studioID int,
	depth *int,
	facialTagID, orgasmTagID, secondCameraTagID, goatTagID, reallyHotTagID int,
) (NutTypeCountsCustom, error) {
	var ret NutTypeCountsCustom
	nutTagIDs := []string{}
	for _, id := range []int{facialTagID, orgasmTagID} {
		if id != 0 {
			nutTagIDs = append(nutTagIDs, strconv.Itoa(id))
		}
	}
	if len(nutTagIDs) == 0 {
		return ret, nil
	}
	studioScenes, err := getStudioSceneIDs(ctx, sceneQB, studioID, depth, nil)
	if err != nil || len(studioScenes) == 0 {
		return ret, err
	}

	tagSets := make([]map[int]bool, 5)
	for i, id := range []int{facialTagID, orgasmTagID, secondCameraTagID, goatTagID, reallyHotTagID} {
		if tagSets[i], err = expandedTagSet(ctx, tagFinder, id); err != nil {
			return ret, err
		}
	}
	facialTags, orgasmTags, secondCameraTags, goatTags, reallyHotTags := tagSets[0], tagSets[1], tagSets[2], tagSets[3], tagSets[4]

	allDepth := -1
	allResults := -1
	sortByID := "id"
	markers, _, err := markerQB.Query(ctx, &models.SceneMarkerFilterType{
		Scenes: studioMarkerSceneCriterionCustom(studioScenes),
		Tags: &models.HierarchicalMultiCriterionInput{
			Value:    nutTagIDs,
			Modifier: models.CriterionModifierIncludes,
			Depth:    &allDepth,
		},
	}, &models.FindFilterType{PerPage: &allResults, Sort: &sortByID})
	if err != nil {
		return ret, err
	}
	markerIDs := make([]int, 0, len(markers))
	for _, m := range markers {
		markerIDs = append(markerIDs, m.ID)
	}
	tagsByMarker, err := markerQB.GetTagIDsForMarkers(ctx, markerIDs)
	if err != nil {
		return ret, err
	}
	performersByMarker, err := markerQB.GetPerformersForMarkers(ctx, markerIDs)
	if err != nil {
		return ret, err
	}

	for _, m := range markers {
		if m.ReleaseID != nil || !studioScenes[m.SceneID] {
			continue // release-owned markers stay out of scene stats
		}
		allTagIDs := append([]int{m.PrimaryTagID}, tagsByMarker[m.ID]...)
		if containsAnyTag(allTagIDs, secondCameraTags) {
			continue
		}
		hasFacial := containsAnyTag(allTagIDs, facialTags)
		if !hasFacial && !containsAnyTag(allTagIDs, orgasmTags) {
			continue
		}
		events := 0
		for _, mp := range performersByMarker[m.ID] {
			if mp.Role == "top" {
				events++
			}
		}
		quality := nutQualityCustom(allTagIDs, goatTags, reallyHotTags)
		for i := 0; i < max(events, 1); i++ {
			ret.add(hasFacial, quality)
		}
	}
	return ret, nil
}
