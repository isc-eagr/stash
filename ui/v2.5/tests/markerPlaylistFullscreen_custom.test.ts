import assert from "node:assert/strict";

import {
  exitMarkerPlayerFullscreenCustom,
  isMarkerPlayerNativeFullscreenCustom,
  requestMarkerPlayerFullscreenCustom,
  shouldLockMarkerPlayerLandscapeCustom,
} from "../src/components/Scenes/markerPlaylistFullscreen_custom.ts";

let requested = 0;
const target = {
  requestFullscreen() {
    requested += 1;
    return Promise.resolve();
  },
};

assert.equal(
  await requestMarkerPlayerFullscreenCustom(target, {
    fullscreenEnabled: true,
  }),
  true,
  "supported browsers use the native Fullscreen API"
);
assert.equal(requested, 1);

assert.equal(
  await requestMarkerPlayerFullscreenCustom(target, {
    fullscreenEnabled: false,
  }),
  false,
  "iPhone Safari reports element fullscreen as disabled, so the player fills the viewport"
);
assert.equal(requested, 1, "a disabled API is not called");

assert.equal(
  await requestMarkerPlayerFullscreenCustom({}, {}),
  false,
  "a missing API falls back to filling the viewport"
);

assert.equal(
  await requestMarkerPlayerFullscreenCustom(
    { requestFullscreen: () => Promise.reject(new TypeError("denied")) },
    {}
  ),
  false,
  "a rejected request falls back to filling the viewport"
);

let webkitRequested = false;
assert.equal(
  await requestMarkerPlayerFullscreenCustom(
    {
      webkitRequestFullscreen() {
        webkitRequested = true;
      },
    },
    { webkitFullscreenEnabled: true }
  ),
  true,
  "older WebKit uses the prefixed API"
);
assert.equal(webkitRequested, true);

const element = {} as Element;
assert.equal(isMarkerPlayerNativeFullscreenCustom({}), false);
assert.equal(
  isMarkerPlayerNativeFullscreenCustom({ webkitFullscreenElement: element }),
  true
);

let exited = false;
exitMarkerPlayerFullscreenCustom({
  webkitExitFullscreen() {
    exited = true;
  },
});
assert.equal(exited, true, "exit uses the prefixed API when needed");
exitMarkerPlayerFullscreenCustom({
  exitFullscreen: () => Promise.reject(new TypeError("not fullscreen")),
});
exitMarkerPlayerFullscreenCustom({});

assert.equal(
  shouldLockMarkerPlayerLandscapeCustom(
    { videoWidth: 1920, videoHeight: 1080 },
    true
  ),
  true,
  "landscape videos rotate phones into landscape"
);
assert.equal(
  shouldLockMarkerPlayerLandscapeCustom(
    { videoWidth: 1080, videoHeight: 1920 },
    true
  ),
  false,
  "portrait videos keep the phone orientation"
);
assert.equal(
  shouldLockMarkerPlayerLandscapeCustom(
    { videoWidth: 1920, videoHeight: 1080 },
    false
  ),
  false,
  "desktop pointers never lock orientation"
);
assert.equal(shouldLockMarkerPlayerLandscapeCustom(null, true), false);
