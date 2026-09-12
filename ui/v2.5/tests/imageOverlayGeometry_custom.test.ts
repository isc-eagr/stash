import assert from "node:assert/strict";
import test from "node:test";
import {
  getRotatorStyle,
  visualToLocalClipPath,
} from "../src/utils/imageOverlayGeometry_custom";

test("overlay crop edges follow each quarter-turn rotation", () => {
  for (const [rotation, expected] of [
    [0, "inset(1% 2% 3% 4%)"],
    [90, "inset(2% 3% 4% 1%)"],
    [180, "inset(3% 4% 1% 2%)"],
    [270, "inset(4% 1% 2% 3%)"],
  ] as const) {
    assert.equal(visualToLocalClipPath(1, 2, 3, 4, rotation), expected);
  }
});

test("rotated overlays remain centered in non-square containers", () => {
  for (const rotation of [90, 270]) {
    assert.deepEqual(getRotatorStyle(rotation, 320, 180), {
      position: "absolute",
      width: 180,
      height: 320,
      left: 70,
      top: -70,
      transform: `rotate(${rotation}deg)`,
      transformOrigin: "center",
    });
  }
  for (const rotation of [0, 180]) {
    assert.deepEqual(getRotatorStyle(rotation, 320, 180), {
      width: "100%",
      height: "100%",
      transform: `rotate(${rotation}deg)`,
    });
  }
});
