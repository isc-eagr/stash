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

let receivedScrollOptions: { behavior: "smooth"; block: "nearest" } | undefined;
scrollMarkerPlaylistItemIntoViewCustom({
  scrollIntoView(options) {
    receivedScrollOptions = options;
  },
});
assert.deepEqual(
  receivedScrollOptions,
  { behavior: "smooth", block: "nearest" },
  "the active playlist marker is brought into the nearest visible position smoothly"
);
scrollMarkerPlaylistItemIntoViewCustom(null);
