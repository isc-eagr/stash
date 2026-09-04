import assert from "node:assert/strict";
import test from "node:test";
import { changedSceneEditFieldsCustom } from "../src/components/Scenes/SceneDetails/sceneEditInput_custom.ts";

test("scene edit input includes only fields whose values changed", () => {
  const initial = {
    title: "Old title",
    performer_ids: ["1", "2"],
    tag_ids: ["3"],
    custom_fields: { source: "manual" },
  };

  assert.deepEqual(
    changedSceneEditFieldsCustom(
      {
        ...initial,
        title: "New title",
      },
      initial
    ),
    { title: "New title" }
  );
});

test("scene edit input detects nested relationship and custom-field changes", () => {
  const initial = {
    groups: [{ group_id: "1", scene_index: 2 }],
    custom_fields: { source: "manual" },
  };

  assert.deepEqual(
    changedSceneEditFieldsCustom(
      {
        groups: [{ group_id: "1", scene_index: 3 }],
        custom_fields: { source: "scraped" },
      },
      initial
    ),
    {
      groups: [{ group_id: "1", scene_index: 3 }],
      custom_fields: { source: "scraped" },
    }
  );
});
