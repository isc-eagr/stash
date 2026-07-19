import assert from "node:assert/strict";

import {
  findSceneMarkerFocusElement,
  getCenteredSceneMarkerScrollTop,
  isSceneTabScrollContainer,
} from "../src/components/Scenes/SceneDetails/sceneMarkerFocusScroll_custom.ts";

function focusElement(
  directMarkerId?: string,
  representedMarkerIds: string[] = []
) {
  return {
    getAttribute(name: string) {
      if (name === "data-scene-marker-id") return directMarkerId ?? null;
      if (name === "data-scene-marker-ids") {
        return representedMarkerIds.join(",");
      }

      return null;
    },
  };
}

const groupedActivityTarget = focusElement(undefined, [
  "activity-a",
  "activity-b",
]);
const exactActivityTarget = focusElement("activity-b");

assert.equal(
  findSceneMarkerFocusElement(
    [groupedActivityTarget, exactActivityTarget],
    "activity-b"
  ),
  exactActivityTarget,
  "marker focus prefers the exact rendered activity pill"
);
assert.equal(
  findSceneMarkerFocusElement([groupedActivityTarget], "activity-a"),
  groupedActivityTarget,
  "marker focus falls back to the rendered group for hidden activity pills"
);

assert.equal(
  isSceneTabScrollContainer("auto"),
  true,
  "desktop scene tabs use their own scroll container"
);
assert.equal(
  isSceneTabScrollContainer("visible"),
  false,
  "non-scrolling scene tabs retain normal page focus scrolling"
);

assert.equal(
  getCenteredSceneMarkerScrollTop({
    containerClientHeight: 600,
    containerScrollTop: 200,
    containerTop: 100,
    markerHeight: 40,
    markerTop: 650,
  }),
  470,
  "marker focus centers the marker relative to the scene tab scroll area"
);

assert.equal(
  getCenteredSceneMarkerScrollTop({
    containerClientHeight: 600,
    containerScrollTop: 0,
    containerTop: 100,
    markerHeight: 40,
    markerTop: 50,
  }),
  0,
  "marker focus does not request a negative scene tab scroll position"
);
