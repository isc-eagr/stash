package sqlite

import (
	"context"
	"fmt"
)

// CUSTOM: a performer write that moves a scene between the standard, solo, and
// group rubrics clears its Rating Advisor scores and rating. Doing it here
// covers every writer (edits, bulk edits, Auto Tag, Identify, StashDB changes).
func resetSceneAdvisorOnModeChangeCustom(ctx context.Context, sceneID int, write func() error) error {
	store := NewRatingScoreStore()
	previousMode, err := store.SceneMode(ctx, sceneID)
	if err != nil {
		return fmt.Errorf("detecting scene %d advisor mode: %w", sceneID, err)
	}

	if err := write(); err != nil {
		return err
	}

	updatedMode, err := store.SceneMode(ctx, sceneID)
	if err != nil {
		return fmt.Errorf("detecting updated scene %d advisor mode: %w", sceneID, err)
	}
	if previousMode == updatedMode {
		return nil
	}

	if _, err := store.ResetSceneScores(ctx, sceneID); err != nil {
		return fmt.Errorf("resetting scene %d advisor after %s-to-%s mode change: %w", sceneID, previousMode, updatedMode, err)
	}
	return nil
}
