import assert from "node:assert/strict";
import test from "node:test";

import {
  getSceneMarkerDuplicateValues,
  getSceneMarkerGapDraftValues,
  getSceneMarkerInsertRangeErrors,
  getSceneMarkerInsertRecordKind,
  getSceneMarkerSplitBounds,
  INSERT_MARKER_END_OUT_OF_BOUNDS,
  INSERT_MARKER_END_REQUIRED,
  INSERT_MARKER_SOURCE_END_REQUIRED,
  INSERT_MARKER_START_OUT_OF_BOUNDS,
} from "../src/components/Scenes/SceneDetails/sceneMarkerFormActions_custom.ts";

test("a selected marker range becomes one complete gap draft", () => {
  const original = {
    insert_mode: "marker" as const,
    title: "Keep unrelated draft fields",
    seconds: 10,
    end_seconds: 20,
  };

  assert.deepEqual(
    getSceneMarkerGapDraftValues(original, {
      seconds: 12.345,
      end_seconds: 18.765,
    }),
    {
      ...original,
      insert_mode: "gap",
      seconds: 12.345,
      end_seconds: 18.765,
    }
  );
});

assert.equal(
  getSceneMarkerInsertRecordKind("marker"),
  "scene-marker",
  "regular insert mode creates a scene marker in the selected range"
);
assert.equal(
  getSceneMarkerInsertRecordKind("negative-marker"),
  "negative-marker",
  "negative insert mode creates a negative marker in the selected range"
);
assert.equal(
  getSceneMarkerInsertRecordKind("gap"),
  undefined,
  "gap mode creates no record in the selected range"
);

assert.deepEqual(
  getSceneMarkerDuplicateValues({
    title: "Original marker",
    seconds: 600,
    end_seconds: 660,
    primary_tag: { id: "primary" },
    tags: [{ id: "tag-1" }, { id: "tag-2" }],
    top_performers: [{ id: "top-1" }],
    bottom_performers: [{ id: "bottom-1" }],
  }),
  {
    title: "Original marker",
    seconds: 600,
    end_seconds: 660,
    primary_tag_id: "primary",
    tag_ids: ["tag-1", "tag-2"],
    top_performer_ids: ["top-1"],
    bottom_performer_ids: ["bottom-1"],
  },
  "duplicate drafts preserve every editable marker field"
);

assert.deepEqual(
  getSceneMarkerInsertRangeErrors(
    { seconds: 600, end_seconds: 660 },
    { seconds: 624.768, end_seconds: 630.25 }
  ),
  {},
  "a marker strictly inside the original millisecond bounds is valid"
);

assert.deepEqual(
  getSceneMarkerInsertRangeErrors(
    { seconds: 600, end_seconds: 660 },
    { seconds: 600, end_seconds: 660 }
  ),
  {
    seconds: INSERT_MARKER_START_OUT_OF_BOUNDS,
    end_seconds: INSERT_MARKER_END_OUT_OF_BOUNDS,
  },
  "an inserted marker cannot consume either original boundary"
);

assert.deepEqual(
  getSceneMarkerInsertRangeErrors(
    { seconds: 600, end_seconds: 660 },
    { seconds: 661, end_seconds: 599 }
  ),
  {
    seconds: INSERT_MARKER_START_OUT_OF_BOUNDS,
    end_seconds: INSERT_MARKER_END_OUT_OF_BOUNDS,
  },
  "both inserted marker times must remain inside the original range"
);

assert.deepEqual(
  getSceneMarkerInsertRangeErrors(
    { seconds: 600, end_seconds: 660 },
    { seconds: 610, end_seconds: null }
  ),
  { end_seconds: INSERT_MARKER_END_REQUIRED },
  "an inserted marker must define its end time"
);

assert.deepEqual(
  getSceneMarkerInsertRangeErrors(
    { seconds: 600, end_seconds: null },
    { seconds: 610, end_seconds: 620 }
  ),
  { end_seconds: INSERT_MARKER_SOURCE_END_REQUIRED },
  "an open-ended original marker cannot be split"
);

assert.deepEqual(
  getSceneMarkerSplitBounds({
    seconds: 624.768,
    end_seconds: 630.25,
  }),
  {
    leftEndSeconds: 624.767,
    rightStartSeconds: 630.251,
  },
  "split boundaries are exactly one millisecond outside the inserted marker"
);
