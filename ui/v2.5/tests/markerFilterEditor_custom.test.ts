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
  assignMarkerUnnamedCustom,
  copyMarkerUnnamedCustom,
  markerEditorDraftCustom,
  markerEditorGroupsCustom,
  markerUnnamedUsesCustom,
  mergeMarkerNamedVatosCustom,
  removeMarkerUnnamedCustom,
  saveMarkerUnnamedCustom,
} from "../src/components/List/Filters/markerFilterEditor_custom";

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

  group.tag_ids = [
    { id: "tag-sex", label: "Sex" },
    { id: "tag-oral", label: "Oral" },
  ];
  if ("include_subtags" in group) group.include_subtags = true;
  else group.depth = -1;
  group.performer_mode = "AND";

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
    role: "top_performer_ids",
  });
  assert.equal(draft.value.unnamed_performers.length, 1);
  assert.equal(
    group.top_performer_ids[0].id,
    vato.id,
    "creating a vato assigns it in the same update"
  );
  vato.rating_criteria.criteria.test!.value.value = 99;
  assert.equal(
    draft.value.unnamed_performers[0].rating_criteria!.criteria.test!.value
      .value,
    3,
    "saving isolates nested rating criteria"
  );

  for (let i = 0; i < 3; i++) {
    const copy = copyMarkerUnnamedCustom(
      draft.value.unnamed_performers[0],
      draft.value.unnamed_performers
    );
    saveMarkerUnnamedCustom(draft, copy, {
      groupId: group.groupId,
      role: "top_performer_ids",
    });
  }
  const currentGroup = markerEditorGroupsCustom(draft)[0];
  assert.equal(
    new Set(currentGroup.top_performer_ids.map((p) => p.id)).size,
    4,
    "four copied vatos keep four distinct identities"
  );
  const copy = draft.value.unnamed_performers[1];
  copy.rating_criteria!.criteria.test!.value.value = 6;
  assert.equal(
    draft.value.unnamed_performers[0].rating_criteria!.criteria.test!.value
      .value,
    3
  );

  const secondId = draft.addGroup();
  const second = markerEditorGroupsCustom(draft).find(
    (g) => g.groupId === secondId
  )!;
  assignMarkerUnnamedCustom(
    second,
    "bottom_performer_ids",
    draft.value.unnamed_performers[0]
  );
  assignMarkerUnnamedCustom(
    second,
    "bottom_performer_ids",
    draft.value.unnamed_performers[0]
  );
  assert.equal(second.bottom_performer_ids.length, 1, "reusing is idempotent");
  assert.deepEqual(
    markerUnnamedUsesCustom(markerEditorGroupsCustom(draft), vato.id),
    [
      { groupId: group.groupId, role: "top_performer_ids" },
      { groupId: secondId, role: "bottom_performer_ids" },
    ]
  );
  const edited = cloneUnnamedPerformer(draft.value.unnamed_performers[0]);
  edited.label = "Shared vato";
  saveMarkerUnnamedCustom(draft, edited);
  assert.equal(
    markerEditorGroupsCustom(draft)[0].top_performer_ids[0].label,
    "Shared vato"
  );
  assert.equal(second.bottom_performer_ids[0].label, "Shared vato");

  const merged = mergeMarkerNamedVatosCustom(currentGroup.top_performer_ids, [
    { id: "42", name: "Named vato" },
  ]);
  assert.equal(merged.length, 5, "named selections retain all unnamed slots");
  currentGroup.top_performer_ids = merged;
  assert.equal(mergeMarkerNamedVatosCustom(merged, []).length, 4);

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
  const removalDraft = markerEditorDraftCustom(draft);
  removeMarkerUnnamedCustom(removalDraft, vato.id);
  assert.equal(
    markerUnnamedUsesCustom(markerEditorGroupsCustom(removalDraft), vato.id)
      .length,
    0,
    "deleting a definition clears all its role references"
  );
  assert.equal(removalDraft.value.unnamed_performers.length, 3);
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
  "Marker editor: draft isolation, role assignments, copies, reuse, rating criteria, URL/saved-filter persistence, and legacy preservation passed."
);
