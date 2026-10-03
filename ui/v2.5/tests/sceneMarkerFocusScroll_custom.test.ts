import assert from "node:assert/strict";

import {
  completeSceneMarkerFocusRequest,
  findSceneMarkerFocusElement,
  getCenteredSceneMarkerScrollTop,
  isSceneTabScrollContainer,
  scrollSceneMarkerIntoTabView,
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

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const tabScrollRequests: ScrollToOptions[] = [];
const pageScrollRequests: ScrollIntoViewOptions[] = [];
let overflowY = "auto";
const scrollElement = {
  clientHeight: 600,
  scrollTop: 200,
  getBoundingClientRect: () => ({ top: 100 }),
  scrollTo: (options: ScrollToOptions) => tabScrollRequests.push(options),
} as unknown as HTMLElement;
const markerElement = {
  getBoundingClientRect: () => ({ top: 650, height: 40 }),
  scrollIntoView: (options: ScrollIntoViewOptions) =>
    pageScrollRequests.push(options),
} as unknown as HTMLElement;

try {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      getComputedStyle(element: HTMLElement) {
        assert.equal(element, scrollElement);
        return { overflowY };
      },
    },
  });

  scrollSceneMarkerIntoTabView(scrollElement, markerElement);
  assert.deepEqual(
    tabScrollRequests,
    [{ behavior: "smooth", top: 470 }],
    "desktop marker focus scrolls inside the sidebar"
  );
  assert.deepEqual(pageScrollRequests, []);

  overflowY = "visible";
  scrollSceneMarkerIntoTabView(scrollElement, markerElement);
  assert.equal(tabScrollRequests.length, 1);
  assert.deepEqual(
    pageScrollRequests,
    [{ block: "center", behavior: "smooth" }],
    "narrow layouts scroll the page when the sidebar does not scroll"
  );
} finally {
  if (originalWindow) {
    Object.defineProperty(globalThis, "window", originalWindow);
  } else {
    Reflect.deleteProperty(globalThis, "window");
  }
}

const latestFocusRequest = {
  markerId: "marker-b",
  requestId: 2,
};

assert.equal(
  completeSceneMarkerFocusRequest(latestFocusRequest, 1),
  latestFocusRequest,
  "completion from an older click does not clear the latest marker focus request"
);
assert.equal(
  completeSceneMarkerFocusRequest(latestFocusRequest, 2),
  undefined,
  "the latest marker focus request clears after it is handled"
);
