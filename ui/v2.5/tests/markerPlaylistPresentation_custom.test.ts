import assert from "node:assert/strict";

import {
  getMarkerPlaylistImageUrlCustom,
  scrollMarkerPlaylistItemIntoViewCustom,
} from "../src/components/Scenes/markerPlaylistPresentation_custom.ts";

assert.equal(
  getMarkerPlaylistImageUrlCustom({
    screenshot: "/scene-marker/screenshot.jpg",
    preview: "/scene-marker/preview.webp",
  }),
  "/scene-marker/screenshot.jpg",
  "the playlist uses a generated marker screenshot before the optional WebP preview"
);
assert.equal(
  getMarkerPlaylistImageUrlCustom({
    screenshot: "",
    preview: "/scene-marker/preview.webp",
  }),
  "/scene-marker/preview.webp",
  "the playlist falls back to the WebP preview when no screenshot URL is available"
);

function scrollFor(item: { top: number; bottom: number }) {
  const scrolls: Array<{ top: number; behavior: "smooth" }> = [];
  scrollMarkerPlaylistItemIntoViewCustom({
    getBoundingClientRect: () => item,
    parentElement: {
      getBoundingClientRect: () => ({ top: 100, bottom: 300 }),
      scrollBy: (options) => scrolls.push(options),
    },
  });
  return scrolls;
}

assert.deepEqual(
  scrollFor({ top: 150, bottom: 200 }),
  [],
  "a visible active marker leaves the playlist where it is"
);
assert.deepEqual(
  scrollFor({ top: 40, bottom: 90 }),
  [{ top: -60, behavior: "smooth" }],
  "an active marker above the playlist scrolls it to the top edge"
);
assert.deepEqual(
  scrollFor({ top: 320, bottom: 370 }),
  [{ top: 70, behavior: "smooth" }],
  "an active marker below the playlist scrolls it to the bottom edge"
);
assert.deepEqual(
  scrollFor({ top: 250, bottom: 600 }),
  [{ top: 150, behavior: "smooth" }],
  "an item taller than the playlist keeps its top visible"
);
scrollMarkerPlaylistItemIntoViewCustom(null);
