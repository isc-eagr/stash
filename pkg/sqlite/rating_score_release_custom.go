package sqlite

import (
	"context"
	"fmt"
	"strings"

	"github.com/stashapp/stash/pkg/models"
)

func (s *RatingScoreStore) releaseModeCustom(ctx context.Context, releaseID int) (string, error) {
	var performerCount int
	if err := dbWrapper.Get(ctx, &performerCount,
		`SELECT COUNT(DISTINCT performer_id) FROM scene_release_performers WHERE release_id = ?`, releaseID); err != nil {
		return "", err
	}
	if sceneUsesGroupRating(performerCount) {
		return models.RatingSceneModeGroup, nil
	}
	if sceneUsesSoloRatingByCastCustom(performerCount) {
		return models.RatingSceneModeSolo, nil
	}
	isSolo, err := releaseUsesSoloRatingCustom(ctx, releaseID)
	if err != nil {
		return "", err
	}
	if isSolo {
		return models.RatingSceneModeSolo, nil
	}
	return models.RatingSceneModeDefault, nil
}

func releaseUsesSoloRatingCustom(ctx context.Context, releaseID int) (bool, error) {
	upgraded, err := releaseTransferTableExistsCustom(ctx, "scene_release_activity_upgrade_guard")
	if err != nil || !upgraded {
		return false, err
	}
	tags := GetRoleTagIDs()
	if tags.SoloTagID == 0 {
		return false, nil
	}
	ownerQuery := func(tagID int, negated bool) string {
		clause := fmt.Sprintf(`EXISTS (SELECT 1 FROM scene_markers sm
			WHERE sm.release_id = ? AND %s)`, tagHierarchyCondition("sm", tagID))
		if negated {
			return "NOT " + clause
		}
		return clause
	}
	clauses := []string{ownerQuery(tags.SoloTagID, false)}
	args := []any{releaseID}
	if tags.SexTagID != 0 {
		clauses = append(clauses, ownerQuery(tags.SexTagID, true))
		args = append(args, releaseID)
	}
	if tags.OralTagID != 0 {
		clauses = append(clauses, ownerQuery(tags.OralTagID, true))
		args = append(args, releaseID)
	}
	var isSolo bool
	if err := dbWrapper.Get(ctx, &isSolo, "SELECT "+strings.Join(clauses, " AND "), args...); err != nil {
		return false, err
	}
	return isSolo, nil
}
