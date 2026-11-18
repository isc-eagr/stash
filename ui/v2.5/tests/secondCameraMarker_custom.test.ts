import assert from "node:assert/strict";
import test from "node:test";
import { isSecondCameraMarkerCustom } from "../src/components/Scenes/secondCameraMarker_custom.ts";

test("2nd camera markers match the tag or a direct child on their own tags", () => {
  assert.equal(
    isSecondCameraMarkerCustom([{ id: "1" }, { id: "70" }], "70"),
    true
  );
  assert.equal(
    isSecondCameraMarkerCustom([{ id: "71", parents: [{ id: "70" }] }], "70"),
    true
  );
  assert.equal(
    isSecondCameraMarkerCustom([{ id: "1", parents: [] }], "70"),
    false
  );
  assert.equal(isSecondCameraMarkerCustom([{ id: "70" }], undefined), false);
});
