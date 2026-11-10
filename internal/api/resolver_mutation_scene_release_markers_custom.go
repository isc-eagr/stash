package api

import (
	"context"
	"fmt"
	"math"
	"slices"
	"strconv"
	"strings"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/sliceutil/stringslice"
)

func parseReleaseMarkerIDsCustom(input SceneReleaseMarkerInput) (releaseID, markerID, primaryTagID int, tagIDs, topIDs, bottomIDs []int, err error) {
	releaseID, err = strconv.Atoi(input.ReleaseID)
	if err != nil {
		return
	}
	if input.ID != nil {
		markerID, err = strconv.Atoi(*input.ID)
		if err != nil {
			return
		}
	}
	primaryTagID, err = strconv.Atoi(input.PrimaryTagID)
	if err != nil {
		return
	}
	tagIDs, err = stringslice.StringSliceToIntSlice(input.TagIds)
	if err != nil {
		return
	}
	topIDs, err = stringslice.StringSliceToIntSlice(input.TopPerformerIds)
	if err != nil {
		return
	}
	bottomIDs, err = stringslice.StringSliceToIntSlice(input.BottomPerformerIds)
	return
}

func (r *mutationResolver) SceneReleaseMarkerSave(ctx context.Context, input SceneReleaseMarkerInput) (*models.SceneMarker, error) {
	releaseID, markerID, primaryTagID, tagIDs, topIDs, bottomIDs, err := parseReleaseMarkerIDsCustom(input)
	if err != nil {
		return nil, fmt.Errorf("invalid release marker ID: %w", err)
	}
	if math.IsNaN(input.Seconds) || math.IsInf(input.Seconds, 0) || input.Seconds < 0 ||
		(input.EndSeconds != nil && (math.IsNaN(*input.EndSeconds) || math.IsInf(*input.EndSeconds, 0) || *input.EndSeconds < input.Seconds)) {
		return nil, fmt.Errorf("invalid release marker time range")
	}
	var savedID int
	err = r.withTxn(ctx, func(ctx context.Context) error {
		release, err := r.repository.SceneRelease.Find(ctx, releaseID)
		if err != nil {
			return err
		}
		if release == nil {
			return fmt.Errorf("release %d not found", releaseID)
		}
		qb := r.repository.SceneMarker
		if markerID == 0 {
			marker := models.NewSceneMarker()
			marker.SceneID = release.SceneID
			marker.Title = strings.TrimSpace(input.Title)
			marker.Seconds = input.Seconds
			marker.EndSeconds = input.EndSeconds
			marker.PrimaryTagID = primaryTagID
			if err := qb.Create(ctx, &marker); err != nil {
				return err
			}
			savedID = marker.ID
			if err := r.repository.SceneRelease.MoveMarkerToReleaseCustom(ctx, savedID, releaseID); err != nil {
				return err
			}
		} else {
			marker, err := qb.Find(ctx, markerID)
			if err != nil {
				return err
			}
			if marker == nil || marker.ReleaseID == nil || *marker.ReleaseID != releaseID {
				return fmt.Errorf("marker %d does not belong to release %d", markerID, releaseID)
			}
			savedID = markerID
			partial := models.NewSceneMarkerPartial()
			partial.Title = models.NewOptionalString(strings.TrimSpace(input.Title))
			partial.Seconds = models.NewOptionalFloat64(input.Seconds)
			partial.EndSeconds = models.NewOptionalFloat64Ptr(input.EndSeconds)
			partial.PrimaryTagID = models.NewOptionalInt(primaryTagID)
			if _, err := qb.UpdatePartial(ctx, savedID, partial); err != nil {
				return err
			}
		}
		tagIDs = slices.DeleteFunc(tagIDs, func(id int) bool { return id == primaryTagID })
		if err := qb.UpdateTags(ctx, savedID, tagIDs); err != nil {
			return err
		}
		if err := qb.UpdateTopPerformers(ctx, savedID, topIDs); err != nil {
			return err
		}
		if err := qb.UpdateBottomPerformers(ctx, savedID, bottomIDs); err != nil {
			return err
		}
		return r.recalculateReleaseAdvisorsCustom(ctx, releaseID)
	})
	if err != nil {
		return nil, err
	}
	return r.getSceneMarker(ctx, savedID)
}

func (r *mutationResolver) SceneReleaseMarkerDestroy(ctx context.Context, releaseIDText, markerIDText string) (bool, error) {
	releaseID, err := strconv.Atoi(releaseIDText)
	if err != nil {
		return false, err
	}
	markerID, err := strconv.Atoi(markerIDText)
	if err != nil {
		return false, err
	}
	err = r.withTxn(ctx, func(ctx context.Context) error {
		marker, err := r.repository.SceneMarker.Find(ctx, markerID)
		if err != nil {
			return err
		}
		if marker == nil || marker.ReleaseID == nil || *marker.ReleaseID != releaseID {
			return fmt.Errorf("marker %d does not belong to release %d", markerID, releaseID)
		}
		if err := r.repository.SceneMarker.Destroy(ctx, markerID); err != nil {
			return err
		}
		return r.recalculateReleaseAdvisorsCustom(ctx, releaseID)
	})
	return err == nil, err
}
