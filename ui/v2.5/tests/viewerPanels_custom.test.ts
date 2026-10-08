import assert from "node:assert/strict";
import test from "node:test";
import {
  clampPanelRect,
  IPanelBounds,
  IPanelRect,
  lowerPanel,
  PANEL_KEEP_VISIBLE,
  PanelLayouts,
  raisePanel,
  resizePanelRect,
  setPanelAspectRatio,
  syncPanelLayouts,
  tilePanels,
} from "../src/components/Viewers/viewerPanels_custom";

const bounds: IPanelBounds = { top: 50, width: 1600, height: 850 };

function overlaps(a: IPanelRect, b: IPanelRect) {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

function assertInside(rect: IPanelRect) {
  assert.ok(rect.x >= 0, `x ${rect.x}`);
  assert.ok(rect.y >= bounds.top, `y ${rect.y}`);
  assert.ok(rect.x + rect.width <= bounds.width, `right ${rect.x}`);
  assert.ok(rect.y + rect.height <= bounds.top + bounds.height, "bottom");
}

function counter(start = 0) {
  let value = start;
  return () => ++value;
}

test("tiling mixed videos and images never overlaps or leaves the canvas", () => {
  const entries = [
    { id: "marker:1", aspectRatio: 16 / 9 },
    { id: "scene:2", aspectRatio: 16 / 9 },
    { id: "scene:3", aspectRatio: 9 / 16 },
    { id: "image:4", aspectRatio: 2 / 3 },
    { id: "image:5", aspectRatio: 3 / 2 },
  ];
  const rects = tilePanels(entries, bounds);
  const list = entries.map((entry) => rects[entry.id]);

  list.forEach((rect, index) => {
    assertInside(rect);
    const ratio = rect.width / rect.height;
    assert.ok(Math.abs(ratio - entries[index].aspectRatio) < 0.02);
    list.slice(index + 1).forEach((other) => {
      assert.equal(overlaps(rect, other), false);
    });
  });
});

test("tiled panels fit their cell instead of growing past it", () => {
  // A 16:9 video in a cell wider than 16:9 keeps the cell height.
  const rects = tilePanels(
    ["a", "b", "c", "d"].map((id) => ({ id, aspectRatio: 16 / 9 })),
    bounds
  );
  const cellHeight = (bounds.height - 8 * 3) / 2;
  Object.values(rects).forEach((rect) => {
    assert.ok(rect.height <= Math.ceil(cellHeight));
    assertInside(rect);
  });
  assert.equal(rects.a.y, rects.b.y);
  assert.ok(rects.c.y >= rects.a.y + rects.a.height);
});

test("short last rows are centered", () => {
  const rects = tilePanels(
    ["a", "b", "c"].map((id) => ({ id, aspectRatio: 1 })),
    { top: 0, width: 1000, height: 1000 }
  );
  const last = rects.c;
  const center = last.x + last.width / 2;
  if (last.y > rects.a.y) {
    assert.ok(Math.abs(center - 500) <= 1);
  }
});

test("dragged panels stay reachable", () => {
  const rect = { x: 0, y: 0, width: 400, height: 225 };
  const farAway = clampPanelRect({ ...rect, x: 5000, y: 5000 }, bounds);
  assert.equal(farAway.x, bounds.width - PANEL_KEEP_VISIBLE);
  assert.equal(farAway.y, bounds.top + bounds.height - PANEL_KEEP_VISIBLE);

  const offTop = clampPanelRect({ ...rect, x: -5000, y: -300 }, bounds);
  assert.equal(offTop.x, PANEL_KEEP_VISIBLE - rect.width);
  assert.equal(offTop.y, bounds.top);
});

test("resizing keeps the aspect ratio and anchors the opposite corner", () => {
  const start = { x: 200, y: 200, width: 320, height: 180 };
  const limits = { minWidth: 200, minHeight: 112 };

  const grown = resizePanelRect("br", start, 160, 0, 16 / 9, limits, bounds);
  assert.deepEqual(grown, { x: 200, y: 200, width: 480, height: 270 });

  const fromTopLeft = resizePanelRect(
    "tl",
    start,
    -160,
    -10,
    16 / 9,
    limits,
    bounds
  );
  assert.equal(fromTopLeft.x + fromTopLeft.width, 520);
  assert.equal(fromTopLeft.y + fromTopLeft.height, 380);
  assert.equal(fromTopLeft.width, 480);

  const tiny = resizePanelRect("br", start, -1000, 0, 16 / 9, limits, bounds);
  assert.equal(tiny.width, 200);

  // The top-left handle stops at the header instead of sliding under it.
  const capped = resizePanelRect(
    "tl",
    { x: 1000, y: 100, width: 320, height: 180 },
    -2000,
    -2000,
    16 / 9,
    limits,
    bounds
  );
  assert.equal(capped.y, bounds.top);
  assert.equal(capped.y + capped.height, 280);
});

test("sync tiles while automatic and cascades additions after manual moves", () => {
  const specs = [
    { id: "scene:1", defaultAspectRatio: 16 / 9 },
    { id: "image:2", defaultAspectRatio: 1 },
  ];
  const tiled = syncPanelLayouts({}, specs, bounds, true, counter());
  assert.deepEqual(Object.keys(tiled), ["scene:1", "image:2"]);
  assert.equal(overlaps(tiled["scene:1"], tiled["image:2"]), false);
  assert.equal(syncPanelLayouts(tiled, specs, bounds, true, counter()), tiled);

  const moved: PanelLayouts = {
    ...tiled,
    "scene:1": { ...tiled["scene:1"], x: 30, y: 400 },
  };
  const added = syncPanelLayouts(
    moved,
    [...specs, { id: "scene:3", defaultAspectRatio: 16 / 9 }],
    bounds,
    false,
    counter(10)
  );
  assert.equal(added["scene:1"], moved["scene:1"]);
  assert.equal(added["scene:3"].zIndex, 11);
  assertInside(added["scene:3"]);

  const removed = syncPanelLayouts(added, [specs[1]], bounds, false, counter());
  assert.deepEqual(Object.keys(removed), ["image:2"]);
});

test("a learned aspect ratio retiles or refits the panel in place", () => {
  const specs = [
    { id: "scene:1", defaultAspectRatio: 16 / 9 },
    { id: "scene:2", defaultAspectRatio: 16 / 9 },
  ];
  const tiled = syncPanelLayouts({}, specs, bounds, true, counter());
  const portrait = setPanelAspectRatio(tiled, "scene:2", 9 / 16, bounds, true);
  assert.ok(portrait["scene:2"].height > portrait["scene:2"].width);
  assertInside(portrait["scene:2"]);
  assert.equal(overlaps(portrait["scene:1"], portrait["scene:2"]), false);

  const manual: PanelLayouts = {
    "scene:1": {
      x: 100,
      y: 100,
      width: 420,
      height: 236,
      zIndex: 1,
      aspectRatio: 16 / 9,
    },
  };
  const refit = setPanelAspectRatio(manual, "scene:1", 9 / 16, bounds, false);
  assert.deepEqual(
    [refit["scene:1"].x, refit["scene:1"].y, refit["scene:1"].height],
    [100, 100, 420]
  );
  assert.equal(
    setPanelAspectRatio(refit, "scene:1", 9 / 16, bounds, false),
    refit
  );
});

test("videos and images share one stacking order", () => {
  const layout = { x: 0, y: 0, width: 10, height: 10, aspectRatio: 1 };
  const layouts: PanelLayouts = {
    "scene:1": { ...layout, zIndex: 1 },
    "image:2": { ...layout, zIndex: 2 },
    "image:3": { ...layout, zIndex: 3 },
  };
  const next = counter(3);

  const raised = raisePanel(layouts, "scene:1", next);
  assert.equal(raised["scene:1"].zIndex, 4);
  assert.equal(raisePanel(raised, "scene:1", next), raised);

  const imageOnTop = raisePanel(raised, "image:2", next);
  assert.ok(imageOnTop["image:2"].zIndex > imageOnTop["scene:1"].zIndex);

  const lowered = lowerPanel(imageOnTop, "image:2");
  assert.ok(
    Object.entries(lowered).every(
      ([id, item]) =>
        id === "image:2" || item.zIndex > lowered["image:2"].zIndex
    )
  );
  assert.equal(lowerPanel(lowered, "image:2"), lowered);
});
