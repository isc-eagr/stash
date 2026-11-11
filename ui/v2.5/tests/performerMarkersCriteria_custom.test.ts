import assert from "node:assert/strict";
import { CriterionModifier } from "../src/core/generated-graphql";
import {
  PerformerMarkersCriterion,
  PerformerMarkersCriterionBase,
} from "../src/models/list-filter/criteria/performer-markers";
import { PerformerMarkersExcludeCriterion } from "../src/models/list-filter/criteria/performer-markers-exclude";

function fill(criterion: PerformerMarkersCriterionBase) {
  criterion.updateGroup({
    tag_ids: [{ id: "30", label: "Sex" }],
    depth: -1,
    performer_role: "top",
    performer_ethnicities: ["Latino"],
    partner_ids: [{ id: "7", label: "Partner" }],
    partner_role: "bottom",
  });
  return criterion;
}

const condition = {
  tag_ids: ["30"],
  depth: -1,
  role: "top",
  self_ethnicities: ["Latino"],
  partner_performer_ids: ["7"],
  partner_role: "bottom",
};

// Include and exclude fill their own side of the same GraphQL field.
const include = fill(new PerformerMarkersCriterion());
const exclude = fill(new PerformerMarkersExcludeCriterion());
const input: Record<string, unknown> = {};
include.applyToCriterionInput(input);
exclude.applyToCriterionInput(input);
assert.deepEqual(input, {
  performer_markers: { include: [condition], exclude: [condition] },
});

assert.equal(include.getId(), "performer_markers");
assert.equal(exclude.getId(), "performer_markers_exclude");
assert.ok(!(exclude instanceof PerformerMarkersCriterion));

// Specific vatos skip the anonymous ethnicity/country/rating criteria.
const named = fill(new PerformerMarkersCriterion());
named.updateGroup({ performer_ids: [{ id: "4", label: "Vato" }] });
const namedInput: Record<string, unknown> = {};
named.applyToCriterionInput(namedInput);
const { self_ethnicities: _skipped, ...namedCondition } = condition;
assert.deepEqual(namedInput, {
  performer_markers: { include: [namedCondition] },
});

// A clone keeps its side and does not share state with the original.
const clone = exclude.clone() as PerformerMarkersExcludeCriterion;
clone.value.group.tag_ids.push({ id: "31", label: "Oral" });
clone.value.group.performer_ethnicities.push("Black");
assert.ok(clone instanceof PerformerMarkersExcludeCriterion);
assert.equal(exclude.value.group.tag_ids.length, 1);
assert.deepEqual(exclude.value.group.performer_ethnicities, ["Latino"]);
const cloneInput: Record<string, unknown> = {};
clone.applyToCriterionInput(cloneInput);
assert.deepEqual(Object.keys(cloneInput.performer_markers as object), [
  "exclude",
]);

// Saved filters and URLs round-trip the whole group.
const saved: Record<string, unknown> = {};
exclude.modifier = CriterionModifier.Includes;
exclude.applyToSavedCriterion(saved);
const restored = new PerformerMarkersExcludeCriterion();
restored.setFromSavedCriterion(
  saved.performer_markers_exclude as Record<string, unknown>
);
assert.equal(restored.modifier, CriterionModifier.Includes);
assert.deepEqual(restored.value, exclude.value);
assert.ok(restored.isValid());
assert.ok(!new PerformerMarkersCriterion().isValid());
