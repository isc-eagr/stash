package api

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/stashapp/stash/pkg/models"
)

// SceneNegativeMarkerCreate creates a new negative marker
func (r *mutationResolver) SceneNegativeMarkerCreate(ctx context.Context, input SceneNegativeMarkerCreateInput) (*models.SceneNegativeMarker, error) {
	name := strings.TrimSpace(input.Name)

	sceneID, err := strconv.Atoi(input.SceneID)
	if err != nil {
		return nil, fmt.Errorf("converting scene id: %w", err)
	}

	startSeconds := input.StartSeconds
	endSeconds := input.EndSeconds

	// Validate that end > start
	if endSeconds <= startSeconds {
		return nil, fmt.Errorf("%w: end_seconds must be greater than start_seconds", ErrInput)
	}

	marker := models.SceneNegativeMarker{
		SceneID:      sceneID,
		Name:         name,
		StartSeconds: startSeconds,
		EndSeconds:   endSeconds,
	}

	if err := r.withTxn(ctx, func(ctx context.Context) error {
		// Verify scene exists
		scene, err := r.repository.Scene.Find(ctx, sceneID)
		if err != nil {
			return err
		}
		if scene == nil {
			return fmt.Errorf("scene %d not found", sceneID)
		}

		return r.repository.SceneNegativeMarker.Create(ctx, &marker)
	}); err != nil {
		return nil, err
	}

	return &marker, nil
}

// SceneNegativeMarkerUpdate updates an existing negative marker
func (r *mutationResolver) SceneNegativeMarkerUpdate(ctx context.Context, input SceneNegativeMarkerUpdateInput) (*models.SceneNegativeMarker, error) {
	id, err := strconv.Atoi(input.ID)
	if err != nil {
		return nil, fmt.Errorf("converting id: %w", err)
	}

	var marker *models.SceneNegativeMarker

	if err := r.withTxn(ctx, func(ctx context.Context) error {
		var err error
		marker, err = r.repository.SceneNegativeMarker.Find(ctx, id)
		if err != nil {
			return err
		}
		if marker == nil {
			return fmt.Errorf("negative marker %d not found", id)
		}

		// Apply updates
		if input.Name != nil {
			marker.Name = strings.TrimSpace(*input.Name)
		}
		if input.StartSeconds != nil {
			marker.StartSeconds = *input.StartSeconds
		}
		if input.EndSeconds != nil {
			marker.EndSeconds = *input.EndSeconds
		}

		// Validate that end > start
		if marker.EndSeconds <= marker.StartSeconds {
			return fmt.Errorf("%w: end_seconds must be greater than start_seconds", ErrInput)
		}

		return r.repository.SceneNegativeMarker.Update(ctx, marker)
	}); err != nil {
		return nil, err
	}

	return marker, nil
}

// SceneNegativeMarkerDestroy deletes a negative marker
func (r *mutationResolver) SceneNegativeMarkerDestroy(ctx context.Context, id string) (bool, error) {
	idInt, err := strconv.Atoi(id)
	if err != nil {
		return false, fmt.Errorf("converting id: %w", err)
	}

	if err := r.withTxn(ctx, func(ctx context.Context) error {
		return r.repository.SceneNegativeMarker.Delete(ctx, idInt)
	}); err != nil {
		return false, err
	}

	return true, nil
}

// FindSceneNegativeMarkers returns negative markers for a scene
func (r *queryResolver) FindSceneNegativeMarkers(ctx context.Context, sceneID string) (ret []*models.SceneNegativeMarker, err error) {
	sceneInt, err := strconv.Atoi(sceneID)
	if err != nil {
		return nil, fmt.Errorf("converting scene id: %w", err)
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.SceneNegativeMarker.FindByScene(ctx, sceneInt)
		return err
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

// SceneNegativeMarkerNames returns distinct negative marker names from all scenes.
func (r *queryResolver) SceneNegativeMarkerNames(ctx context.Context) (ret []string, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.SceneNegativeMarker.FindNames(ctx)
		return err
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

// NegativeMarkers resolver for Scene type
func (r *sceneResolver) NegativeMarkers(ctx context.Context, obj *models.Scene) (ret []*models.SceneNegativeMarker, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.SceneNegativeMarker.FindByScene(ctx, obj.ID)
		return err
	}); err != nil {
		return nil, err
	}

	return ret, nil
}
