import assert from "node:assert/strict";

import {
  followRemovedIndexCustom,
  getMarkerPlayerSwipeDirectionCustom,
  getMarkerPlaylistStepIndexCustom,
} from "../src/components/Scenes/markerPlaylistNavigation_custom.ts";

const none = () => false;
assert.equal(getMarkerPlaylistStepIndexCustom(5, 1, 1, none), 2);
assert.equal(getMarkerPlaylistStepIndexCustom(5, 4, 1, none), 0, "next wraps");
assert.equal(getMarkerPlaylistStepIndexCustom(5, 0, -1, none), 4, "prev wraps");

// Rapid taps step from the last requested marker, not the one still playing.
let requested = 1;
for (let tap = 0; tap < 3; tap += 1) {
  requested = getMarkerPlaylistStepIndexCustom(5, requested, 1, none) ?? -1;
}
assert.equal(requested, 4, "three quick taps from marker 2 reach marker 5");

const failed = new Set([2, 3]);
assert.equal(
  getMarkerPlaylistStepIndexCustom(5, 1, 1, (i) => failed.has(i)),
  4,
  "broken markers are skipped forward"
);
assert.equal(
  getMarkerPlaylistStepIndexCustom(5, 4, -1, (i) => failed.has(i)),
  1,
  "broken markers are skipped backward"
);
assert.equal(
  getMarkerPlaylistStepIndexCustom(3, 0, 1, (i) => i !== 0),
  0,
  "the only playable marker replays"
);
assert.equal(
  getMarkerPlaylistStepIndexCustom(3, 0, 1, () => true),
  undefined,
  "nothing playable stops the player"
);
assert.equal(getMarkerPlaylistStepIndexCustom(0, 0, 1, none), undefined);

assert.equal(followRemovedIndexCustom(3, 1, 4), 2, "earlier removals shift");
assert.equal(followRemovedIndexCustom(1, 3, 4), 1, "later removals keep it");
assert.equal(followRemovedIndexCustom(2, 2, 4), 2, "the next marker plays");
assert.equal(
  followRemovedIndexCustom(4, 4, 4),
  3,
  "removing the last steps back"
);
assert.equal(followRemovedIndexCustom(0, 0, 0), 0, "an empty playlist");

assert.equal(
  getMarkerPlayerSwipeDirectionCustom(-120, 10, 200),
  1,
  "left: next"
);
assert.equal(
  getMarkerPlayerSwipeDirectionCustom(120, -15, 200),
  -1,
  "right: prev"
);
assert.equal(
  getMarkerPlayerSwipeDirectionCustom(30, 0, 100),
  undefined,
  "short drags are taps"
);
assert.equal(
  getMarkerPlayerSwipeDirectionCustom(-80, 90, 200),
  undefined,
  "diagonal drags are scrolls"
);
assert.equal(
  getMarkerPlayerSwipeDirectionCustom(-200, 0, 1200),
  undefined,
  "slow drags are not swipes"
);
