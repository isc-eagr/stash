package sqlite

// CUSTOM: overlap-aware scene marker tag helpers.

import "fmt"

const (
	sceneMarkerDefaultEndOffsetCustom           = 20
	sceneMarkerInheritedTagOverlapPercentCustom = 50
)

func sceneMarkerEndExprCustom(smAlias string) string {
	return fmt.Sprintf("COALESCE(%[1]s.end_seconds, %[1]s.seconds + %d)", smAlias, sceneMarkerDefaultEndOffsetCustom)
}

func sceneMarkerDurationExprCustom(smAlias string) string {
	return fmt.Sprintf("(%[1]s - %[2]s.seconds)", sceneMarkerEndExprCustom(smAlias), smAlias)
}

func sceneMarkerOverlapWhereCustom(baseAlias string, overlapAlias string) string {
	return fmt.Sprintf(`%[2]s.scene_id = %[1]s.scene_id
AND %[2]s.id != %[1]s.id
AND %[2]s.seconds < %[3]s
AND %[4]s > %[1]s.seconds`, baseAlias, overlapAlias, sceneMarkerEndExprCustom(baseAlias), sceneMarkerEndExprCustom(overlapAlias))
}

func sceneMarkerTagInheritanceWhereCustom(markerAlias string, sourceAlias string) string {
	return fmt.Sprintf(`%[2]s.scene_id = %[1]s.scene_id
AND %[2]s.id != %[1]s.id
AND %[3]s > %[1]s.seconds
AND %[2]s.seconds < %[3]s
AND %[4]s > %[1]s.seconds
AND (%[4]s - %[2]s.seconds) >= (%[3]s - %[1]s.seconds)
AND 100 * (MIN(%[3]s, %[4]s) - MAX(%[1]s.seconds, %[2]s.seconds)) >= %[5]d * (%[3]s - %[1]s.seconds)`, markerAlias, sourceAlias, sceneMarkerEndExprCustom(markerAlias), sceneMarkerEndExprCustom(sourceAlias), sceneMarkerInheritedTagOverlapPercentCustom)
}

func sceneMarkerSameOrOverlapWhereCustom(baseAlias string, overlapAlias string) string {
	return fmt.Sprintf(`(
    %[2]s.id = %[1]s.id
    OR (%[3]s)
)`, baseAlias, overlapAlias, sceneMarkerOverlapWhereCustom(baseAlias, overlapAlias))
}

func sceneMarkerDirectTagSetSQLCustom(smAlias string) string {
	return fmt.Sprintf(`SELECT %[1]s.primary_tag_id AS tag_id
UNION ALL
SELECT mt2.tag_id AS tag_id FROM scene_markers_tags mt2 WHERE mt2.scene_marker_id = %[1]s.id`, smAlias)
}

func sceneMarkerEffectiveTagSetSQLCustom(smAlias string) string {
	return fmt.Sprintf(`%[1]s
UNION ALL
SELECT sm_overlap.primary_tag_id AS tag_id FROM scene_markers sm_overlap WHERE %[2]s
UNION ALL
SELECT smt_overlap.tag_id AS tag_id
FROM scene_markers sm_overlap
JOIN scene_markers_tags smt_overlap ON smt_overlap.scene_marker_id = sm_overlap.id
WHERE %[2]s`, sceneMarkerDirectTagSetSQLCustom(smAlias), sceneMarkerTagInheritanceWhereCustom(smAlias, "sm_overlap"))
}

func sceneMarkerDirectHasTagInClauseCustom(smAlias string, tagIDsBinding string) string {
	return fmt.Sprintf(`EXISTS (
    SELECT 1 FROM (
      %[1]s
    ) direct_tags_per_marker
    WHERE tag_id IN %[2]s
)`, sceneMarkerDirectTagSetSQLCustom(smAlias), tagIDsBinding)
}

func sceneMarkerDirectTagsCountClauseCustom(smAlias string, tagIDsBinding string, tagCount int) string {
	return fmt.Sprintf(`(
    SELECT COUNT(DISTINCT tag_id) FROM (
      %[1]s
    ) tags_per_marker
    WHERE tag_id IN %[2]s
  ) = %[3]d`, sceneMarkerDirectTagSetSQLCustom(smAlias), tagIDsBinding, tagCount)
}

func sceneMarkerEffectiveTagsCountClauseCustom(smAlias string, tagIDsBinding string, tagCount int) string {
	return fmt.Sprintf(`(
    SELECT COUNT(DISTINCT tag_id) FROM (
      %[1]s
    ) tags_per_marker
    WHERE tag_id IN %[2]s
  ) = %[3]d`, sceneMarkerEffectiveTagSetSQLCustom(smAlias), tagIDsBinding, tagCount)
}

func sceneMarkerHasEffectiveTagInClauseCustom(smAlias string, tagIDsBinding string) string {
	return fmt.Sprintf(`EXISTS (
    SELECT 1 FROM (
      %[1]s
    ) tags_per_marker
    WHERE tag_id IN %[2]s
)`, sceneMarkerEffectiveTagSetSQLCustom(smAlias), tagIDsBinding)
}

func sceneMarkerIsNarrowerThanClauseCustom(candidateAlias string, currentAlias string) string {
	return fmt.Sprintf(`(
    %[1]s < %[2]s
    OR (%[1]s = %[2]s AND %[3]s.id < %[4]s.id)
)`, sceneMarkerDurationExprCustom(candidateAlias), sceneMarkerDurationExprCustom(currentAlias), candidateAlias, currentAlias)
}

func sceneMarkerEffectiveTagHierarchyConditionCustom(smAlias string, tagID int) string {
	return fmt.Sprintf(`EXISTS (
    SELECT 1 FROM (
      %[1]s
    ) marker_tags
    WHERE marker_tags.tag_id = %[2]d
       OR marker_tags.tag_id IN (SELECT child_id FROM tags_relations WHERE parent_id = %[2]d)
       OR marker_tags.tag_id IN (SELECT tr2.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id WHERE tr1.parent_id = %[2]d)
       OR marker_tags.tag_id IN (SELECT tr3.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id WHERE tr1.parent_id = %[2]d)
       OR marker_tags.tag_id IN (SELECT tr4.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id JOIN tags_relations tr4 ON tr4.parent_id = tr3.child_id WHERE tr1.parent_id = %[2]d)
)`, sceneMarkerEffectiveTagSetSQLCustom(smAlias), tagID)
}

func sceneMarkerDirectTagHierarchyConditionCustom(smAlias string, tagID int) string {
	return fmt.Sprintf(`EXISTS (
    SELECT 1 FROM (
      %[1]s
    ) marker_tags
    WHERE marker_tags.tag_id = %[2]d
       OR marker_tags.tag_id IN (SELECT child_id FROM tags_relations WHERE parent_id = %[2]d)
       OR marker_tags.tag_id IN (SELECT tr2.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id WHERE tr1.parent_id = %[2]d)
       OR marker_tags.tag_id IN (SELECT tr3.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id WHERE tr1.parent_id = %[2]d)
       OR marker_tags.tag_id IN (SELECT tr4.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id JOIN tags_relations tr4 ON tr4.parent_id = tr3.child_id WHERE tr1.parent_id = %[2]d)
)`, sceneMarkerDirectTagSetSQLCustom(smAlias), tagID)
}
