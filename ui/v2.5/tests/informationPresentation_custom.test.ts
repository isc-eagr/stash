import assert from "node:assert/strict";
import test from "node:test";
import {
  PERFORMER_BROWSE_COLUMNS_CUSTOM,
  PERFORMER_METRICS_COLUMNS_CUSTOM,
  showPerformerMediaTabCustom,
} from "../src/components/Performers/performerTableColumns_custom.ts";
import {
  getPerformerSortMetricDefinitionCustom,
  getPerformerSortMetricCustom,
} from "../src/components/Performers/performerSortMetric_custom.ts";
import { sortColumnExtrasCustom } from "../src/components/List/listTableSort_custom.ts";
import { commonOStatsTimelineSceneCustom } from "../src/components/OStats/oStatsTimelinePresentation_custom.ts";
import { makeSceneStatsMarkerTagURL } from "../src/components/SceneStats/sceneStatsSummary_custom.ts";
import { makeSceneStatsActivityMatrixTagURL } from "../src/components/SceneStats/sceneStatsActivityMatrixData_custom.ts";
import { FilterMode } from "../src/core/generated-graphql.ts";
import { ListFilterModel } from "../src/models/list-filter/filter.ts";

test("compact performer presets keep identity, browsing context, and partner comparisons", () => {
  assert.ok(PERFORMER_BROWSE_COLUMNS_CUSTOM.length < 13);
  for (const columns of [
    PERFORMER_BROWSE_COLUMNS_CUSTOM,
    PERFORMER_METRICS_COLUMNS_CUSTOM,
  ]) {
    for (const key of [
      "name",
      "scene_count",
      "sex_unique_partners",
      "oral_unique_partners",
    ])
      assert.ok(columns.includes(key));
    assert.equal(new Set(columns).size, columns.length);
  }
  assert.ok(!PERFORMER_BROWSE_COLUMNS_CUSTOM.includes("aliases"));
});

test("empty performer media stays accessible through direct navigation", () => {
  assert.equal(showPerformerMediaTabCustom(0, "images", "scenes"), false);
  assert.equal(showPerformerMediaTabCustom(2, "images", "scenes"), true);
  assert.equal(showPerformerMediaTabCustom(0, "images", "images"), true);
});

test("table metrics share the exact backend value and format used by cards", () => {
  assert.equal(
    getPerformerSortMetricDefinitionCustom("oral_topped_partners")?.format,
    "count"
  );
  const metric = getPerformerSortMetricCustom(
    "oral_topped_partners",
    {} as never,
    undefined,
    "8"
  );
  assert.equal(metric?.value, "8");
  assert.deepEqual(
    sortColumnExtrasCustom(
      [
        {
          value: "oral_topped_partners",
          label: "Partners",
          sortBy: "oral_topped_partners",
        },
      ],
      ["name"],
      "oral_topped_partners"
    ),
    ["oral_topped_partners"]
  );
  assert.equal(getPerformerSortMetricDefinitionCustom("not_a_sort"), undefined);
});

test("only an explicit single-scene O timeline compresses identity", () => {
  const events = [
    { scene: { id: "1", title: "One" } },
    { scene: { id: "1", title: "One" } },
  ];
  assert.equal(commonOStatsTimelineSceneCustom(events, "1"), events[0].scene);
  assert.equal(commonOStatsTimelineSceneCustom(events), undefined);
  assert.equal(commonOStatsTimelineSceneCustom([], "1"), undefined);
  assert.equal(
    commonOStatsTimelineSceneCustom(
      [...events, { scene: { id: "2", title: "Two" } }],
      "1"
    ),
    undefined
  );
});

test("event drilldowns keep the selected scenes and event-tag scope", () => {
  const url = new URL(
    makeSceneStatsMarkerTagURL({ id: "5", name: "Orgasm" }, [
      { id: "20", title: "Selected" },
    ]),
    "http://localhost"
  );
  const criteria = url.searchParams
    .getAll("c")
    .map((value) => JSON.parse(value));
  assert.equal(criteria[0].include_subtags, true);
  assert.deepEqual(criteria[1], {
    type: "scenes",
    modifier: "INCLUDES",
    value: [{ id: "20", label: "Selected" }],
  });
  assert.equal(criteria.length, 2);
  const filter = new ListFilterModel(FilterMode.SceneMarkers);
  filter.configureFromQueryString(url.search);
  const markerFilter = filter.makeFilter();
  assert.deepEqual(markerFilter.scenes?.value, ["20"]);
  assert.equal(markerFilter.scene_marker_tags?.groups_extended?.[0].depth, -1);
  assert.deepEqual(
    markerFilter.scene_marker_tags?.groups_extended?.[0].tag_ids,
    ["5"]
  );
  assert.equal(
    makeSceneStatsMarkerTagURL({ id: "5", name: "Orgasm" }, []),
    "#"
  );
  const matrixURL = new URL(
    makeSceneStatsActivityMatrixTagURL(
      { id: "5" },
      undefined,
      false,
      undefined,
      ["20"]
    ),
    "http://localhost"
  );
  assert.deepEqual(JSON.parse(matrixURL.searchParams.get("c")!).value, [
    { id: "20", label: "Scene 20" },
  ]);
});
