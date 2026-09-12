import assert from "node:assert/strict";
import {
  getSceneMarkerScrollElement,
  moveSceneMarkerDock,
  parseSceneMarkerPlacement,
  readSceneMarkerPlacement,
  saveSceneMarkerPlacement,
  sceneMarkerPlacementStorageKey,
  shouldDockSceneMarkers,
} from "../src/components/Scenes/SceneDetails/sceneMarkerDockPlacement_custom.ts";

assert.equal(parseSceneMarkerPlacement(null), "sidebar");
assert.equal(parseSceneMarkerPlacement("below"), "below");
assert.equal(parseSceneMarkerPlacement("unknown"), "sidebar");
assert.equal(shouldDockSceneMarkers("below", true, true, false), true);
assert.equal(shouldDockSceneMarkers("sidebar", true, true, false), false);
assert.equal(shouldDockSceneMarkers("below", false, true, false), false);
assert.equal(shouldDockSceneMarkers("below", true, false, false), false);
assert.equal(shouldDockSceneMarkers("below", true, true, true), false);

const originalStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  "localStorage"
);
const values = new Map<string, string>();
try {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  assert.equal(readSceneMarkerPlacement(), "sidebar");
  saveSceneMarkerPlacement("below");
  assert.equal(values.get(sceneMarkerPlacementStorageKey), "below");
  assert.equal(readSceneMarkerPlacement(), "below");
  saveSceneMarkerPlacement("sidebar");
  assert.equal(readSceneMarkerPlacement(), "sidebar");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("Storage disabled");
    },
  });
  assert.equal(readSceneMarkerPlacement(), "sidebar");
  assert.doesNotThrow(() => saveSceneMarkerPlacement("below"));
} finally {
  if (originalStorage) {
    Object.defineProperty(globalThis, "localStorage", originalStorage);
  } else {
    Reflect.deleteProperty(globalThis, "localStorage");
  }
}

const dockScroll = {} as HTMLElement;
let scrollSelector = "";
assert.equal(
  getSceneMarkerScrollElement({
    closest(selector: string) {
      scrollSelector = selector;
      return dockScroll;
    },
  } as Element),
  dockScroll,
  "marker focus uses the closest scroll parent after docking"
);
assert.equal(
  scrollSelector,
  "[data-scene-marker-scroll-container], .tab-content"
);

let focusRestored = 0;
const focus = {
  focus(options: FocusOptions) {
    assert.equal(options.preventScroll, true);
    focusRestored++;
  },
};
const container = {
  parentElement: null as HTMLElement | null,
  ownerDocument: { activeElement: focus },
  contains: (element: unknown) => element === focus,
} as unknown as HTMLElement;
let moves = 0;
const destination = {
  appendChild(child: HTMLElement) {
    assert.equal(child, container, "move the existing subtree, never a copy");
    Object.defineProperty(child, "parentElement", {
      value: this,
      configurable: true,
    });
    moves++;
  },
} as unknown as HTMLElement;
moveSceneMarkerDock(container, destination);
assert.equal(moves, 1);
assert.equal(
  focusRestored,
  1,
  "moving an edit form restores its focused control"
);
moveSceneMarkerDock(container, destination);
assert.equal(moves, 1, "unchanged placement must not detach the panel again");
assert.equal(focusRestored, 1);
