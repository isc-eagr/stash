package sqlite

// CUSTOM: shared SQL for one scene_marker_tags configuration. Scenes, Markers,
// exclusions, and overlap searches build every marker predicate here so tag,
// role, and vato semantics stay identical across pages.

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/stashapp/stash/pkg/models"
)

type markerGroupSQLCustom struct {
	ctx context.Context
	// direct matches only the marker's own tags, without 50%-overlap inheritance.
	direct bool
	// bindings ties unnamed vato IDs to one performer_id expression.
	bindings map[string]string
}

type markerVatoSlotCustom struct {
	role string // "top", "bottom", or "" for any role
	both bool   // the same person must be top and bottom
	slot models.UnnamedPerformerCriterionInput
}

func joinClausesCustom(parts []sqlClause, sep string) sqlClause {
	var sqls []string
	var args []interface{}
	for _, part := range parts {
		if strings.TrimSpace(part.sql) == "" {
			continue
		}
		sqls = append(sqls, part.sql)
		args = append(args, part.args...)
	}
	if len(sqls) == 0 {
		return sqlClause{}
	}
	return sqlClause{sql: "(" + strings.Join(sqls, sep) + ")", args: args}
}

func stringArgsCustom(values []string) []interface{} {
	args := make([]interface{}, len(values))
	for i, v := range values {
		args[i] = v
	}
	return args
}

func uniqueStringsCustom(values []string) []string {
	seen := make(map[string]bool, len(values))
	ret := make([]string, 0, len(values))
	for _, v := range values {
		if !seen[v] {
			seen[v] = true
			ret = append(ret, v)
		}
	}
	return ret
}

// Black includes Mixed and Afrolatino, White includes Mixed, and Latino
// includes Afrolatino, matching the global performer filters.
func expandMarkerEthnicitiesCustom(ethnicities []string) []string {
	var out []string
	for _, e := range ethnicities {
		v := strings.TrimSpace(e)
		if v == "" {
			continue
		}
		out = append(out, v)
		switch {
		case strings.EqualFold(v, "Black"):
			out = append(out, "Mixed", "Afrolatino")
		case strings.EqualFold(v, "White"):
			out = append(out, "Mixed")
		case strings.EqualFold(v, "Latino"):
			out = append(out, "Afrolatino")
		}
	}
	return uniqueStringsCustom(out)
}

// markerTagFamiliesCustom returns each requested tag, expanded to its
// descendants when the configuration includes sub-tags.
func markerTagFamiliesCustom(ctx context.Context, g models.SceneMarkerTagGroupInput) ([][]string, error) {
	tagIDs := uniqueStringsCustom(g.TagIDs)
	ret := make([][]string, 0, len(tagIDs))
	for _, tagID := range tagIDs {
		if g.Depth == nil || *g.Depth == 0 {
			ret = append(ret, []string{tagID})
			continue
		}
		valuesClause, err := getHierarchicalValues(ctx, []string{tagID}, tagTable, "tags_relations", "parent_id", "child_id", g.Depth)
		if err != nil {
			return nil, err
		}
		var expanded []string
		if err := dbWrapper.Select(ctx, &expanded, fmt.Sprintf("SELECT DISTINCT column2 FROM (%s)", valuesClause)); err != nil {
			return nil, err
		}
		ret = append(ret, expanded)
	}
	return ret, nil
}

// markerGroupAndModeCustom reports whether top and bottom requirements must
// both hold. The UI always sends AND; OR remains for legacy API callers.
func markerGroupAndModeCustom(g models.SceneMarkerTagGroupInput) bool {
	return g.PerformerMode != nil && strings.EqualFold(*g.PerformerMode, "AND")
}

func markerGroupNamedIDsCustom(g models.SceneMarkerTagGroupInput) []string {
	var ids []string
	ids = append(ids, g.TopPerformerIDs...)
	ids = append(ids, g.BottomPerformerIDs...)
	ids = append(ids, g.BothRolesPerformerIDs...)
	ids = append(ids, g.EitherPerformerIDs...)
	return uniqueStringsCustom(ids)
}

func markerGroupVatoSlotsCustom(g models.SceneMarkerTagGroupInput) []markerVatoSlotCustom {
	var slots []markerVatoSlotCustom
	for _, s := range g.TopUnnamedPerformers {
		slots = append(slots, markerVatoSlotCustom{role: "top", slot: s})
	}
	for _, s := range g.BottomUnnamedPerformers {
		slots = append(slots, markerVatoSlotCustom{role: "bottom", slot: s})
	}
	for _, s := range g.BothRolesUnnamedPerformers {
		slots = append(slots, markerVatoSlotCustom{both: true, slot: s})
	}
	for _, s := range g.EitherUnnamedPerformers {
		slots = append(slots, markerVatoSlotCustom{slot: s})
	}
	return slots
}

// markerGroupIsEmptyCustom reports whether a configuration places no
// requirement on its marker. Empty configurations are ignored.
func markerGroupIsEmptyCustom(g models.SceneMarkerTagGroupInput) bool {
	return len(g.TagIDs) == 0 && len(g.ExcludeTagIDsOnMarker) == 0 &&
		len(markerGroupNamedIDsCustom(g)) == 0 && len(markerGroupVatoSlotsCustom(g)) == 0 &&
		len(g.TopEthnicities) == 0 && len(g.TopCountries) == 0 && g.TopRating == nil &&
		len(g.BottomEthnicities) == 0 && len(g.BottomCountries) == 0 && g.BottomRating == nil &&
		len(g.BothRolesEthnicities) == 0 && len(g.BothRolesCountries) == 0 && g.BothRolesRating == nil &&
		len(g.PerformerEthnicities) == 0 && len(g.PerformerCountries) == 0 && g.PerformerRating == nil &&
		(g.TopAnyCount == nil || *g.TopAnyCount <= 0) && (g.BottomAnyCount == nil || *g.BottomAnyCount <= 0)
}

func nonEmptyMarkerGroupsCustom(groups []models.SceneMarkerTagGroupInput) []models.SceneMarkerTagGroupInput {
	var ret []models.SceneMarkerTagGroupInput
	for _, g := range groups {
		if !markerGroupIsEmptyCustom(g) {
			ret = append(ret, g)
		}
	}
	return ret
}

func markerPerformerAttrCustom(alias string, ethnicities []string, countries []string, rating *models.IntCriterionInput, ratingCriteria *models.RatingCriteriaFilterInput) (sqlClause, error) {
	var parts []sqlClause
	if expanded := expandMarkerEthnicitiesCustom(ethnicities); len(expanded) > 0 {
		parts = append(parts, makeClause(alias+".ethnicity IN "+getInBinding(len(expanded)), stringArgsCustom(expanded)...))
	}
	if len(countries) > 0 {
		parts = append(parts, makeClause(alias+".country IN "+getInBinding(len(countries)), stringArgsCustom(countries)...))
	}
	if rating != nil {
		w, args := getIntWhereClause(alias+".rating", rating.Modifier, rating.Value, rating.Value2)
		parts = append(parts, makeClause(w, args...))
	}
	if ratingCriteria != nil {
		for _, c := range ratingCriteria.Criteria {
			if c == nil || c.Value == nil || c.Key == "" {
				continue
			}
			if !c.Value.ValidModifier() {
				return sqlClause{}, fmt.Errorf("invalid modifier %s for performer rating criterion %s", c.Value.Modifier, c.Key)
			}
			parts = append(parts, ratingScoreNumericClause(ratingCriteriaScoresTable, models.RatingEntityPerformer, alias, c.Key, *c.Value))
		}
		for _, c := range ratingCriteria.BonusValues {
			if c == nil || c.Value == nil || c.Key == "" {
				continue
			}
			if !c.Value.ValidModifier() {
				return sqlClause{}, fmt.Errorf("invalid modifier %s for performer rating bonus %s", c.Value.Modifier, c.Key)
			}
			parts = append(parts, ratingScoreNumericClause(ratingBonusScoresTable, models.RatingEntityPerformer, alias, c.Key, *c.Value))
		}
		for _, c := range ratingCriteria.Bonuses {
			if c != nil && c.Key != "" {
				parts = append(parts, ratingScorePresenceClause(ratingBonusScoresTable, models.RatingEntityPerformer, alias, c.Key, c.Value))
			}
		}
		for _, c := range ratingCriteria.Penalties {
			if c != nil && c.Key != "" {
				parts = append(parts, ratingScorePresenceClause(ratingPenaltyScoresTable, models.RatingEntityPerformer, alias, c.Key, c.Value))
			}
		}
	}
	return joinClausesCustom(parts, " AND "), nil
}

func markerRoleSQLCustom(sm string, alias string, performerExpr string, role string) string {
	return fmt.Sprintf("EXISTS (SELECT 1 FROM scene_marker_performers %[1]s WHERE %[1]s.scene_marker_id = %[2]s.id AND %[1]s.performer_id = %[3]s AND %[1]s.role = '%[4]s')", alias, sm, performerExpr, role)
}

func (b markerGroupSQLCustom) tagClause(g models.SceneMarkerTagGroupInput, sm string) (sqlClause, error) {
	tagIDs := uniqueStringsCustom(g.TagIDs)
	if len(tagIDs) == 0 {
		return sqlClause{}, nil
	}
	if g.Depth == nil || *g.Depth == 0 {
		ph := getInBinding(len(tagIDs))
		sql := sceneMarkerEffectiveTagsCountClauseCustom(sm, ph, len(tagIDs))
		if b.direct {
			sql = sceneMarkerDirectTagsCountClauseCustom(sm, ph, len(tagIDs))
		}
		return makeClause(sql, stringArgsCustom(tagIDs)...), nil
	}

	families, err := markerTagFamiliesCustom(b.ctx, g)
	if err != nil {
		return sqlClause{}, err
	}
	var parts []sqlClause
	for _, family := range families {
		if len(family) == 0 {
			parts = append(parts, makeClause("0=1"))
			continue
		}
		ph := getInBinding(len(family))
		sql := sceneMarkerHasEffectiveTagInClauseCustom(sm, ph)
		if b.direct {
			sql = sceneMarkerDirectHasTagInClauseCustom(sm, ph)
		}
		parts = append(parts, makeClause(sql, stringArgsCustom(family)...))
	}
	return joinClausesCustom(parts, " AND "), nil
}

// vatoSelect lists the performers on the marker that can fill one vato slot.
// A vato is never one of the configuration's named vatos.
func (b markerGroupSQLCustom) vatoSelect(sm string, v markerVatoSlotCustom, alias string, named []string) (sqlClause, error) {
	performerAlias := alias + "_p"
	attr, err := markerPerformerAttrCustom(performerAlias, v.slot.Ethnicities, v.slot.Countries, v.slot.Rating, v.slot.RatingCriteria)
	if err != nil {
		return sqlClause{}, err
	}
	parts := []sqlClause{makeClause(fmt.Sprintf("%s.scene_marker_id = %s.id", alias, sm)), attr}
	if v.role != "" {
		parts = append(parts, makeClause(fmt.Sprintf("%s.role = '%s'", alias, v.role)))
	}
	if v.both {
		parts = append(parts,
			makeClause(markerRoleSQLCustom(sm, alias+"_t", alias+".performer_id", "top")),
			makeClause(markerRoleSQLCustom(sm, alias+"_b", alias+".performer_id", "bottom")),
		)
	}
	if v.slot.ID != nil {
		if binding := b.bindings[*v.slot.ID]; binding != "" {
			parts = append(parts, makeClause(fmt.Sprintf("%s.performer_id = %s", alias, binding)))
		}
	}
	if len(named) > 0 {
		parts = append(parts, makeClause(fmt.Sprintf("%s.performer_id NOT IN %s", alias, getInBinding(len(named))), stringArgsCustom(named)...))
	}
	where := joinClausesCustom(parts, " AND ")
	return sqlClause{
		sql: fmt.Sprintf(`SELECT DISTINCT %[1]s.performer_id
FROM scene_marker_performers %[1]s
JOIN performers %[2]s ON %[2]s.id = %[1]s.performer_id
WHERE %[3]s`, alias, performerAlias, where.sql),
		args: where.args,
	}, nil
}

// distinctVatos requires the slots to be filled by different people.
func (b markerGroupSQLCustom) distinctVatos(sm string, all []markerVatoSlotCustom, prefix string, named []string) (sqlClause, error) {
	// A vato listed in more than one slot is still one person.
	seen := make(map[string]bool)
	var slots []markerVatoSlotCustom
	for _, v := range all {
		if v.slot.ID != nil && *v.slot.ID != "" {
			if seen[*v.slot.ID] {
				continue
			}
			seen[*v.slot.ID] = true
		}
		slots = append(slots, v)
	}
	if len(slots) < 2 {
		return sqlClause{}, nil
	}
	var selects []string
	var args []interface{}
	for i, v := range slots {
		sel, err := b.vatoSelect(sm, v, fmt.Sprintf("%s_%d", prefix, i), named)
		if err != nil {
			return sqlClause{}, err
		}
		selects = append(selects, sel.sql)
		args = append(args, sel.args...)
	}
	return sqlClause{
		sql:  fmt.Sprintf("(SELECT COUNT(*) FROM (%s) AS %s_union) >= %d", strings.Join(selects, " UNION "), prefix, len(slots)),
		args: args,
	}, nil
}

func (b markerGroupSQLCustom) vatoExists(sm string, slots []markerVatoSlotCustom, prefix string, named []string) ([]sqlClause, error) {
	var parts []sqlClause
	for i, v := range slots {
		sel, err := b.vatoSelect(sm, v, fmt.Sprintf("%s_%d", prefix, i), named)
		if err != nil {
			return nil, err
		}
		parts = append(parts, sqlClause{sql: "EXISTS (\n" + sel.sql + "\n)", args: sel.args})
	}
	return parts, nil
}

func (b markerGroupSQLCustom) roleSide(sm string, role string, ids []string, anyCount *int, ethnicities []string, countries []string, rating *models.IntCriterionInput, unnamed []models.UnnamedPerformerCriterionInput, named []string) (sqlClause, error) {
	prefix := "smp_" + role
	var parts []sqlClause
	for i, id := range ids {
		parts = append(parts, makeClause(markerRoleSQLCustom(sm, fmt.Sprintf("%s_id_%d", prefix, i), "?", role), id))
	}

	attr, err := markerPerformerAttrCustom(prefix+"_attr_p", ethnicities, countries, rating, nil)
	if err != nil {
		return sqlClause{}, err
	}
	if attr.sql != "" {
		parts = append(parts, sqlClause{
			sql: fmt.Sprintf(`EXISTS (SELECT 1 FROM scene_marker_performers %[1]s_attr
JOIN performers %[1]s_attr_p ON %[1]s_attr_p.id = %[1]s_attr.performer_id
WHERE %[1]s_attr.scene_marker_id = %[2]s.id AND %[1]s_attr.role = '%[3]s' AND %[4]s)`, prefix, sm, role, attr.sql),
			args: attr.args,
		})
	}

	slots := make([]markerVatoSlotCustom, len(unnamed))
	for i, s := range unnamed {
		slots[i] = markerVatoSlotCustom{role: role, slot: s}
	}
	exists, err := b.vatoExists(sm, slots, prefix+"_u", named)
	if err != nil {
		return sqlClause{}, err
	}
	parts = append(parts, exists...)
	distinct, err := b.distinctVatos(sm, slots, prefix+"_distinct", named)
	if err != nil {
		return sqlClause{}, err
	}
	parts = append(parts, distinct)

	if anyCount != nil && *anyCount > 0 {
		parts = append(parts, makeClause(fmt.Sprintf(`(SELECT COUNT(DISTINCT %[1]s_any.performer_id) FROM scene_marker_performers %[1]s_any
WHERE %[1]s_any.scene_marker_id = %[2]s.id AND %[1]s_any.role = '%[3]s') >= %[4]d`, prefix, sm, role, *anyCount)))
	}
	return joinClausesCustom(parts, " AND "), nil
}

// condition returns the predicate one marker must satisfy for configuration g.
// Named and unnamed vatos follow the same role rules: top, bottom, both roles
// on the marker, or either role. Different vato slots are different people.
func (b markerGroupSQLCustom) condition(g models.SceneMarkerTagGroupInput, sm string) (sqlClause, error) {
	var parts []sqlClause

	tags, err := b.tagClause(g, sm)
	if err != nil {
		return sqlClause{}, err
	}
	parts = append(parts, tags)

	if exclude := uniqueStringsCustom(g.ExcludeTagIDsOnMarker); len(exclude) > 0 {
		ph := getInBinding(len(exclude))
		args := append(stringArgsCustom(exclude), stringArgsCustom(exclude)...)
		parts = append(parts, makeClause(fmt.Sprintf(`NOT (
    %[1]s.primary_tag_id IN %[2]s
    OR EXISTS (SELECT 1 FROM scene_markers_tags mt_excl WHERE mt_excl.scene_marker_id = %[1]s.id AND mt_excl.tag_id IN %[2]s)
)`, sm, ph), args...))
	}

	named := markerGroupNamedIDsCustom(g)
	legacy := func(values []string, fallback []string) []string {
		if len(values) > 0 {
			return values
		}
		return fallback
	}
	legacyRating := func(value *models.IntCriterionInput) *models.IntCriterionInput {
		if value != nil {
			return value
		}
		return g.PerformerRating
	}

	top, err := b.roleSide(sm, "top", g.TopPerformerIDs, g.TopAnyCount, legacy(g.TopEthnicities, g.PerformerEthnicities), legacy(g.TopCountries, g.PerformerCountries), legacyRating(g.TopRating), g.TopUnnamedPerformers, named)
	if err != nil {
		return sqlClause{}, err
	}
	bottom, err := b.roleSide(sm, "bottom", g.BottomPerformerIDs, g.BottomAnyCount, legacy(g.BottomEthnicities, g.PerformerEthnicities), legacy(g.BottomCountries, g.PerformerCountries), legacyRating(g.BottomRating), g.BottomUnnamedPerformers, named)
	if err != nil {
		return sqlClause{}, err
	}
	andMode := markerGroupAndModeCustom(g)
	if top.sql != "" && bottom.sql != "" && !andMode {
		parts = append(parts, joinClausesCustom([]sqlClause{top, bottom}, " OR "))
	} else {
		parts = append(parts, top, bottom)
	}

	for i, id := range g.BothRolesPerformerIDs {
		alias := fmt.Sprintf("smp_both_id_%d", i)
		parts = append(parts, makeClause("("+markerRoleSQLCustom(sm, alias+"_t", "?", "top")+" AND "+markerRoleSQLCustom(sm, alias+"_b", "?", "bottom")+")", id, id))
	}
	bothAttr, err := markerPerformerAttrCustom("p_both_attr", g.BothRolesEthnicities, g.BothRolesCountries, g.BothRolesRating, nil)
	if err != nil {
		return sqlClause{}, err
	}
	if bothAttr.sql != "" {
		parts = append(parts, sqlClause{
			sql: fmt.Sprintf(`EXISTS (SELECT 1 FROM scene_marker_performers smp_both_attr
JOIN performers p_both_attr ON p_both_attr.id = smp_both_attr.performer_id
WHERE smp_both_attr.scene_marker_id = %[1]s.id AND smp_both_attr.role = 'top'
  AND %[2]s
  AND %[3]s)`, sm, markerRoleSQLCustom(sm, "smp_both_attr_b", "smp_both_attr.performer_id", "bottom"), bothAttr.sql),
			args: bothAttr.args,
		})
	}

	for i, id := range g.EitherPerformerIDs {
		parts = append(parts, makeClause(fmt.Sprintf("EXISTS (SELECT 1 FROM scene_marker_performers %[1]s WHERE %[1]s.scene_marker_id = %[2]s.id AND %[1]s.performer_id = ?)", fmt.Sprintf("smp_either_id_%d", i), sm), id))
	}

	var ungrouped []markerVatoSlotCustom
	for _, s := range g.BothRolesUnnamedPerformers {
		ungrouped = append(ungrouped, markerVatoSlotCustom{both: true, slot: s})
	}
	for _, s := range g.EitherUnnamedPerformers {
		ungrouped = append(ungrouped, markerVatoSlotCustom{slot: s})
	}
	exists, err := b.vatoExists(sm, ungrouped, "smp_vato", named)
	if err != nil {
		return sqlClause{}, err
	}
	parts = append(parts, exists...)

	// Every vato slot is a different person. In legacy OR mode only one of the
	// top/bottom sides has to hold, so only the always-required slots count.
	distinctSlots := ungrouped
	if andMode {
		distinctSlots = markerGroupVatoSlotsCustom(g)
	}
	distinct, err := b.distinctVatos(sm, distinctSlots, "smp_vato_distinct", named)
	if err != nil {
		return sqlClause{}, err
	}
	parts = append(parts, distinct)

	return joinClausesCustom(parts, " AND "), nil
}

// markerAssignmentCustom holds the FROM and WHERE parts that match each
// configuration to its own marker in one scene.
type markerAssignmentCustom struct {
	from  []string
	where []sqlClause
}

func (a markerAssignmentCustom) exists(extra ...sqlClause) sqlClause {
	where := joinClausesCustom(append(append([]sqlClause{}, a.where...), extra...), "\n  AND ")
	return sqlClause{
		sql:  fmt.Sprintf("EXISTS (\nSELECT 1\nFROM %s\nWHERE %s\n)", strings.Join(a.from, ", "), where.sql),
		args: where.args,
	}
}

func markerAssignmentAliasCustom(prefix string, i int) string {
	return fmt.Sprintf("%s_%d", prefix, i)
}

// sceneMarkerAssignmentCustom requires every configuration to match a
// different marker in the scene. Each unnamed vato ID binds to one person,
// different IDs bind to different people, and no vato is a named vato.
// overlap additionally requires every pair of matched markers to overlap.
func sceneMarkerAssignmentCustom(ctx context.Context, groups []models.SceneMarkerTagGroupInput, sceneExpr string, prefix string, direct bool, overlap bool) (markerAssignmentCustom, error) {
	var ret markerAssignmentCustom

	idSet := make(map[string]bool)
	var named []string
	for _, g := range groups {
		for _, v := range markerGroupVatoSlotsCustom(g) {
			if v.slot.ID != nil && *v.slot.ID != "" {
				idSet[*v.slot.ID] = true
			}
		}
		named = append(named, markerGroupNamedIDsCustom(g)...)
	}
	named = uniqueStringsCustom(named)
	var ids []string
	for id := range idSet {
		ids = append(ids, id)
	}
	sort.Strings(ids)

	bindings := make(map[string]string, len(ids))
	for i, id := range ids {
		alias := fmt.Sprintf("%s_vato_%d", prefix, i)
		bindings[id] = alias + ".performer_id"
		ret.from = append(ret.from, fmt.Sprintf(`(
SELECT DISTINCT vato_role.performer_id
FROM scene_markers vato_marker
JOIN scene_marker_performers vato_role ON vato_role.scene_marker_id = vato_marker.id
WHERE vato_marker.scene_id = %s
) AS %s`, sceneExpr, alias))
		if len(named) > 0 {
			ret.where = append(ret.where, makeClause(fmt.Sprintf("%s NOT IN %s", bindings[id], getInBinding(len(named))), stringArgsCustom(named)...))
		}
	}
	for i, left := range ids {
		for _, right := range ids[i+1:] {
			ret.where = append(ret.where, makeClause(fmt.Sprintf("%s != %s", bindings[left], bindings[right])))
		}
	}

	builder := markerGroupSQLCustom{ctx: ctx, direct: direct, bindings: bindings}
	keys := make([]string, len(groups))
	for i, g := range groups {
		alias := markerAssignmentAliasCustom(prefix, i)
		ret.from = append(ret.from, "scene_markers "+alias)
		ret.where = append(ret.where, makeClause(fmt.Sprintf("%s.scene_id = %s", alias, sceneExpr)))
		condition, err := builder.condition(g, alias)
		if err != nil {
			return ret, err
		}
		ret.where = append(ret.where, condition)
		key, _ := json.Marshal(g)
		keys[i] = string(key)
	}

	for i := range groups {
		for j := i + 1; j < len(groups); j++ {
			left, right := markerAssignmentAliasCustom(prefix, i), markerAssignmentAliasCustom(prefix, j)
			if overlap {
				ret.where = append(ret.where, makeClause("("+sceneMarkerOverlapWhereCustom(left, right)+")"))
			} else {
				ret.where = append(ret.where, makeClause(fmt.Sprintf("%s.id != %s.id", left, right)))
			}
			// Identical configurations are interchangeable; ordering them skips
			// equivalent permutations.
			if keys[i] == keys[j] {
				ret.where = append(ret.where, makeClause(fmt.Sprintf("%s.id < %s.id", left, right)))
			}
		}
	}
	return ret, nil
}

// markerAssignmentNeededCustom reports whether groups need a joint assignment
// beyond each configuration's own EXISTS: several configurations, or several
// vato identities that must be different people.
func markerAssignmentNeededCustom(groups []models.SceneMarkerTagGroupInput) bool {
	if len(groups) > 1 {
		return true
	}
	ids := make(map[string]bool)
	for _, g := range groups {
		for _, v := range markerGroupVatoSlotsCustom(g) {
			if v.slot.ID != nil && *v.slot.ID != "" {
				ids[*v.slot.ID] = true
			}
		}
	}
	return len(ids) > 1
}
