import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { buildSchema, parse, validate } from "graphql";
import {
  filterExplorerVatos,
  getVatoExplorerPoints,
  loadExplorerVatos,
  VATO_EXPLORER_QUERY,
  vatoExplorerAge,
  vatoExplorerMetrics,
  vatoExplorerMetricValue,
  type IVatoExplorerVato,
} from "../src/components/Playground/vatoExplorerData_custom.ts";

const today = new Date(2026, 10, 10);
const vato = (
  id: string,
  values: Partial<IVatoExplorerVato> = {}
): IVatoExplorerVato => ({
  id,
  name: `Vato ${id}`,
  scene_count: 0,
  rating_scores: [],
  ...values,
});
const metrics = vatoExplorerMetrics();
const metric = (key: string) => metrics.find((option) => option.key === key)!;

test("the vato query matches the GraphQL schema", () => {
  const read = (directory: URL) =>
    readdirSync(directory)
      .filter((file) => file.endsWith(".graphql"))
      .map((file) => readFileSync(new URL(file, directory), "utf8"));
  const schema = buildSchema(
    [
      ...read(new URL("../../../graphql/schema/", import.meta.url)),
      ...read(new URL("../../../graphql/schema/types/", import.meta.url)),
    ].join("\n")
  );
  assert.deepEqual(validate(schema, parse(VATO_EXPLORER_QUERY)), []);
});

test("axes cover the vato rubric, rating, counts and measurements", () => {
  assert.deepEqual(
    metrics.map((option) => option.key),
    [
      "face",
      "body",
      "performance",
      "ethnicity",
      "masculinity",
      "rating100",
      "o_count",
      "scene_count",
      "age",
      "height",
      "verga",
    ]
  );
  assert.ok(metric("face").choices?.length, "criteria keep their choices");
  assert.equal(metric("verga").open, true);
  assert.equal(metric("rating100").open, undefined);
});

test("axis values keep real zeros and drop missing measurements", () => {
  const rated = vato("1", {
    rating100: 108,
    o_counter: 7,
    scene_count: 3,
    height_cm: 178,
    penis_length: 18.5,
    birthdate: "2000-11-11",
    rating_scores: [
      { section: "criterion", key: "face", raw_value: 0 },
      { section: "criterion", key: "body", raw_value: 99 },
      { section: "bonus", key: "performance", raw_value: 1 },
    ],
  });
  const value = (key: string, item = rated) =>
    vatoExplorerMetricValue(item, metric(key), today);

  assert.equal(value("face"), 0, "zero is a saved answer");
  assert.equal(value("body"), undefined, "an unlisted answer is not placed");
  assert.equal(value("performance"), undefined, "bonuses are not criteria");
  assert.equal(
    value("masculinity"),
    undefined,
    "unanswered criteria are missing"
  );
  assert.equal(value("rating100"), 108, "bonus ratings are never clipped");
  assert.equal(value("o_count"), 7);
  assert.equal(value("scene_count"), 3);
  assert.equal(value("height"), 178);
  assert.equal(value("verga"), 18.5);
  assert.equal(value("age"), 25, "the birthday is tomorrow");

  const blank = vato("2", { height_cm: 0, penis_length: 0 });
  assert.equal(value("o_count", blank), 0, "no O's is a real zero");
  assert.equal(value("scene_count", blank), 0);
  assert.equal(value("height", blank), undefined);
  assert.equal(value("verga", blank), undefined);
  assert.equal(value("age", blank), undefined);
  assert.equal(value("rating100", blank), undefined);
});

test("age stops at the day he died and ignores bad dates", () => {
  assert.equal(vatoExplorerAge({ birthdate: "2000-11-10" }, today), 26);
  assert.equal(
    vatoExplorerAge(
      { birthdate: "1990-06-01", death_date: "2020-05-31" },
      today
    ),
    29
  );
  assert.equal(vatoExplorerAge({ birthdate: "soon" }, today), undefined);
  assert.equal(vatoExplorerAge({ birthdate: "2030-01-01" }, today), undefined);
});

test("points need both values; filters match Vato Tiers", () => {
  const vatos = [
    vato("1", {
      height_cm: 180,
      penis_length: 18,
      ethnicity: "Latino",
      country: "mx",
    }),
    vato("2", { height_cm: 170, ethnicity: "Latino", country: "US" }),
    vato("3", { height_cm: 175, penis_length: 20, ethnicity: " White " }),
  ];
  assert.deepEqual(
    getVatoExplorerPoints(vatos, metric("height"), metric("verga"), today).map(
      (point) => [point.id, point.x, point.y]
    ),
    [
      ["1", 180, 18],
      ["3", 175, 20],
    ]
  );

  const ids = (filters: { ethnicity: string[]; country: string[] }) =>
    filterExplorerVatos(vatos, filters).map((item) => item.id);
  assert.deepEqual(ids({ ethnicity: [], country: [] }), ["1", "2", "3"]);
  assert.deepEqual(ids({ ethnicity: ["Latino"], country: ["MX"] }), ["1"]);
  assert.deepEqual(ids({ ethnicity: ["White"], country: ["__unknown__"] }), [
    "3",
  ]);
});

test("the scan pages through every vato and rejects a changed library", async () => {
  const controller = new AbortController();
  const pages = [
    { count: 3, performers: [vato("1"), vato("2")] },
    { count: 3, performers: [vato("3")] },
  ];
  const progress: number[][] = [];
  const loaded = await loadExplorerVatos(
    async (page) => ({ findPerformers: pages[page - 1] }),
    controller.signal,
    (done, total) => progress.push([done, total])
  );
  assert.deepEqual(
    loaded.map((item) => item.id),
    ["1", "2", "3"]
  );
  assert.deepEqual(progress, [
    [2, 3],
    [3, 3],
  ]);

  await assert.rejects(
    loadExplorerVatos(
      async (page) => ({
        findPerformers: {
          count: page === 1 ? 3 : 4,
          performers: [vato(String(page))],
        },
      }),
      controller.signal,
      () => {}
    ),
    /library changed/
  );
  await assert.rejects(
    loadExplorerVatos(
      async () => ({ findPerformers: { count: 3, performers: [vato("1")] } }),
      controller.signal,
      () => {}
    ),
    /pages changed/
  );
  await assert.rejects(
    loadExplorerVatos(
      async () => ({ findPerformers: { count: 2, performers: [] } }),
      controller.signal,
      () => {}
    ),
    /Incomplete/
  );
  controller.abort();
  await assert.rejects(
    loadExplorerVatos(
      async () => ({ findPerformers: pages[0] }),
      controller.signal,
      () => {}
    ),
    /cancelled/
  );
});

test("measurement axes start near their values, not at zero", async () => {
  const { playgroundAxisMinimum, playgroundDefaultSplit } = await import(
    "../src/components/Playground/playgroundData_custom.ts"
  );
  const { positionPlaygroundPoints, playgroundPlotPadding } = await import(
    "../src/components/Playground/playgroundChart_custom.ts"
  );
  const height = metric("height");
  const at = (values: number[]) =>
    values.map((x, index) => ({ id: String(index), x, y: 0 }));

  assert.equal(playgroundAxisMinimum(at([170, 190]), "x", height), 150);
  assert.equal(
    playgroundAxisMinimum(at([140, 190]), "x", height),
    140,
    "a smaller value lowers the start of the axis"
  );
  assert.equal(playgroundAxisMinimum(at([3]), "x", metric("o_count")), 0);
  assert.equal(playgroundDefaultSplit([], "x", height), 175);

  const [low, high] = positionPlaygroundPoints(
    at([150, 200]),
    500,
    400,
    200,
    10,
    undefined,
    { x: 150, y: 0 }
  );
  assert.equal(low.cx, playgroundPlotPadding.left);
  assert.equal(high.cx, 500 - playgroundPlotPadding.right);
  assert.equal(
    positionPlaygroundPoints(at([100]), 500, 400, 200, 10)[0].cx,
    playgroundPlotPadding.left +
      (500 - playgroundPlotPadding.left - playgroundPlotPadding.right) / 2,
    "without an origin the axis still starts at zero"
  );
});
