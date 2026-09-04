package scene

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/stashapp/stash/pkg/models"
)

// GetPerformerMarkerRolesForSceneBatch calculates marker roles for every marker
// participant in a scene while loading markers, tag descendants, and marker
// associations only once.
func GetPerformerMarkerRolesForSceneBatch(ctx context.Context, r models.SceneMarkerReader, tagFinder models.TagFinder, sceneID int, sexTagID int, oralTagID int, soloTagID int, facialTagID int, orgasmTagID int, feetTagID int, secondCameraTagID int) (map[int][]string, error) {
	markers, err := r.FindBySceneID(ctx, sceneID)
	if err != nil {
		return nil, err
	}

	ret := make(map[int][]string)
	if len(markers) == 0 {
		return ret, nil
	}

	configuredTagIDs := []int{sexTagID, oralTagID, soloTagID, facialTagID, orgasmTagID, feetTagID, secondCameraTagID}
	tagSets := make([]map[int]bool, len(configuredTagIDs))
	for i, tagID := range configuredTagIDs {
		tagSets[i] = make(map[int]bool)
		if tagID == 0 {
			continue
		}

		tagSets[i][tagID] = true
		descendants, err := tagFinder.FindAllDescendants(ctx, tagID, nil)
		if err != nil {
			return nil, err
		}
		for _, descendant := range descendants {
			tagSets[i][descendant.ID] = true
		}
	}

	markerIDs := make([]int, len(markers))
	for i, marker := range markers {
		markerIDs[i] = marker.ID
	}

	performersByMarker, err := r.GetPerformersForMarkers(ctx, markerIDs)
	if err != nil {
		return nil, err
	}
	tagsByMarker, err := r.GetTagIDsForMarkers(ctx, markerIDs)
	if err != nil {
		return nil, err
	}

	accumulators := make(map[int]*performerMarkerRolesAccumulatorCustom)
	for _, marker := range markers {
		performers := performersByMarker[marker.ID]
		markerTagIDs := append([]int{marker.PrimaryTagID}, tagsByMarker[marker.ID]...)
		markerIsSecondCamera := markerHasRoleTagCustom(markerTagIDs, tagSets[6])
		markerStates := make(map[int]*performerMarkerStateCustom)

		for _, performer := range performers {
			acc := getPerformerMarkerRolesAccumulatorCustom(accumulators, performer.PerformerID)
			state := markerStates[performer.PerformerID]
			if state == nil {
				state = &performerMarkerStateCustom{}
				markerStates[performer.PerformerID] = state
			}
			if performer.Role == "top" {
				state.wasTop = true
			} else if performer.Role == "bottom" {
				state.wasBottom = true
			}

			matchedOrgasm := false
			matchedFeet := false
			matchedFacialTop := false
			matchedFacialBottom := false
			for _, tagID := range markerTagIDs {
				if tagSets[0][tagID] {
					state.matchedSex = true
					if performer.Role == "top" {
						acc.roles = appendIfNotExists(acc.roles, "sex_top")
					} else if performer.Role == "bottom" {
						acc.roles = appendIfNotExists(acc.roles, "sex_bottom")
					}
				}
				if tagSets[1][tagID] {
					state.matchedOral = true
					if performer.Role == "top" {
						acc.roles = appendIfNotExists(acc.roles, "oral_top")
					} else if performer.Role == "bottom" {
						acc.roles = appendIfNotExists(acc.roles, "oral_bottom")
					}
				}
				if tagSets[2][tagID] && performer.Role == "top" {
					acc.roles = appendIfNotExists(acc.roles, "solo")
				}
				if tagSets[3][tagID] {
					if performer.Role == "top" {
						state.matchedFacial = true
						matchedFacialTop = true
					} else if performer.Role == "bottom" {
						state.matchedFacial = true
						matchedFacialBottom = true
					}
				}
				matchedOrgasm = matchedOrgasm || (tagSets[4][tagID] && performer.Role == "top")
				matchedFeet = matchedFeet || (tagSets[5][tagID] && performer.Role == "top")
			}

			if !markerIsSecondCamera {
				if matchedOrgasm {
					acc.orgasmTopCount++
				}
				if matchedFacialTop {
					acc.facialTopCount++
				}
				if matchedFacialBottom {
					acc.facialBottomCount++
				}
			}
			if matchedFeet {
				acc.feetTopCount++
			}
		}

		for performerID, state := range markerStates {
			acc := accumulators[performerID]
			for _, partner := range performers {
				if partner.PerformerID == performerID {
					continue
				}
				if state.wasTop && partner.Role == "bottom" {
					addMarkerPartnerCustom(acc, state, partner.PerformerID, true)
				}
				if state.wasBottom && partner.Role == "top" {
					addMarkerPartnerCustom(acc, state, partner.PerformerID, false)
				}
			}
			if state.matchedFacial && !markerIsSecondCamera {
				acc.facialMarkerIDs[marker.ID] = true
			}
		}
	}

	for performerID, acc := range accumulators {
		ret[performerID] = acc.finalizeCustom()
	}

	return ret, nil
}

type performerMarkerStateCustom struct {
	matchedSex    bool
	matchedOral   bool
	matchedFacial bool
	wasTop        bool
	wasBottom     bool
}

type performerMarkerRolesAccumulatorCustom struct {
	roles                  []string
	orgasmTopCount         int
	feetTopCount           int
	facialTopCount         int
	facialBottomCount      int
	facialMarkerIDs        map[int]bool
	sexTopPartnerIDs       map[int]bool
	sexBottomPartnerIDs    map[int]bool
	oralTopPartnerIDs      map[int]bool
	oralBottomPartnerIDs   map[int]bool
	facialTopPartnerIDs    map[int]bool
	facialBottomPartnerIDs map[int]bool
}

func getPerformerMarkerRolesAccumulatorCustom(accumulators map[int]*performerMarkerRolesAccumulatorCustom, performerID int) *performerMarkerRolesAccumulatorCustom {
	if ret := accumulators[performerID]; ret != nil {
		return ret
	}
	ret := &performerMarkerRolesAccumulatorCustom{
		roles:                  []string{},
		facialMarkerIDs:        make(map[int]bool),
		sexTopPartnerIDs:       make(map[int]bool),
		sexBottomPartnerIDs:    make(map[int]bool),
		oralTopPartnerIDs:      make(map[int]bool),
		oralBottomPartnerIDs:   make(map[int]bool),
		facialTopPartnerIDs:    make(map[int]bool),
		facialBottomPartnerIDs: make(map[int]bool),
	}
	accumulators[performerID] = ret
	return ret
}

func markerHasRoleTagCustom(tagIDs []int, tagSet map[int]bool) bool {
	for _, tagID := range tagIDs {
		if tagSet[tagID] {
			return true
		}
	}
	return false
}

func addMarkerPartnerCustom(acc *performerMarkerRolesAccumulatorCustom, state *performerMarkerStateCustom, partnerID int, performerWasTop bool) {
	if state.matchedSex {
		if performerWasTop {
			acc.sexTopPartnerIDs[partnerID] = true
		} else {
			acc.sexBottomPartnerIDs[partnerID] = true
		}
	}
	if state.matchedOral {
		if performerWasTop {
			acc.oralTopPartnerIDs[partnerID] = true
		} else {
			acc.oralBottomPartnerIDs[partnerID] = true
		}
	}
	if state.matchedFacial {
		if performerWasTop {
			acc.facialTopPartnerIDs[partnerID] = true
		} else {
			acc.facialBottomPartnerIDs[partnerID] = true
		}
	}
}

func (a *performerMarkerRolesAccumulatorCustom) finalizeCustom() []string {
	ret := a.roles
	ret = appendCountRoleCustom(ret, "facial_top_", a.facialTopCount)
	ret = appendCountRoleCustom(ret, "facial_bottom_", a.facialBottomCount)
	ret = appendCountRoleCustom(ret, "facial_unique_", len(a.facialMarkerIDs))
	ret = appendPartnerCountsCustom(ret, "sex", a.sexTopPartnerIDs, a.sexBottomPartnerIDs)
	ret = appendPartnerCountsCustom(ret, "oral", a.oralTopPartnerIDs, a.oralBottomPartnerIDs)
	ret = appendPartnerCountsCustom(ret, "facial", a.facialTopPartnerIDs, a.facialBottomPartnerIDs)
	ret = appendPartnerIDsCustom(ret, "sex_top_pids:", a.sexTopPartnerIDs)
	ret = appendPartnerIDsCustom(ret, "sex_bottom_pids:", a.sexBottomPartnerIDs)
	ret = appendPartnerIDsCustom(ret, "oral_top_pids:", a.oralTopPartnerIDs)
	ret = appendPartnerIDsCustom(ret, "oral_bottom_pids:", a.oralBottomPartnerIDs)
	ret = appendPartnerIDsCustom(ret, "facial_top_pids:", a.facialTopPartnerIDs)
	ret = appendPartnerIDsCustom(ret, "facial_bottom_pids:", a.facialBottomPartnerIDs)
	ret = appendCountRoleCustom(ret, "orgasm_top_", a.orgasmTopCount)
	return appendCountRoleCustom(ret, "feet_top_", a.feetTopCount)
}

func appendCountRoleCustom(roles []string, prefix string, count int) []string {
	if count > 0 {
		roles = append(roles, fmt.Sprintf("%s%d", prefix, count))
	}
	return roles
}

func appendPartnerCountsCustom(roles []string, category string, topIDs, bottomIDs map[int]bool) []string {
	roles = appendCountRoleCustom(roles, category+"_top_partners_", len(topIDs))
	roles = appendCountRoleCustom(roles, category+"_bottom_partners_", len(bottomIDs))
	allIDs := make(map[int]bool, len(topIDs)+len(bottomIDs))
	for id := range topIDs {
		allIDs[id] = true
	}
	for id := range bottomIDs {
		allIDs[id] = true
	}
	return appendCountRoleCustom(roles, category+"_all_partners_", len(allIDs))
}

func appendPartnerIDsCustom(roles []string, prefix string, ids map[int]bool) []string {
	if len(ids) == 0 {
		return roles
	}
	sortedIDs := make([]int, 0, len(ids))
	for id := range ids {
		sortedIDs = append(sortedIDs, id)
	}
	sort.Ints(sortedIDs)
	parts := make([]string, len(sortedIDs))
	for i, id := range sortedIDs {
		parts[i] = strconv.Itoa(id)
	}
	return append(roles, prefix+strings.Join(parts, ","))
}

// GetPerformerMarkerRolesForScene returns one performer's roles using the
// scene-wide batch implementation retained for GraphQL compatibility.
func GetPerformerMarkerRolesForScene(ctx context.Context, r models.SceneMarkerReader, tagFinder models.TagFinder, performerID int, sceneID int, sexTagID int, oralTagID int, soloTagID int, facialTagID int, orgasmTagID int, feetTagID int, secondCameraTagID int) ([]string, error) {
	rolesByPerformer, err := GetPerformerMarkerRolesForSceneBatch(ctx, r, tagFinder, sceneID, sexTagID, oralTagID, soloTagID, facialTagID, orgasmTagID, feetTagID, secondCameraTagID)
	if err != nil {
		return nil, err
	}

	roles := rolesByPerformer[performerID]
	if roles == nil {
		roles = []string{}
	}
	return roles, nil
}
