import assert from "node:assert/strict";

import {
  getSceneNegativeMarkerDuration,
  getSceneNegativeMarkerInitialRange,
  getSceneNegativeMarkerSequentialRange,
} from "../src/components/Scenes/SceneDetails/sceneNegativeMarkerForm_custom.ts";
import {
  canCreateMarkerTitle,
  mergeMarkerTitleSuggestions,
  sortMarkerTitleSuggestionsByUsage,
} from "../src/components/Shared/markerTitleSuggestions_custom.ts";

assert.deepEqual(
  getSceneNegativeMarkerInitialRange({
    playerPosition: 42.4567,
  }),
  {
    start_seconds: 42.457,
    end_seconds: 52.457,
  },
  "new negative markers retain the player position to the nearest millisecond"
);

assert.deepEqual(
  getSceneNegativeMarkerInitialRange({
    playerPosition: 90,
    abLoop: {
      enabled: true,
      start: 60.25,
      end: 80.75,
    },
  }),
  {
    start_seconds: 60.25,
    end_seconds: 80.75,
  },
  "an active A-B loop initializes the negative marker range"
);

assert.deepEqual(
  getSceneNegativeMarkerInitialRange({
    playerPosition: 75.4567,
    abLoop: {
      enabled: true,
      start: 60,
      end: false,
    },
  }),
  {
    start_seconds: 60,
    end_seconds: 75.457,
  },
  "an active loop without a B point keeps the later player position to milliseconds"
);

assert.deepEqual(
  getSceneNegativeMarkerInitialRange({
    playerPosition: 40,
    abLoop: {
      enabled: true,
      start: 60,
      end: false,
    },
  }),
  {
    start_seconds: 60,
    end_seconds: 70,
  },
  "an active loop without a usable B point still creates a valid range"
);

assert.deepEqual(
  getSceneNegativeMarkerInitialRange({
    marker: {
      start_seconds: 15,
      end_seconds: 25,
    },
    playerPosition: 90,
    abLoop: {
      enabled: true,
      start: 60,
      end: 80,
    },
  }),
  {
    start_seconds: 15,
    end_seconds: 25,
  },
  "editing preserves the saved negative marker range"
);

assert.equal(
  getSceneNegativeMarkerDuration(60.25, 80.75),
  20.5,
  "duration is calculated from the live range"
);
assert.equal(
  getSceneNegativeMarkerDuration(80, 60),
  undefined,
  "invalid ranges do not display a duration"
);

assert.deepEqual(
  getSceneNegativeMarkerSequentialRange(80.75),
  {
    start_seconds: 80.751,
    end_seconds: 90.751,
  },
  "the next negative marker starts one millisecond after the saved marker"
);

const markerTitleSuggestions = mergeMarkerTitleSuggestions(
  ["Regular title", "Shared title"],
  ["Skip intro", " shared title ", "SKIP INTRO", "", "  "],
  false
);

assert.deepEqual(
  markerTitleSuggestions,
  ["Skip intro", "shared title"],
  "negative marker suggestions exclude regular titles and remove negative-title duplicates"
);
assert.deepEqual(
  sortMarkerTitleSuggestionsByUsage([
    { title: "Oral", count: 4 },
    { title: "Anal", count: 8 },
    { title: "Blowjob", count: 4 },
    { title: "", count: 99 },
  ]),
  ["Anal", "Blowjob", "Oral"],
  "regular marker titles rank by usage, with alphabetical ordering only for ties"
);
assert.equal(
  canCreateMarkerTitle("  SKIP INTRO ", markerTitleSuggestions),
  false,
  "an existing negative marker title is selected instead of offered as Create"
);
assert.equal(
  canCreateMarkerTitle("Skip credits", markerTitleSuggestions),
  true,
  "a genuinely new negative marker title can still be created"
);
