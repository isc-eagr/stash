import assert from "node:assert/strict";

import {
  getSceneMarkerTimestampPickerHorizontalLayout,
  getSceneMarkerTimestampOptions,
  resolveSceneMarkerTimestampCopySelection,
  shouldScheduleSceneMarkerTimestampPickerHide,
} from "../src/components/ScenePlayer/sceneMarkerTimestampCopy_custom.ts";

const marker = { id: "marker-1", seconds: 12.25, end_seconds: 38.5 };

assert.deepEqual(
  resolveSceneMarkerTimestampCopySelection(
    {
      field: "end_seconds",
      destination: "scene-marker-form",
      requestId: 7,
    },
    marker,
    "start"
  ),
  {
    field: "end_seconds",
    destination: "scene-marker-form",
    requestId: 7,
    boundary: "start",
    markerId: "marker-1",
    seconds: 12.25,
  },
  "the source start is copied into the end field that launched copy mode"
);

assert.deepEqual(
  resolveSceneMarkerTimestampCopySelection(
    { field: "seconds", destination: "scene-marker-form", requestId: 8 },
    marker,
    "end"
  ),
  {
    field: "seconds",
    destination: "scene-marker-form",
    requestId: 8,
    boundary: "end",
    markerId: "marker-1",
    seconds: 38.5,
  },
  "the source end is copied into the start field that launched copy mode"
);

assert.equal(
  resolveSceneMarkerTimestampCopySelection(
    {
      field: "end_seconds",
      destination: "scene-marker-form",
      requestId: 9,
    },
    { id: "marker-2", seconds: 5, end_seconds: null },
    "end"
  ),
  undefined,
  "an open-ended marker does not expose a missing end timestamp"
);

assert.deepEqual(
  getSceneMarkerTimestampOptions(marker),
  [
    { boundary: "start", label: "Start", seconds: 12.25 },
    { boundary: "end", label: "End", seconds: 38.5 },
  ],
  "the picker presents both exact timestamps as separate labeled choices"
);

assert.deepEqual(
  getSceneMarkerTimestampOptions({
    id: "marker-2",
    seconds: 5,
    end_seconds: null,
  }),
  [{ boundary: "start", label: "Start", seconds: 5 }],
  "the picker presents only Start for an open-ended marker"
);

assert.deepEqual(
  [
    getSceneMarkerTimestampOptions({
      id: "previous",
      seconds: 8,
      end_seconds: 10,
    })[1],
    getSceneMarkerTimestampOptions({
      id: "next",
      seconds: 10.001,
      end_seconds: 12,
    })[0],
  ],
  [
    { boundary: "end", label: "End", seconds: 10 },
    { boundary: "start", label: "Start", seconds: 10.001 },
  ],
  "one-millisecond-adjacent boundaries remain distinct picker choices"
);

assert.deepEqual(
  resolveSceneMarkerTimestampCopySelection(
    {
      field: "start_seconds",
      destination: "negative-marker-form",
      requestId: 10,
    },
    { id: "negative-1", seconds: 14.125, end_seconds: 21.875 },
    "end"
  ),
  {
    field: "start_seconds",
    destination: "negative-marker-form",
    requestId: 10,
    boundary: "end",
    markerId: "negative-1",
    seconds: 21.875,
  },
  "a normalized negative-marker end can be copied into a negative-marker field"
);

assert.deepEqual(
  getSceneMarkerTimestampPickerHorizontalLayout({
    parentWidth: 1000,
    pickerWidth: 200,
    cursorX: 700,
  }),
  { left: 600, caretLeft: 100 },
  "the picker is centered on the cursor instead of the marker range"
);

assert.deepEqual(
  getSceneMarkerTimestampPickerHorizontalLayout({
    parentWidth: 1000,
    pickerWidth: 200,
    cursorX: 10,
  }),
  { left: 6, caretLeft: 18 },
  "the picker and its caret remain usable when the cursor is near an edge"
);

const regularMarkerOwner = { kind: "regular" };
const negativeMarkerOwner = { kind: "negative" };
assert.equal(
  shouldScheduleSceneMarkerTimestampPickerHide(
    negativeMarkerOwner,
    regularMarkerOwner
  ),
  false,
  "a stale regular-marker leave cannot hide an overlapping negative picker"
);
assert.equal(
  shouldScheduleSceneMarkerTimestampPickerHide(
    negativeMarkerOwner,
    negativeMarkerOwner
  ),
  true,
  "the active negative marker retains ownership of its picker lifecycle"
);
