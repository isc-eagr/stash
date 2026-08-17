import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  getSceneMarkerTimestampPickerHorizontalLayout,
  getSceneMarkerTimestampOptions,
  resolveSceneMarkerTimestampCopySelection,
  shouldScheduleSceneMarkerTimestampPickerHide,
  shouldShowSceneMarkerTooltip,
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
  "the picker presents both exact timestamps as separate selectable choices"
);

assert.deepEqual(
  getSceneMarkerTimestampOptions(marker).map((option) => option.seconds),
  [12.25, 38.5],
  "the reusable picker exposes exact start and end targets for scrubber seeking"
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

assert.equal(
  shouldShowSceneMarkerTooltip({
    activeOwner: negativeMarkerOwner,
    activeIsNegative: true,
    requestedOwner: regularMarkerOwner,
    requestedIsNegative: false,
  }),
  false,
  "a regular-marker hover cannot replace an overlapping negative-marker popup"
);
assert.equal(
  shouldShowSceneMarkerTooltip({
    activeOwner: regularMarkerOwner,
    activeIsNegative: false,
    requestedOwner: negativeMarkerOwner,
    requestedIsNegative: true,
  }),
  true,
  "a negative-marker hover immediately takes ownership from a regular marker"
);

assert.equal(
  shouldShowSceneMarkerTooltip({
    activeOwner: negativeMarkerOwner,
    activeIsNegative: true,
    requestedOwner: regularMarkerOwner,
    requestedIsNegative: false,
  }),
  false,
  "timestamp-copy pickers can use the same negative-over-regular ownership rule"
);

const timelineMarkerSource = readFileSync(
  new URL("../src/components/ScenePlayer/markers.ts", import.meta.url),
  "utf8"
);
const thumbnailScrubberSource = readFileSync(
  new URL(
    "../src/components/ScenePlayer/ScenePlayerScrubber.tsx",
    import.meta.url
  ),
  "utf8"
);

assert.match(
  timelineMarkerSource,
  /scene-marker-timeline-seek-picker[\s\S]*?appendTimestampRangeChips\([\s\S]*?"seek"/,
  "normal Video.js marker hover cards include direct start/end seek chips"
);
assert.match(
  timelineMarkerSource,
  /cursorClientX !== undefined[\s\S]*?cursorClientX - parentRect\.left/,
  "normal Video.js marker hover cards anchor horizontally at the cursor"
);
assert.match(
  timelineMarkerSource,
  /timestampCopyPickerOwnerIsNegative[\s\S]*?shouldShowSceneMarkerTooltip\([\s\S]*?requestedIsNegative:\s*isNegativeMarker/,
  "the Video.js timestamp-copy picker rejects competing regular-marker hover events while a negative marker owns it"
);
assert.match(
  thumbnailScrubberSource,
  /scrubber-negative-markers-timestamp-copy/,
  "the thumbnail scrubber gives negative marker hit targets deterministic overlap priority in copy mode"
);
assert.match(
  thumbnailScrubberSource,
  /timestampCopyActive \? \([\s\S]*?<SceneMarkerTimestampCopyPopover[\s\S]*?: \([\s\S]*?<SceneMarkerHighlightPerformersPopover/,
  "the thumbnail scrubber keeps its performer/tag popup outside timestamp-copy mode"
);
