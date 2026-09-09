import assert from "node:assert/strict";
import test from "node:test";

import {
  getSequentialMarkerDraft,
  getSequentialMarkerStart,
  hasSequentialMarkerEnd,
} from "../src/components/Scenes/SceneDetails/sceneMarkerSequentialActions_custom.ts";

const current = {
  insert_mode: "marker" as const,
  title: "Current setup",
  seconds: 12,
  end_seconds: 18.456,
  primary_tag_id: "sex",
  tag_ids: ["outstanding"],
  top_performer_ids: ["1"],
  bottom_performer_ids: ["2"],
};

test("sequential actions require a captured finite end time", () => {
  assert.equal(hasSequentialMarkerEnd(null), false);
  assert.equal(hasSequentialMarkerEnd(undefined), false);
  assert.equal(hasSequentialMarkerEnd(Number.NaN), false);
  assert.equal(hasSequentialMarkerEnd(0), true);
});

test("the next marker begins exactly one millisecond after the current end", () => {
  assert.equal(getSequentialMarkerStart(18.456), 18.457);
  assert.deepEqual(getSequentialMarkerDraft(current, "marker"), {
    ...current,
    seconds: 18.457,
    end_seconds: null,
  });
});

test("the next negative marker starts after the current end with clean metadata", () => {
  assert.deepEqual(getSequentialMarkerDraft(current, "negative-marker"), {
    insert_mode: "negative-marker",
    title: "",
    seconds: 18.457,
    end_seconds: null,
    primary_tag_id: "",
    tag_ids: [],
    top_performer_ids: [],
    bottom_performer_ids: [],
  });
});

test("an inline negative-marker draft can continue to an adjacent regular marker", () => {
  assert.deepEqual(
    getSequentialMarkerDraft(
      {
        insert_mode: "negative-marker" as const,
        title: "Skip credits",
        seconds: 60,
        end_seconds: 90,
        primary_tag_id: "",
        tag_ids: [],
        top_performer_ids: [],
        bottom_performer_ids: [],
      },
      "marker"
    ),
    {
      insert_mode: "marker",
      title: "Skip credits",
      seconds: 90.001,
      end_seconds: null,
      primary_tag_id: "",
      tag_ids: [],
      top_performer_ids: [],
      bottom_performer_ids: [],
    }
  );
});
