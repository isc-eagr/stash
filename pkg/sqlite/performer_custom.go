package sqlite

// CUSTOM: Methods for performer store supporting scene marker performers, image blob operations,
// and role-based metric sort options.

import (
	"context"
	"fmt"

	"github.com/doug-martin/goqu/v9"
	"github.com/stashapp/stash/pkg/models"
)

func (qb *PerformerStore) FindBySceneMarkerID(ctx context.Context, sceneMarkerID int) ([]*models.Performer, error) {
	sq := dialect.From(goqu.T("scene_marker_performers")).Select(goqu.C("performer_id")).Where(
		goqu.C("scene_marker_id").Eq(sceneMarkerID),
	)
	ret, err := qb.findBySubquery(ctx, sq)

	if err != nil {
		return nil, fmt.Errorf("getting performers for scene marker %d: %w", sceneMarkerID, err)
	}

	return ret, nil
}

func (qb *PerformerStore) FindBySceneMarkerIDWithRole(ctx context.Context, sceneMarkerID int, role string) ([]*models.Performer, error) {
	sq := dialect.From(goqu.T("scene_marker_performers")).Select(goqu.C("performer_id")).Where(
		goqu.C("scene_marker_id").Eq(sceneMarkerID),
		goqu.C("role").Eq(role),
	)
	ret, err := qb.findBySubquery(ctx, sq)

	if err != nil {
		return nil, fmt.Errorf("getting %s performers for scene marker %d: %w", role, sceneMarkerID, err)
	}

	return ret, nil
}

func (qb *PerformerStore) GetImageBlob(ctx context.Context, performerID int) (*string, error) {
	return qb.blobJoinQueryBuilder.getChecksum(ctx, performerID, performerImageBlobColumn)
}

func (qb *PerformerStore) UpdateImageBlob(ctx context.Context, performerID int, blobChecksum string) error {
	// Bump updated_at so image URLs with ?t=<updated_at> cache-bust correctly.
	sqlQuery := fmt.Sprintf("UPDATE %s SET %s = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", performerTable, performerImageBlobColumn)
	_, err := dbWrapper.Exec(ctx, sqlQuery, blobChecksum, performerID)
	return err
}

// ============================================================
// Role-based metric sort functions for performers
// ============================================================

// tagHierarchyCondition centralizes effective primary/secondary tag-family
// matching for the custom performer filters and rating queries.
func tagHierarchyCondition(sceneMarkerAlias string, tagID int) string {
	return sceneMarkerEffectiveTagHierarchyConditionCustom(sceneMarkerAlias, tagID)
}

// sceneExclusionForTag generates a NOT IN clause that excludes scenes having markers
// matching the given tag (including descendants). Uses both primary and secondary tags.
func sceneExclusionForTag(smAlias string, tagID int) string {
	if tagID == 0 {
		return ""
	}
	return fmt.Sprintf(`
		AND %[1]s.scene_id NOT IN (
			SELECT DISTINCT sm_excl.scene_id
			FROM scene_markers sm_excl
			WHERE %[2]s
		)`, smAlias, sceneMarkerEffectiveTagHierarchyConditionCustom("sm_excl", tagID))
}

// sortByPerformerMarkerSceneCount generates an ORDER BY for counting distinct scenes
// where the performer has markers matching the tag (including descendants).
// studioSQL (optional) restricts counting to scenes in the active studio.
func (qb *PerformerStore) sortByPerformerMarkerSceneCount(tagID int, excludeTagIDs []int, direction string, studioSQL string) string {
	if tagID == 0 {
		return fmt.Sprintf(" ORDER BY 0 %s", getSortDirection(direction))
	}

	exclusions := ""
	for _, excl := range excludeTagIDs {
		exclusions += sceneExclusionForTag("sm", excl)
	}

	return fmt.Sprintf(` ORDER BY COALESCE((
		SELECT COUNT(DISTINCT sm.scene_id)
		FROM scene_marker_performers smp
		JOIN scene_markers sm ON smp.scene_marker_id = sm.id
		WHERE smp.performer_id = performers.id
		AND %s
		%s
		%s
	), 0) %s`, tagHierarchyCondition("sm", tagID), exclusions, studioSQL, getSortDirection(direction))
}

// sortByPerformerSexSceneCount sorts performers by their sex scene count.
func (qb *PerformerStore) sortByPerformerSexSceneCount(direction string, studioSQL string) string {
	tags := GetRoleTagIDs()
	return qb.sortByPerformerMarkerSceneCount(tags.SexTagID, nil, direction, studioSQL)
}

// sortByPerformerOralSceneCount sorts performers by oral scene count (excluding sex scenes).
func (qb *PerformerStore) sortByPerformerOralSceneCount(direction string, studioSQL string) string {
	tags := GetRoleTagIDs()
	return qb.sortByPerformerMarkerSceneCount(tags.OralTagID, []int{tags.SexTagID}, direction, studioSQL)
}

// sortByPerformerFacialSceneCount sorts performers by facial scene count (independent).
func (qb *PerformerStore) sortByPerformerFacialSceneCount(direction string, studioSQL string) string {
	tags := GetRoleTagIDs()
	return qb.sortByPerformerMarkerSceneCount(tags.FacialTagID, nil, direction, studioSQL)
}

// sortByPerformerSoloSceneCount sorts performers by solo scene count (excluding sex and oral).
func (qb *PerformerStore) sortByPerformerSoloSceneCount(direction string, studioSQL string) string {
	tags := GetRoleTagIDs()
	return qb.sortByPerformerMarkerSceneCount(tags.SoloTagID, []int{tags.SexTagID, tags.OralTagID}, direction, studioSQL)
}

// sortByPerformerOrgasmCount sorts performers by total orgasm marker count (performer as top).
func (qb *PerformerStore) sortByPerformerOrgasmCount(direction string, studioSQL string) string {
	tags := GetRoleTagIDs()
	if tags.OrgasmTagID == 0 {
		return fmt.Sprintf(" ORDER BY 0 %s", getSortDirection(direction))
	}

	return fmt.Sprintf(` ORDER BY COALESCE((
		SELECT COUNT(*)
		FROM scene_marker_performers smp
		JOIN scene_markers sm ON smp.scene_marker_id = sm.id
		WHERE smp.performer_id = performers.id
		AND smp.role = 'top'
		AND %s
		%s
	), 0) %s`, tagHierarchyCondition("sm", tags.OrgasmTagID), studioSQL, getSortDirection(direction))
}

// sortByPerformerFeetMarkerCount sorts performers by individual feet marker count where performer is top.
func (qb *PerformerStore) sortByPerformerFeetMarkerCount(direction string, studioSQL string) string {
	tags := GetRoleTagIDs()
	if tags.FeetTagID == 0 {
		return fmt.Sprintf(" ORDER BY 0 %s", getSortDirection(direction))
	}

	return fmt.Sprintf(` ORDER BY COALESCE((
		SELECT COUNT(*)
		FROM scene_marker_performers smp
		JOIN scene_markers sm ON smp.scene_marker_id = sm.id
		WHERE smp.performer_id = performers.id
		AND smp.role = 'top'
		AND %s
		%s
	), 0) %s`, tagHierarchyCondition("sm", tags.FeetTagID), studioSQL, getSortDirection(direction))
}

// sortByPerformerFacialMarkerCount sorts performers by individual facial marker count for a given role.
// role="top" = facials given; role="bottom" = facials received.
func (qb *PerformerStore) sortByPerformerFacialMarkerCount(role string, direction string, studioSQL string) string {
	tags := GetRoleTagIDs()
	if tags.FacialTagID == 0 {
		return fmt.Sprintf(" ORDER BY 0 %s", getSortDirection(direction))
	}

	return fmt.Sprintf(` ORDER BY COALESCE((
		SELECT COUNT(*)
		FROM scene_marker_performers smp
		JOIN scene_markers sm ON smp.scene_marker_id = sm.id
		WHERE smp.performer_id = performers.id
		AND smp.role = '%s'
		AND %s
		%s
	), 0) %s`, role, tagHierarchyCondition("sm", tags.FacialTagID), studioSQL, getSortDirection(direction))
}

// sortByPerformerUniquePartners sorts performers by unique partner count for a category.
// Partners are counted across both top and bottom roles (merged, deduplicated).
// studioSQL (optional) restricts counting to scenes in the active studio.
func (qb *PerformerStore) sortByPerformerUniquePartners(category string, direction string, studioSQL string) string {
	tags := GetRoleTagIDs()
	var tagID int
	switch category {
	case "sex":
		tagID = tags.SexTagID
	case "oral":
		tagID = tags.OralTagID
	case "facial":
		tagID = tags.FacialTagID
	}
	if tagID == 0 {
		return fmt.Sprintf(" ORDER BY 0 %s", getSortDirection(direction))
	}

	return fmt.Sprintf(` ORDER BY COALESCE((
		SELECT COUNT(DISTINCT smp2.performer_id)
		FROM scene_marker_performers smp1
		JOIN scene_markers sm ON smp1.scene_marker_id = sm.id
		JOIN scene_marker_performers smp2 ON smp2.scene_marker_id = smp1.scene_marker_id
		WHERE smp1.performer_id = performers.id
		AND smp2.performer_id != performers.id
		AND ((smp1.role = 'top' AND smp2.role = 'bottom') OR (smp1.role = 'bottom' AND smp2.role = 'top'))
		AND %s
		%s
	), 0) %s`, tagHierarchyCondition("sm", tagID), studioSQL, getSortDirection(direction))
}

// sortByPerformerRolePartners sorts performers by unique partner count for a specific role.
// role="top" counts partners this performer has topped; role="bottom" counts partners who topped them.
// studioSQL (optional) restricts counting to scenes in the active studio.
func (qb *PerformerStore) sortByPerformerRolePartners(category string, role string, direction string, studioSQL string) string {
	tags := GetRoleTagIDs()
	var tagID int
	switch category {
	case "sex":
		tagID = tags.SexTagID
	case "oral":
		tagID = tags.OralTagID
	case "facial":
		tagID = tags.FacialTagID
	}
	if tagID == 0 {
		return fmt.Sprintf(" ORDER BY 0 %s", getSortDirection(direction))
	}

	oppositeRole := "bottom"
	if role == "bottom" {
		oppositeRole = "top"
	}

	return fmt.Sprintf(` ORDER BY COALESCE((
		SELECT COUNT(DISTINCT smp2.performer_id)
		FROM scene_marker_performers smp1
		JOIN scene_markers sm ON smp1.scene_marker_id = sm.id
		JOIN scene_marker_performers smp2 ON smp2.scene_marker_id = smp1.scene_marker_id
		WHERE smp1.performer_id = performers.id
		AND smp1.role = '%s'
		AND smp2.role = '%s'
		AND smp2.performer_id != performers.id
		AND %s
		%s
	), 0) %s`, role, oppositeRole, tagHierarchyCondition("sm", tagID), studioSQL, getSortDirection(direction))
}
