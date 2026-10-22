import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMarkerEventChart,
  buildMarkerEventStatsContext,
  MARKER_EVENT_UNKNOWN,
  markerEventMatchesFilter,
  markerEventScenes,
  markerEventSortMetric,
  markerEventStatsSummary,
  rankMarkerEventMarkers,
  rankMarkerEventVatos,
  type IMarkerEvent,
} from "../src/components/MarkerEventStats/markerEventStatsData_custom.ts";

function event(overrides: Partial<IMarkerEvent>): IMarkerEvent {
  return {
    marker_id: "1",
    scene_id: "10",
    scene_title: "Pool Party",
    duration: 20,
    giver: null,
    receivers: [],
    o_count: 0,
    type_tag_ids: [],
    quality: "REGULAR",
    activities: [],
    ...overrides,
  };
}

const performers = [
  { id: "1", name: "Beto", ethnicity: "Latino", country: "MX" },
  { id: "2", name: "Andre", ethnicity: "Black", country: "US" },
  { id: "3", name: "Zed", ethnicity: " ", country: null },
];

const events = [
  event({
    marker_id: "1",
    giver: { performer_id: "1", age: 30 },
    receivers: [{ performer_id: "2", age: 24 }],
    o_count: 4,
    type_tag_ids: ["45"],
    quality: "REALLY_HOT",
    activities: ["GETTING_FUCKED", "GETTING_SUCKED"],
    duration: 15,
  }),
  event({
    marker_id: "2",
    giver: { performer_id: "2", age: null },
    receivers: [{ performer_id: "3" }, { performer_id: "1", age: 30 }],
    o_count: 1,
    quality: "GOAT",
  }),
  event({ marker_id: "3", scene_id: "11", receivers: [{ performer_id: "2" }] }),
  event({ marker_id: "4", scene_id: "11", receivers: [{ performer_id: "2" }] }),
];

const context = buildMarkerEventStatsContext(events, performers, [
  { id: "45", name: "handsfree" },
]);

test("facials per scene count each scene once with its best facial", () => {
  assert.equal(context.sceneEventCounts.get("10"), 2);
  assert.equal(context.sceneEventCounts.get("11"), 2);
  const chart = buildMarkerEventChart(events, "per_scene", context);
  assert.deepEqual(
    chart.data.map((datum) => [datum.key, datum.count, datum.qualities]),
    [["2", 2, { REGULAR: 1, REALLY_HOT: 0, GOAT: 1 }]]
  );

  // Busy scenes keep their own column instead of folding into "4+".
  const busy = ["5", "6", "7", "8", "9"].map((marker_id) =>
    event({ marker_id, scene_id: "12" })
  );
  const busyContext = buildMarkerEventStatsContext(busy, performers, []);
  assert.deepEqual(
    buildMarkerEventChart(busy, "per_scene", busyContext).data.map((datum) => [
      datum.key,
      datum.label,
      datum.count,
    ]),
    [["5", "5", 1]]
  );
  assert.equal(chart.total, 2, "facials per scene counts scenes");
});

test("giver charts use the vato who came, with Unknown for missing data", () => {
  const ethnicity = buildMarkerEventChart(events, "giver_ethnicity", context);
  assert.deepEqual(
    ethnicity.data.map((datum) => [datum.key, datum.count]),
    [
      ["Black", 1],
      ["Latino", 1],
    ]
  );
  assert.equal(ethnicity.unknownCount, 2);
  // Shares use the events with a known giver, so Unknown never dilutes them.
  assert.equal(ethnicity.total, 2);

  const age = buildMarkerEventChart(events, "giver_age", context);
  assert.deepEqual(
    age.data.map((datum) => datum.key),
    ["30"]
  );
  assert.equal(age.unknownCount, 3);

  const country = buildMarkerEventChart(events, "giver_country", context);
  assert.deepEqual(
    country.data.map((datum) => datum.label),
    ["Mexico", "United States of America"]
  );
});

test("receiver and pair charts count each receiver once per facial", () => {
  const receivers = buildMarkerEventChart(
    events,
    "receiver_ethnicity",
    context
  );
  assert.deepEqual(
    receivers.data.map((datum) => [datum.key, datum.count]),
    [
      ["Black", 3],
      ["Latino", 1],
    ]
  );
  assert.equal(receivers.unknownCount, 1, "a blank receiver is Unknown");

  const pairs = buildMarkerEventChart(events, "pair_ethnicity", context);
  assert.deepEqual(
    pairs.data.map((datum) => [datum.label, datum.count]),
    [
      ["Black → Latino", 1],
      ["Latino → Black", 1],
    ]
  );
  assert.equal(pairs.unknownCount, 3);
});

test("O count, type, quality, and activity buckets", () => {
  assert.deepEqual(
    buildMarkerEventChart(events, "o_count", context).data.map((datum) => [
      datum.key,
      datum.count,
    ]),
    [
      ["0", 2],
      ["1", 1],
      // 4 O's keep their own column instead of folding into "3+".
      ["4", 1],
    ]
  );
  assert.deepEqual(
    buildMarkerEventChart(events, "type", context).data.map((datum) => [
      datum.label,
      datum.count,
    ]),
    [
      ["Plain", 3],
      ["handsfree", 1],
    ]
  );
  assert.deepEqual(
    buildMarkerEventChart(events, "quality", context).data.map(
      (datum) => datum.label
    ),
    ["Regular", "Really Hot", "GOAT"]
  );
  const activity = buildMarkerEventChart(events, "activity", context);
  assert.deepEqual(
    activity.data.map((datum) => datum.label),
    ["Getting fucked", "Getting sucked"]
  );
  assert.equal(activity.unknownCount, 3);
});

test("filters match bars and Unknown badges", () => {
  const latino = { category: "giver_ethnicity" as const, value: "Latino" };
  assert.deepEqual(
    events
      .filter((item) => markerEventMatchesFilter(item, latino, context))
      .map((item) => item.marker_id),
    ["1"]
  );
  const unknownReceiver = {
    category: "receiver_ethnicity" as const,
    value: MARKER_EVENT_UNKNOWN,
  };
  assert.deepEqual(
    events
      .filter((item) =>
        markerEventMatchesFilter(item, unknownReceiver, context)
      )
      .map((item) => item.marker_id),
    ["2"]
  );
  const twoPerScene = { category: "per_scene" as const, value: "2" };
  assert.deepEqual(
    events
      .filter((item) => markerEventMatchesFilter(item, twoPerScene, context))
      .map((item) => item.marker_id),
    ["1", "2", "3", "4"]
  );
});

test("summary, rankings, and marker-list scenes", () => {
  assert.deepEqual(markerEventStatsSummary(events), {
    count: 4,
    seconds: 75,
    liters: 0.012,
  });
  assert.deepEqual(
    rankMarkerEventVatos(events, "giver", context).map((item) => [
      item.performer.name,
      item.count,
    ]),
    [
      ["Andre", 1],
      ["Beto", 1],
    ]
  );
  assert.deepEqual(
    rankMarkerEventVatos(events, "receiver", context).map((item) => [
      item.performer.name,
      item.count,
    ]),
    [
      ["Andre", 3],
      ["Beto", 1],
      ["Zed", 1],
    ]
  );
  assert.deepEqual(markerEventScenes(events), [
    { id: "10", title: "Pool Party" },
    { id: "11", title: "Pool Party" },
  ]);
});

test("marker rankings keep one card per marker and break ties", () => {
  const ranked = [
    event({
      marker_id: "1",
      o_count: 2,
      latest_o_date: "2026-01-01T00:00:00Z",
    }),
    event({
      marker_id: "1",
      o_count: 2,
      latest_o_date: "2026-01-01T00:00:00Z",
    }),
    event({
      marker_id: "2",
      o_count: 2,
      latest_o_date: "2026-03-01T00:00:00Z",
    }),
    event({ marker_id: "3", o_count: 0, quality: "GOAT", duration: 45 }),
    event({
      marker_id: "4",
      o_count: 1,
      quality: "REALLY_HOT",
      scene_rating100: 90,
    }),
  ];
  const order = (sort: Parameters<typeof rankMarkerEventMarkers>[1]) =>
    rankMarkerEventMarkers(ranked, sort).map((item) => item.marker_id);

  // O Count ties go to the most recent O, like Scene Stats.
  assert.deepEqual(order("o_count"), ["2", "1", "4", "3"]);
  assert.deepEqual(order("latest_o"), ["2", "1", "4", "3"]);
  assert.deepEqual(order("scene_rating"), ["4", "2", "1", "3"]);
  assert.deepEqual(order("duration"), ["3", "2", "1", "4"]);

  assert.deepEqual(markerEventSortMetric(ranked[3], "duration"), {
    messageID: "duration",
    format: "duration",
    value: 45,
  });
  assert.equal(markerEventSortMetric(ranked[3], "latest_o").value, null);
});

test("stacked columns split each bar by Regular, Really Hot and GOAT", () => {
  const oCounts = buildMarkerEventChart(events, "o_count", context);
  assert.deepEqual(
    oCounts.data.map((datum) => [datum.key, datum.qualities]),
    [
      ["0", { REGULAR: 2, REALLY_HOT: 0, GOAT: 0 }],
      ["1", { REGULAR: 0, REALLY_HOT: 0, GOAT: 1 }],
      ["4", { REGULAR: 0, REALLY_HOT: 1, GOAT: 0 }],
    ]
  );
});

test("both pages chart nuts or facials per scene", async () => {
  const { NUT_STATS_CHARTS, FACIAL_STATS_CHARTS } = await import(
    "../src/components/MarkerEventStats/markerEventStatsData_custom.ts"
  );
  assert.equal(
    NUT_STATS_CHARTS.find((chart) => chart.key === "per_scene")?.label,
    "Nuts Per Scene"
  );
  assert.equal(
    FACIAL_STATS_CHARTS.find((chart) => chart.key === "per_scene")?.label,
    "Facials Per Scene"
  );
});

test("chart groups fill whole rows of three small, two medium or one wide", async () => {
  const { NUT_STATS_CHARTS, FACIAL_STATS_CHARTS } = await import(
    "../src/components/MarkerEventStats/markerEventStatsData_custom.ts"
  );
  const span = { small: 2, wide: 6 } as const;
  for (const charts of [NUT_STATS_CHARTS, FACIAL_STATS_CHARTS]) {
    const groups = new Map<string, number[]>();
    charts.forEach((chart) => {
      if (!chart.group) return;
      groups.set(chart.group, [
        ...(groups.get(chart.group) ?? []),
        chart.size ? span[chart.size] : 3,
      ]);
    });
    groups.forEach((spans, group) => {
      const left = spans.reduce((row, value) => {
        assert.ok(row + value <= 6, `${group} should not overflow a row`);
        return (row + value) % 6;
      }, 0);
      assert.equal(left, 0, `${group} should end on a full row`);
    });
  }
  assert.deepEqual(
    Array.from(new Set(NUT_STATS_CHARTS.flatMap((chart) => chart.group ?? []))),
    ["The Nuts", "The Vatos", "The Action"]
  );
  assert.deepEqual(
    Array.from(
      new Set(FACIAL_STATS_CHARTS.flatMap((chart) => chart.group ?? []))
    ),
    ["The Facials", "The Vatos"]
  );
});
