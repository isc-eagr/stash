import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ListFilterModel } from "../src/models/list-filter/filter.ts";
import { makeStudioMarkerScenesUrl } from "../src/utils/navigation_custom.ts";
import { getStudioSceneTypesCustom } from "../src/components/Studios/studioSceneTypes_custom.ts";

test("studio scene types use counts as their denominator", () => {
  const rows = getStudioSceneTypesCustom({
    sex_scene_count: 6,
    oral_scene_count: 3,
    solo_scene_count: 1,
  });
  assert.deepEqual(
    rows.map(({ key, count, percent }) => ({ key, count, percent })),
    [
      { key: "sex", count: 6, percent: 60 },
      { key: "oral", count: 3, percent: 30 },
      { key: "solo", count: 1, percent: 10 },
    ]
  );
  const thirds = getStudioSceneTypesCustom({
    sex_scene_count: 1,
    oral_scene_count: 1,
    solo_scene_count: 1,
  });
  assert.ok(
    Math.abs(thirds.reduce((sum, row) => sum + row.percent, 0) - 100) < 1e-10
  );
});

test("studio scene types handle absent and single-category counts", () => {
  for (const counts of [
    undefined,
    null,
    { sex_scene_count: 0, oral_scene_count: 0, solo_scene_count: 0 },
  ]) {
    assert.ok(
      getStudioSceneTypesCustom(counts).every(
        (row) => row.percent === 0 && row.count === 0
      )
    );
  }
  assert.deepEqual(
    getStudioSceneTypesCustom({
      sex_scene_count: 0,
      oral_scene_count: 0,
      solo_scene_count: 8,
    }).map((row) => row.percent),
    [0, 0, 100]
  );
});

test("studio cards and headers use scoped count bars and relocate supplemental counts", () => {
  const source = (path: string) =>
    readFileSync(
      new URL(`../src/components/Studios/${path}`, import.meta.url),
      "utf8"
    );
  const card = source("StudioCard.tsx");
  assert.match(
    card,
    /const sceneTypeCounts = performerId\s*\? performerStats\?\.role_stats\s*:\s*stats\?\.studio_role_counts/
  );
  assert.match(card, /activeSortBy === "unique_performers_count"/);
  assert.doesNotMatch(
    card,
    /maybeRenderUniquePerformersButton|maybeRenderSexScenesButton|scene-category-buttons/
  );
  assert.match(
    card,
    /ButtonGroup className="card-popovers"[\s\S]*?maybeRenderFacialsButton/
  );
  const header = source("StudioDetails/StudioHeaderInsights.tsx");
  assert.match(
    header,
    /includeChildStudios\s*\? studio\.studio_role_counts_all\s*:\s*studio\.studio_role_counts/
  );
  assert.doesNotMatch(header, /ActivityStatsCharts/);
  const page = source("StudioDetails/Studio.tsx");
  assert.doesNotMatch(page, /StudioCategoryStrip/);
  assert.match(page, /className="quality-group"[\s\S]*?<StudioExtraCounts/);
});

test("scene-type links preserve marker filters and honor child-studio scope", () => {
  for (const depth of [0, -1]) {
    const url = makeStudioMarkerScenesUrl(
      { id: "studio", name: "Studio" },
      "oral",
      "Oral",
      [{ id: "sex", label: "Sex" }],
      -1,
      depth
    );
    const criteria = ListFilterModel.decodeParams({
      c: new URL(url, "http://localhost").searchParams.getAll("c"),
    }).c!.map((value) => JSON.parse(value));
    const studio = criteria.find((criterion) => criterion.type === "studios");
    assert.equal(studio.value.depth, depth);
    assert.equal(studio.value.items[0].id, "studio");
    const markers = criteria.filter(
      (criterion) => criterion.type === "scene_markers"
    );
    assert.equal(markers[0].groups[0].tag_ids[0].id, "oral");
    assert.equal(markers[0].groups[0].depth, -1);
    const exclusion = criteria.find(
      (criterion) => criterion.type === "scene_markers_exclude"
    );
    assert.equal(exclusion.groups[0].tag_ids[0].id, "sex");
  }
});
