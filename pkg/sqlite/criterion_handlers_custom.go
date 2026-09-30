package sqlite

// CUSTOM: Custom criterion handlers for scene marker tags, custom filters, scene types,
// performer markers, ethnicity, country, etc.

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/utils"
)

type joinedSceneMarkerTagsHandler struct {
	criterion *models.SceneMarkerTagsCriterionInput

	primaryTable   string // eg scenes
	joinTable      string // eg scene_markers
	joinPrimaryKey string // eg scene_id
}

func (h *joinedSceneMarkerTagsHandler) handle(ctx context.Context, f *filterBuilder) {
	if h.criterion == nil {
		return
	}

	c := *h.criterion
	c.GroupsExtended = normalizeSceneMarkerTagGroupsSameUnnamedRolesCustom(c.GroupsExtended)
	c.OverlapGroups = normalizeSceneMarkerTagGroupsSameUnnamedRolesCustom(c.OverlapGroups)
	c.GroupsExtendedExclude = normalizeSceneMarkerTagGroupsSameUnnamedRolesCustom(c.GroupsExtendedExclude)

	switch c.Modifier {
	case models.CriterionModifierIsNull, models.CriterionModifierNotNull:
		var notClause string
		if c.Modifier == models.CriterionModifierNotNull {
			notClause = "NOT"
		}
		// Only null checks use the outer marker rows. Other checks are self-contained
		// subqueries; joining here would multiply their evaluations by marker count.
		f.addLeftJoin(h.joinTable, "", utils.StrFormat("{primaryTable}.id = {joinTable}.{joinPrimaryKey}", utils.StrFormatMap{
			"primaryTable":   h.primaryTable,
			"joinTable":      h.joinTable,
			"joinPrimaryKey": h.joinPrimaryKey,
		}))
		// Join marker tags to check presence/absence
		f.addLeftJoin("scene_markers_tags", "", "scene_markers.id = scene_markers_tags.scene_marker_id")
		f.addWhere(fmt.Sprintf("scene_markers_tags.tag_id IS %s NULL", notClause))
		return

	case models.CriterionModifierEquals:
		if len(c.GroupsExtended) > 0 || len(c.OverlapGroups) > 0 || len(c.GroupsExtendedExclude) > 0 {
			h.handleMarkerGroupsCustom(ctx, f, c)
			return
		}

		// Treat Value as a single group if Groups not provided
		groups := c.Groups
		if len(groups) == 0 && len(c.Value) > 0 {
			groups = [][]string{c.Value}
		}

		if len(groups) == 0 {
			// nothing to enforce
			return
		}

		// Group identical tag-sets and require sufficient distinct markers for each set
		type groupKey struct{ s string }
		counts := make(map[groupKey]int)
		orderedGroups := make(map[groupKey][]string)
		for _, g := range groups {
			if len(g) == 0 {
				continue
			}
			// build order-independent key
			vals := append([]string(nil), g...)
			sort.Strings(vals)
			key := groupKey{s: strings.Join(vals, ",")}
			counts[key]++
			// store canonical ordered group once
			if _, ok := orderedGroups[key]; !ok {
				orderedGroups[key] = vals
			}
		}

		for k, multiplicity := range counts {
			g := orderedGroups[k]
			if len(g) == 0 {
				continue
			}
			ph := getInBinding(len(g))
			subq, countArgs := sceneMarkerMultiplicityClauseCustom(h.primaryTable, sceneMarkerEffectiveTagsCountClauseCustom("sm", ph, len(g)), multiplicity)

			args := make([]any, 0, len(g)+1)
			for _, v := range g {
				args = append(args, v)
			}
			args = append(args, countArgs...)
			f.addWhere(subq, args...)
		}
		return

	case models.CriterionModifierNotEquals:
		// Treat Value as a single group if Groups not provided
		groups := c.Groups
		if len(groups) == 0 && len(c.Value) > 0 {
			groups = [][]string{c.Value}
		}

		if len(groups) == 0 {
			// nothing to enforce
			return
		}

		// Deduplicate identical groups (order-insensitive)
		type groupKey struct{ s string }
		unique := make(map[groupKey][]string)
		for _, g := range groups {
			if len(g) == 0 {
				continue
			}
			vals := append([]string(nil), g...)
			sort.Strings(vals)
			key := groupKey{s: strings.Join(vals, ",")}
			if _, ok := unique[key]; !ok {
				unique[key] = vals
			}
		}

		// For each unique group, assert there does NOT exist a marker that contains all tags in that group
		for _, g := range unique {
			ph := getInBinding(len(g))
			subq := utils.StrFormat(`NOT EXISTS (
SELECT 1
FROM scene_markers sm
WHERE sm.scene_id = {primaryTable}.id
  AND `+sceneMarkerEffectiveTagsCountClauseCustom("sm", ph, len(g))+`
)`, utils.StrFormatMap{"primaryTable": h.primaryTable})

			args := make([]any, 0, len(g))
			for _, v := range g {
				args = append(args, v)
			}
			f.addWhere(subq, args...)
		}
		return

	case models.CriterionModifierIncludesAll:
		// Each tag in Value must be present on at least one marker in the scene
		if len(c.Value) == 0 {
			return
		}
		for _, v := range c.Value {
			clause := utils.StrFormat(`EXISTS (
SELECT 1 FROM scene_markers sm
LEFT JOIN scene_markers_tags mt ON mt.scene_marker_id = sm.id
WHERE sm.scene_id = {primaryTable}.id AND (sm.primary_tag_id = ? OR mt.tag_id = ?)
)`, utils.StrFormatMap{"primaryTable": h.primaryTable})
			f.addWhere(clause, v, v)
		}
		return

	case models.CriterionModifierIncludes:
		if len(c.Value) == 0 {
			return
		}
		ph := getInBinding(len(c.Value))
		clause := utils.StrFormat(`EXISTS (
SELECT 1 FROM scene_markers sm
LEFT JOIN scene_markers_tags mt ON mt.scene_marker_id = sm.id
WHERE sm.scene_id = {primaryTable}.id AND (sm.primary_tag_id IN `+ph+` OR mt.tag_id IN `+ph+`)
)`, utils.StrFormatMap{"primaryTable": h.primaryTable})
		args := make([]any, 0, len(c.Value)*2)
		for _, v := range c.Value {
			args = append(args, v)
		}
		for _, v := range c.Value {
			args = append(args, v)
		}
		f.addWhere(clause, args...)
		return

	default:
		// Unsupported modifiers: no-op
		return
	}
}

// handleMarkerGroupsCustom applies Scene Markers include, overlap, and exclude
// configurations. Every configuration must match a different marker; empty
// configurations are ignored.
func (h *joinedSceneMarkerTagsHandler) handleMarkerGroupsCustom(ctx context.Context, f *filterBuilder, c models.SceneMarkerTagsCriterionInput) {
	sceneExpr := h.primaryTable + ".id"
	builder := markerGroupSQLCustom{ctx: ctx}

	var include []models.SceneMarkerTagGroupInput
	for _, g := range c.GroupsExtended {
		if len(g.ExcludeTagIDs) > 0 {
			h.addSceneTagExclusionCustom(f, g)
		}
		if !markerGroupIsEmptyCustom(g) {
			include = append(include, g)
		}
	}

	// Cheap per-configuration checks first: n identical configurations need
	// at least n matching markers.
	var keys []string
	counts := make(map[string]int)
	byKey := make(map[string]models.SceneMarkerTagGroupInput)
	for _, g := range include {
		raw, _ := json.Marshal(g)
		key := string(raw)
		if counts[key] == 0 {
			keys = append(keys, key)
			byKey[key] = g
		}
		counts[key]++
	}
	for _, key := range keys {
		condition, err := builder.condition(byKey[key], "sm")
		if err != nil {
			f.setError(err)
			return
		}
		subq, countArgs := sceneMarkerMultiplicityClauseCustom(h.primaryTable, condition.sql, counts[key])
		f.addWhere(subq, append(condition.args, countArgs...)...)
	}

	if markerAssignmentNeededCustom(include) {
		assignment, err := sceneMarkerAssignmentCustom(ctx, include, sceneExpr, "sm_assign", false, false)
		if err != nil {
			f.setError(err)
			return
		}
		clause := assignment.exists()
		f.addWhere(clause.sql, clause.args...)
	}

	// Exclusions: by default any matching configuration hides the scene.
	var excluded []sqlClause
	for i, g := range nonEmptyMarkerGroupsCustom(c.GroupsExtendedExclude) {
		alias := fmt.Sprintf("sm_ex_%d", i)
		condition, err := builder.condition(g, alias)
		if err != nil {
			f.setError(err)
			return
		}
		excluded = append(excluded, sqlClause{
			sql:  fmt.Sprintf("EXISTS (SELECT 1 FROM scene_markers %[1]s WHERE %[1]s.scene_id = %[2]s AND %[3]s)", alias, sceneExpr, condition.sql),
			args: condition.args,
		})
	}
	if len(excluded) > 0 {
		joiner := " OR "
		if c.ExcludeModifier != nil && *c.ExcludeModifier == models.CriterionModifierIncludesAll {
			joiner = " AND "
		}
		clause := joinClausesCustom(excluded, joiner).not()
		f.addWhere(clause.sql, clause.args...)
	}

	if overlap := nonEmptyMarkerGroupsCustom(c.OverlapGroups); len(overlap) > 0 {
		assignment, err := sceneMarkerAssignmentCustom(ctx, overlap, sceneExpr, "sm_overlap_req", true, true)
		if err != nil {
			f.setError(err)
			return
		}
		clause := assignment.exists()
		f.addWhere(clause.sql, clause.args...)
	}
}

// addSceneTagExclusionCustom handles legacy scene-level exclude_tag_ids. An
// exclusion-only AND group hides scenes that have every tag; otherwise any tag
// hides the scene.
func (h *joinedSceneMarkerTagsHandler) addSceneTagExclusionCustom(f *filterBuilder, g models.SceneMarkerTagGroupInput) {
	tagIDs := uniqueStringsCustom(g.ExcludeTagIDs)
	hasTag := func(alias string, ph string) string {
		return utils.StrFormat(`EXISTS (
SELECT 1 FROM scene_markers {sm}
WHERE {sm}.scene_id = {primaryTable}.id
  AND (
    {sm}.primary_tag_id IN `+ph+`
    OR EXISTS (SELECT 1 FROM scene_markers_tags {sm}_t WHERE {sm}_t.scene_marker_id = {sm}.id AND {sm}_t.tag_id IN `+ph+`)
  )
)`, utils.StrFormatMap{"sm": alias, "primaryTable": h.primaryTable})
	}

	if markerGroupIsEmptyCustom(g) && markerGroupAndModeCustom(g) {
		var clauses []string
		var args []any
		for i, tagID := range tagIDs {
			clauses = append(clauses, hasTag(fmt.Sprintf("sm_excl%d", i), "(?)"))
			args = append(args, tagID, tagID)
		}
		f.addWhere("NOT ("+strings.Join(clauses, " AND ")+")", args...)
		return
	}

	args := append(stringArgsCustom(tagIDs), stringArgsCustom(tagIDs)...)
	f.addWhere("NOT "+hasTag("sm_excl", getInBinding(len(tagIDs))), args...)
}
