import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import cx from "classnames";
import { compile } from "sass";

import { scenePlayerControlClassesCustom } from "../src/components/ScenePlayer/scenePlayerControlVisibility_custom.ts";

const hiddenDefaults = {
  "scene-player-hide-chromecast": true,
  "scene-player-hide-stream": true,
  "scene-player-hide-autostart": true,
};

for (const config of [undefined, null, {}]) {
  assert.deepEqual(
    scenePlayerControlClassesCustom(config),
    hiddenDefaults,
    "existing and missing configurations hide all three controls"
  );
}

const preferences = [
  ["showScenePlayerChromecastControl", "scene-player-hide-chromecast"],
  ["showScenePlayerStreamControl", "scene-player-hide-stream"],
  ["showScenePlayerAutostartControl", "scene-player-hide-autostart"],
] as const;

for (const [setting, className] of preferences) {
  assert.deepEqual(
    scenePlayerControlClassesCustom({ [setting]: true }),
    { ...hiddenDefaults, [className]: false },
    `${setting} unhides only its own control`
  );
  assert.deepEqual(
    scenePlayerControlClassesCustom({ [setting]: false }),
    hiddenDefaults,
    `${setting} can hide its control again`
  );
}

assert.equal(
  cx(
    "VideoPlayer",
    scenePlayerControlClassesCustom({
      showScenePlayerChromecastControl: true,
      showScenePlayerStreamControl: true,
      showScenePlayerAutostartControl: true,
    })
  ),
  "VideoPlayer",
  "showing all controls leaves no hiding classes behind"
);

const stylesheet = compile(
  fileURLToPath(
    new URL(
      "../src/components/ScenePlayer/scenePlayerControlVisibility_custom.scss",
      import.meta.url
    )
  )
);
const hidingSelectors = new Set<string>();
// The compiled stylesheet is flat CSS: "selector, selector { decls }".
for (const [, selectors, body] of stylesheet.css.matchAll(
  /([^{}]+)\{([^{}]*)\}/g
)) {
  if (/(^|;)\s*display\s*:\s*none\s*(;|$)/.test(body)) {
    selectors
      .split(",")
      .map((selector) => selector.trim().replace(/\s+/g, " "))
      .forEach((selector) => {
        hidingSelectors.add(selector);
      });
  }
}
for (const [hideClass, buttonClass] of [
  ["scene-player-hide-chromecast", "vjs-chromecast-button"],
  ["scene-player-hide-stream", "vjs-source-selector"],
  ["scene-player-hide-autostart", "vjs-autostart-button"],
]) {
  assert.ok(
    hidingSelectors.has(`.VideoPlayer.${hideClass} .video-js .${buttonClass}`),
    `${buttonClass} is hidden within the scene player, including fullscreen`
  );
}
assert.equal(hidingSelectors.size, 3, "other player controls are unaffected");
