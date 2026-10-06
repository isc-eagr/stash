import assert from "node:assert/strict";
import test from "node:test";
import {
  sortStashDBMatchesChangesCustom,
  stashDBMatchesDeltaLabelCustom,
} from "../src/components/StashDBMatches/stashDBMatchesReport_custom.ts";
import { stashDBFingerprintsURLCustom } from "../src/components/Scenes/SceneDetails/StashDBMatchesCount.tsx";

test("report changes rank by increase, first-time counts by their total", () => {
  const sorted = sortStashDBMatchesChangesCustom([
    { id: "drop", previous: 9, current: 7 },
    { id: "new", previous: null, current: 4 },
    { id: "gain", previous: 2, current: 8 },
    { id: "tie", previous: 6, current: 10 },
  ]);
  assert.deepEqual(
    sorted.map((c) => c.id),
    ["gain", "tie", "new", "drop"]
  );
  assert.deepEqual(sorted.map(stashDBMatchesDeltaLabelCustom), [
    "+6",
    "+4",
    "New",
    "−2",
  ]);
});

test("toolbar count links to the StashDB fingerprints tab", () => {
  assert.equal(
    stashDBFingerprintsURLCustom([
      { endpoint: "https://fansdb.cc/graphql", stash_id: "f" },
      {
        endpoint: "https://stashdb.org/graphql",
        stash_id: "6a480f26-a82e-407d-be95-9a12ffb2cba9",
      },
    ]),
    "https://stashdb.org/scenes/6a480f26-a82e-407d-be95-9a12ffb2cba9#fingerprints"
  );
  assert.equal(
    stashDBFingerprintsURLCustom([
      { endpoint: "https://fansdb.cc/graphql", stash_id: "f" },
    ]),
    undefined
  );
});
