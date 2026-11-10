import assert from "node:assert/strict";
import { CriterionModifier } from "../src/core/generated-graphql";
import { MarkerPerformersCriterion } from "../src/models/list-filter/criteria/marker-performers";
import { SceneMarkersCriterion } from "../src/models/list-filter/criteria/scene-markers";
import { SceneMarkersExcludeCriterion } from "../src/models/list-filter/criteria/scene-markers-exclude";
import {
  cloneUnnamedPerformer,
  createUnnamedPerformer,
} from "../src/models/list-filter/criteria/unnamed-performer";
import {
  markerCriterionSentenceCustom,
  markerGroupPeopleCustom,
  markerGroupRoleInputCustom,
  markerGroupSentenceCustom,
  normalizeMarkerGroupRolesCustom,
  setMarkerPeopleCustom,
  setMarkerPersonRoleCustom,
} from "../src/models/list-filter/criteria/marker-group_custom";
import {
  assignMarkerUnnamedCustom,
  markerEditorAppliedCustom,
  markerEditorDraftCustom,
  markerEditorGroupsCustom,
  markerUnnamedSelectOptionsCustom,
  markerUnnamedUsesCustom,
  markerSelectedVatosCustom,
  removeMarkerUnnamedCustom,
  saveMarkerUnnamedCustom,
} from "../src/components/List/Filters/markerFilterEditor_custom";

const dropdownVato = createUnnamedPerformer([]);
dropdownVato.ethnicities = ["Black"];
dropdownVato.countries = ["Colombia"];
dropdownVato.rating_criteria = {
  criteria: {},
  bonusValues: {},
  bonuses: { dick: true },
  penalties: {},
};
const dropdownOptions = markerUnnamedSelectOptionsCustom([dropdownVato]);
assert.equal(dropdownOptions[0].id, dropdownVato.id);
assert.equal(dropdownOptions[0].name, dropdownVato.label);
assert.match(dropdownOptions[0].disambiguation, /Black/);
assert.match(dropdownOptions[0].disambiguation, /Colombia/);
assert.match(dropdownOptions[0].disambiguation, /Pito Bonus/);
assert.deepEqual(
  markerSelectedVatosCustom([
    dropdownOptions[0],
    { id: "42", name: "Named vato" },
  ]),
  [
    { id: dropdownVato.id, label: dropdownVato.label },
    { id: "42", label: "Named vato" },
  ],
  "the unified selector preserves unnamed-first selection order"
);

// Roles: named and unnamed vatos follow the same rules.
const roleGroup = {
  groupId: "1",
  tag_ids: [],
  performer_mode: "AND" as const,
  top_performer_ids: [],
  bottom_performer_ids: [],
  either_performer_ids: [],
};
const juan = { id: "42", label: "Juan" };
const vatoA = createUnnamedPerformer([]);
Object.assign(
  roleGroup,
  setMarkerPeopleCustom(roleGroup, [juan, { id: vatoA.id, label: vatoA.label }])
);
assert.deepEqual(
  markerGroupPeopleCustom(roleGroup).map((p) => p.role),
  ["either", "either"],
  "new vatos default to any role"
);
for (const role of ["top", "bottom", "both", "either"] as const) {
  const named = {
    ...roleGroup,
    ...setMarkerPersonRoleCustom(roleGroup, juan.id, role),
  };
  const unnamed = {
    ...roleGroup,
    ...setMarkerPersonRoleCustom(roleGroup, vatoA.id, role),
  };
  const field =
    role === "both" ? "both_roles" : role === "either" ? "either" : role;
  assert.deepEqual(
    markerGroupRoleInputCustom(named, [vatoA])[`${field}_performer_ids`],
    [juan.id],
    `a named vato uses the ${role} role`
  );
  assert.equal(
    (
      markerGroupRoleInputCustom(unnamed, [vatoA])[
        `${field}_unnamed_performers`
      ] as Array<{ id: string }>
    )[0].id,
    vatoA.id,
    `an unnamed vato uses the ${role} role`
  );
}

// Legacy "Either · OR" groups: a vato in both lists meant either role, named
// or unnamed. Everything else becomes AND.
const legacyOr = normalizeMarkerGroupRolesCustom({
  groupId: "A",
  tag_ids: [],
  performer_mode: "OR",
  top_performer_ids: [juan, { id: vatoA.id, label: vatoA.label }],
  bottom_performer_ids: [juan, { id: vatoA.id, label: vatoA.label }],
});
assert.equal(legacyOr.performer_mode, "AND");
assert.deepEqual(
  markerGroupPeopleCustom(legacyOr).map((p) => p.role),
  ["either", "either"]
);
const legacyAnd = normalizeMarkerGroupRolesCustom({
  ...legacyOr,
  performer_mode: "AND",
  top_performer_ids: [juan],
  bottom_performer_ids: [juan],
  either_performer_ids: [],
});
assert.deepEqual(
  markerGroupPeopleCustom(legacyAnd).map((p) => p.role),
  ["both"],
  "AND with a vato in both lists keeps both roles"
);
const legacyUrl = new SceneMarkersCriterion();
legacyUrl.fromDecodedParams({
  modifier: "EQUALS",
  groups: [
    {
      groupId: "A",
      tag_ids: [{ id: "t", label: "Blowjob" }],
      depth: 0,
      performer_mode: "OR",
      top_performer_ids: [juan],
      bottom_performer_ids: [juan],
    },
  ],
  unnamed_performers: [],
});
const legacyRequest: Record<string, unknown> = {};
legacyUrl.applyToCriterionInput(legacyRequest);
assert.deepEqual(
  (legacyRequest._sceneMarkerIncludeCriteria as Record<string, unknown>[])[0]
    .either_performer_ids,
  [juan.id],
  "old any-role links keep meaning any role"
);

// Plain-language summary.
vatoA.ethnicities = ["Black"];
const summaryGroup = {
  ...roleGroup,
  tag_ids: [{ id: "t", label: "Blowjob" }],
  depth: -1,
  ...setMarkerPersonRoleCustom(
    { ...roleGroup, ...setMarkerPersonRoleCustom(roleGroup, juan.id, "top") },
    vatoA.id,
    "bottom"
  ),
};
assert.equal(
  markerGroupSentenceCustom(summaryGroup, [vatoA]),
  "Blowjob (+ sub-tags): ↑Juan, ↓Vato A (Black)"
);
assert.equal(
  markerCriterionSentenceCustom(
    [
      summaryGroup,
      {
        groupId: "2",
        tag_ids: [{ id: "f", label: "Facial" }],
        performer_mode: "AND",
        top_performer_ids: [],
        bottom_performer_ids: [],
      },
    ],
    [vatoA],
    "while"
  ),
  "Blowjob (+ sub-tags): ↑Juan, ↓Vato A (Black) while Facial"
);

for (const CriterionClass of [
  MarkerPerformersCriterion,
  SceneMarkersCriterion,
  SceneMarkersExcludeCriterion,
]) {
  const original = new CriterionClass();
  const originalValue = JSON.stringify(original.value);
  const draft = markerEditorDraftCustom(original);
  const group = markerEditorGroupsCustom(draft)[0];
  assert.equal(
    JSON.stringify(original.value),
    originalValue,
    "opening an editor never modifies its source"
  );
  assert.ok(
    draft instanceof CriterionClass,
    "draft retains the original criterion's serialization"
  );
  assert.equal(markerEditorGroupsCustom(draft).length, 1);
  assert.equal(draft.isValid(), false, "an empty filter cannot be applied");

  group.tag_ids = [
    { id: "tag-sex", label: "Sex" },
    { id: "tag-oral", label: "Oral" },
  ];
  if ("include_subtags" in group) group.include_subtags = true;
  else group.depth = -1;

  const vato = createUnnamedPerformer([]);
  vato.ethnicities = ["Latino"];
  vato.countries = ["Colombia"];
  vato.rating = { modifier: CriterionModifier.GreaterThan, value: 80 };
  vato.rating_criteria = {
    criteria: {
      test: {
        modifier: CriterionModifier.Between,
        value: { value: 3, value2: 7 },
      },
    },
    bonusValues: {
      bonus: {
        modifier: CriterionModifier.GreaterThanEquals,
        value: { value: 2 },
      },
    },
    bonuses: { present: true },
    penalties: { absent: false },
  };
  saveMarkerUnnamedCustom(draft, vato, {
    groupId: group.groupId,
    role: "top",
  });
  assert.equal(draft.value.unnamed_performers.length, 1);
  assert.equal(
    markerGroupPeopleCustom(group)[0].id,
    vato.id,
    "creating a vato adds it to the marker in the same update"
  );
  assert.equal(markerGroupPeopleCustom(group)[0].role, "top");
  vato.rating_criteria.criteria.test!.value.value = 99;
  assert.equal(
    draft.value.unnamed_performers[0].rating_criteria!.criteria.test!.value
      .value,
    3,
    "saving isolates nested rating criteria"
  );

  const secondId = draft.addGroup();
  const second = markerEditorGroupsCustom(draft).find(
    (g) => g.groupId === secondId
  )!;
  assignMarkerUnnamedCustom(
    second,
    draft.value.unnamed_performers[0],
    "bottom"
  );
  assignMarkerUnnamedCustom(second, draft.value.unnamed_performers[0], "top");
  assert.equal(
    markerGroupPeopleCustom(second).length,
    1,
    "reusing is idempotent"
  );
  assert.deepEqual(
    markerUnnamedUsesCustom(markerEditorGroupsCustom(draft), vato.id),
    [
      { groupId: group.groupId, index: 0, role: "top" },
      { groupId: secondId, index: 1, role: "bottom" },
    ]
  );
  const edited = cloneUnnamedPerformer(draft.value.unnamed_performers[0]);
  edited.label = "Shared vato";
  saveMarkerUnnamedCustom(draft, edited);
  assert.equal(markerGroupPeopleCustom(group)[0].label, "Shared vato");
  assert.equal(markerGroupPeopleCustom(second)[0].label, "Shared vato");

  const request: Record<string, unknown> = {};
  draft.applyToCriterionInput(request);
  const cloned = markerEditorDraftCustom(draft);
  const clonedRequest: Record<string, unknown> = {};
  cloned.applyToCriterionInput(clonedRequest);
  assert.deepEqual(
    clonedRequest,
    request,
    "opening and applying an unchanged filter preserves GraphQL exactly"
  );
  const roundTrip = new CriterionClass();
  roundTrip.fromDecodedParams(draft.toQueryParams());
  const restoredRequest: Record<string, unknown> = {};
  roundTrip.applyToCriterionInput(restoredRequest);
  assert.deepEqual(
    restoredRequest,
    request,
    "edited filters retain URL persistence including rating criteria and shared identities"
  );
  const saved: Record<string, unknown> = {};
  draft.applyToSavedCriterion(saved);
  const restored = new CriterionClass();
  restored.setFromSavedCriterion(
    saved[draft.criterionOption.type] as Record<string, unknown>
  );
  const savedRequest: Record<string, unknown> = {};
  restored.applyToCriterionInput(savedRequest);
  assert.deepEqual(
    savedRequest,
    request,
    "saved filter persistence is unchanged"
  );

  // Apply removes empty markers and unused vatos.
  const pruneDraft = markerEditorDraftCustom(draft);
  pruneDraft.addGroup();
  saveMarkerUnnamedCustom(
    pruneDraft,
    createUnnamedPerformer(pruneDraft.value.unnamed_performers)
  );
  const applied = markerEditorAppliedCustom(pruneDraft);
  assert.equal(markerEditorGroupsCustom(applied).length, 2);
  assert.equal(applied.value.unnamed_performers.length, 1);
  assert.equal(markerEditorGroupsCustom(pruneDraft).length, 3);
  const emptyApplied = markerEditorAppliedCustom(
    markerEditorDraftCustom(new CriterionClass())
  );
  assert.equal(emptyApplied.isValid(), false);

  const removalDraft = markerEditorDraftCustom(draft);
  removeMarkerUnnamedCustom(removalDraft, vato.id);
  assert.equal(
    markerUnnamedUsesCustom(markerEditorGroupsCustom(removalDraft), vato.id)
      .length,
    0,
    "deleting a definition clears all its role references"
  );
  assert.equal(removalDraft.value.unnamed_performers.length, 0);
  assert.equal(
    markerUnnamedUsesCustom(markerEditorGroupsCustom(draft), vato.id).length,
    2,
    "deleting in a new draft can still be cancelled"
  );
  assert.equal(
    JSON.stringify(original.value),
    originalValue,
    "cancelling the editor leaves the original filter untouched"
  );
}

// Empty configurations never reach the backend or switch Marker Match into
// overlap mode.
const markerMatch = new MarkerPerformersCriterion();
markerMatch.ensureGroups();
markerMatch.getGroups()[0].tag_ids = [{ id: "t", label: "Blowjob" }];
markerMatch.addGroup();
const markerMatchRequest: Record<string, unknown> = {};
markerMatch.applyToCriterionInput(markerMatchRequest);
assert.equal(
  (markerMatchRequest._sceneMarkerIncludeCriteria as unknown[]).length,
  1
);
assert.equal(markerMatchRequest._sceneMarkerOverlapCriteria, undefined);

const legacy = new MarkerPerformersCriterion();
legacy.value.tag_ids = [{ id: "legacy", label: "Legacy" }];
legacy.value.include_subtags = true;
legacy.value.top_any_count = 3;
const legacyDraft = markerEditorDraftCustom(legacy);
assert.equal(legacy.value.groups, undefined);
assert.equal(
  legacyDraft.getGroups()[0].top_any_count,
  3,
  "legacy fields survive editing"
);
assert.equal(legacyDraft.getGroups()[0].include_subtags, true);

const overlapping = markerEditorDraftCustom(new SceneMarkersCriterion());
overlapping.value.require_overlap = true;
overlapping.addGroup();
assert.equal(markerEditorDraftCustom(overlapping).value.require_overlap, true);

console.log(
  "Marker editor: roles, legacy migration, summaries, pruning, draft isolation, rating criteria, URL/saved-filter persistence, and legacy preservation passed."
);
