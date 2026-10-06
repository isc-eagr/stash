import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server.js";
import {
  groupStashDBMatchesByStudioCustom,
  sortStashDBMatchesChangesCustom,
  stashDBMatchesDeltaLabelCustom,
  stashDBReportFingerprintsURLCustom,
} from "../src/components/StashDBMatches/stashDBMatchesReport_custom.ts";
import { StashDBMatchesStudioGroup } from "../src/components/StashDBMatches/StashDBMatchesStudioGroup.tsx";
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

test("studio groups preserve change order, separate studio IDs, and put missing studios last", () => {
  const entries = [
    { id: "first", scene: { studio: { id: "b", name: "Beta" } } },
    { id: "unknown", scene: { studio: null } },
    { id: "alpha", scene: { studio: { id: "a", name: "Alpha" } } },
    { id: "second", scene: { studio: { id: "b", name: "Beta" } } },
    { id: "other-beta", scene: { studio: { id: "c", name: "Beta" } } },
  ];
  const groups = groupStashDBMatchesByStudioCustom(entries);
  assert.deepEqual(
    groups.map((g) => [g.id, g.name, g.entries.map((e) => e.id)]),
    [
      ["a", "Alpha", ["alpha"]],
      ["b", "Beta", ["first", "second"]],
      ["c", "Beta", ["other-beta"]],
      [null, "No studio", ["unknown"]],
    ]
  );
  assert.deepEqual(groupStashDBMatchesByStudioCustom([]), []);
});

test("studio disclosures start collapsed with their scene count", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      StashDBMatchesStudioGroup,
      { name: "Studio", count: 3 },
      "Scenes"
    )
  );
  assert.match(html, /<details class="stashdb-matches-report-group">/);
  assert.doesNotMatch(html, /\bopen[= >]/);
  assert.match(html, /<summary>Studio .*\(3\).*<\/summary>/);
});

test("unsubmitted scene links use the endpoint and point to its fingerprints", () => {
  assert.equal(
    stashDBReportFingerprintsURLCustom(
      "https://stashdb.org/graphql",
      "scene-id"
    ),
    "https://stashdb.org/scenes/scene-id#fingerprints"
  );
  assert.equal(
    stashDBReportFingerprintsURLCustom(
      "https://beta.stashdb.org/graphql",
      "scene/id"
    ),
    "https://beta.stashdb.org/scenes/scene%2Fid#fingerprints"
  );
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
