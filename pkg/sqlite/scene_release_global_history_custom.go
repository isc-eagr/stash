package sqlite

import "context"

// Global totals count release events once while a scene's own history remains
// scoped to its main version.
func (qb *SceneStore) CountAllViews(ctx context.Context) (int, error) {
	mainCount, err := qb.viewDateManager.CountAllViews(ctx)
	if err != nil {
		return 0, err
	}
	exists, err := releaseTransferTableExistsCustom(ctx, "scene_release_view_dates")
	if err != nil || !exists {
		return mainCount, err
	}
	var releaseCount int
	err = dbWrapper.Get(ctx, &releaseCount, `SELECT COUNT(*) FROM scene_release_view_dates`)
	return mainCount + releaseCount, err
}

func (qb *SceneStore) CountUniqueViews(ctx context.Context) (int, error) {
	exists, err := releaseTransferTableExistsCustom(ctx, "scene_release_view_dates")
	if err != nil || !exists {
		if err != nil {
			return 0, err
		}
		return qb.viewDateManager.CountUniqueViews(ctx)
	}
	var count int
	err = dbWrapper.Get(ctx, &count, `SELECT COUNT(*) FROM (
		SELECT scene_id FROM scenes_view_dates
		UNION
		SELECT sr.scene_id FROM scene_release_view_dates rv
		JOIN scene_releases sr ON sr.id = rv.release_id
	)`)
	return count, err
}

func (qb *SceneStore) GetAllOCount(ctx context.Context) (int, error) {
	mainCount, err := qb.oDateManager.GetAllOCount(ctx)
	if err != nil {
		return 0, err
	}
	exists, err := releaseTransferTableExistsCustom(ctx, "scene_release_o_dates")
	if err != nil || !exists {
		return mainCount, err
	}
	var releaseCount int
	err = dbWrapper.Get(ctx, &releaseCount, `SELECT COUNT(*) FROM scene_release_o_dates`)
	return mainCount + releaseCount, err
}
