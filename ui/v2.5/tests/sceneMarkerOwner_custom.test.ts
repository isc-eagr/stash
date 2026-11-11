import assert from "node:assert/strict";
import {
  buildSceneMarkerDestroyCustom,
  buildSceneMarkerSaveCustom,
  buildSceneNegativeMarkerDestroyCustom,
  buildSceneNegativeMarkerSaveCustom,
  SCENE_MARKER_PRIMARY_TAG_REQUIRED,
  SCENE_NEGATIVE_MARKER_RANGE_REQUIRED,
  sceneMarkerValuesFromMarkerCustom,
} from "../src/components/Scenes/SceneDetails/sceneMarkerOwner_custom.ts";

const scene = { sceneId: "10" };
const release = { sceneId: "10", releaseId: "20" };
const values = {
  title: "Kiss",
  seconds: 5,
  end_seconds: undefined,
  primary_tag_id: "t1",
  tag_ids: ["t2"],
  top_performer_ids: ["p1"],
  bottom_performer_ids: ["p2"],
};
const fields = {
  title: "Kiss",
  seconds: 5,
  end_seconds: null,
  primary_tag_id: "t1",
  tag_ids: ["t2"],
  top_performer_ids: ["p1"],
  bottom_performer_ids: ["p2"],
};

// Marker create and update.
assert.deepEqual(buildSceneMarkerSaveCustom(scene, values), {
  kind: "scene-create",
  variables: { scene_id: "10", ...fields },
});
assert.deepEqual(buildSceneMarkerSaveCustom(scene, values, "m1"), {
  kind: "scene-update",
  variables: { id: "m1", scene_id: "10", ...fields },
});
assert.deepEqual(buildSceneMarkerSaveCustom(release, values), {
  kind: "release-save",
  input: { release_id: "20", id: undefined, ...fields },
});
assert.deepEqual(buildSceneMarkerSaveCustom(release, values, "m1"), {
  kind: "release-save",
  input: { release_id: "20", id: "m1", ...fields },
});
assert.throws(
  () => buildSceneMarkerSaveCustom(release, { ...values, primary_tag_id: "" }),
  { message: SCENE_MARKER_PRIMARY_TAG_REQUIRED }
);

// Marker destroy.
assert.deepEqual(buildSceneMarkerDestroyCustom(scene, "m1"), {
  kind: "scene",
  variables: { id: "m1" },
});
assert.deepEqual(buildSceneMarkerDestroyCustom(release, "m1"), {
  kind: "release",
  variables: { release_id: "20", marker_id: "m1" },
});

// Split and gap fixes resave a marker from its saved fields.
const saved = {
  title: "Oral",
  seconds: 10,
  end_seconds: 20,
  primary_tag: { id: "t1", name: "Oral", parents: [] },
  tags: [{ id: "t2", name: "Deep", parents: [] }],
  top_performers: [{ id: "p1" }],
  bottom_performers: null,
};
assert.deepEqual(sceneMarkerValuesFromMarkerCustom(saved, { seconds: 15 }), {
  title: "Oral",
  seconds: 15,
  end_seconds: 20,
  primary_tag_id: "t1",
  tag_ids: ["t2"],
  top_performer_ids: ["p1"],
  bottom_performer_ids: [],
});
assert.equal(
  sceneMarkerValuesFromMarkerCustom({ ...saved, end_seconds: undefined })
    .end_seconds,
  null
);

// Skip-range create, full update, and partial (gap fix) update.
const range = { name: "Ad", start_seconds: 1, end_seconds: 2 };
assert.deepEqual(buildSceneNegativeMarkerSaveCustom(scene, range), {
  kind: "scene-create",
  input: { scene_id: "10", ...range },
});
assert.deepEqual(
  buildSceneNegativeMarkerSaveCustom(scene, range, { id: "n1" }),
  { kind: "scene-update", input: { id: "n1", ...range } }
);
assert.deepEqual(
  buildSceneNegativeMarkerSaveCustom(
    scene,
    { end_seconds: 3 },
    { id: "n1", existing: range }
  ),
  { kind: "scene-update", input: { id: "n1", end_seconds: 3 } }
);
assert.deepEqual(buildSceneNegativeMarkerSaveCustom(release, range), {
  kind: "release-save",
  input: { release_id: "20", id: undefined, ...range },
});
assert.deepEqual(
  buildSceneNegativeMarkerSaveCustom(
    release,
    { start_seconds: 0.5 },
    { id: "n1", existing: range }
  ),
  {
    kind: "release-save",
    input: {
      release_id: "20",
      id: "n1",
      name: "Ad",
      start_seconds: 0.5,
      end_seconds: 2,
    },
  }
);
assert.deepEqual(
  buildSceneNegativeMarkerSaveCustom(release, {
    start_seconds: 1,
    end_seconds: 2,
  }).input,
  {
    release_id: "20",
    id: undefined,
    name: "",
    start_seconds: 1,
    end_seconds: 2,
  }
);
assert.throws(
  () =>
    buildSceneNegativeMarkerSaveCustom(
      release,
      { end_seconds: 3 },
      { id: "n1" }
    ),
  { message: SCENE_NEGATIVE_MARKER_RANGE_REQUIRED }
);
assert.throws(() => buildSceneNegativeMarkerSaveCustom(scene, { name: "Ad" }), {
  message: SCENE_NEGATIVE_MARKER_RANGE_REQUIRED,
});

// Skip-range destroy.
assert.deepEqual(buildSceneNegativeMarkerDestroyCustom(scene, "n1"), {
  kind: "scene",
  variables: { id: "n1" },
});
assert.deepEqual(buildSceneNegativeMarkerDestroyCustom(release, "n1"), {
  kind: "release",
  variables: { release_id: "20", marker_id: "n1" },
});

// Marker <-> skip conversion (the in-between insert) creates the other kind
// on the same owner, then rolls back with that owner's destroy.
const insertedRange = {
  name: values.title,
  start_seconds: 12,
  end_seconds: 14,
};
assert.equal(
  buildSceneNegativeMarkerSaveCustom(release, insertedRange).kind,
  "release-save"
);
assert.deepEqual(
  buildSceneNegativeMarkerSaveCustom(release, insertedRange).input,
  { release_id: "20", id: undefined, ...insertedRange }
);
assert.equal(
  buildSceneNegativeMarkerDestroyCustom(release, "n9").kind,
  "release"
);
const skipAsMarker = buildSceneMarkerSaveCustom(
  release,
  sceneMarkerValuesFromMarkerCustom(saved, {
    seconds: range.start_seconds,
    end_seconds: range.end_seconds,
  })
);
assert.equal(skipAsMarker.kind, "release-save");
