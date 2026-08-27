import assert from "node:assert/strict";

import { getMarkerPlaylistORecordTargetCustom } from "../src/components/Scenes/markerPlaylistORecord_custom.ts";

assert.deepEqual(
  getMarkerPlaylistORecordTargetCustom({ sceneId: "42" }, 125.875),
  { sceneId: "42", videoTimestamp: 125.875 }
);
assert.equal(getMarkerPlaylistORecordTargetCustom(undefined, 5), undefined);
assert.equal(
  getMarkerPlaylistORecordTargetCustom({ sceneId: "42" }, Number.NaN),
  undefined
);
assert.equal(
  getMarkerPlaylistORecordTargetCustom({ sceneId: "42" }, -1),
  undefined
);
