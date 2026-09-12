import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { buildSchema, parse, validate } from "graphql";
import {
  loadInsightStatsScenes,
  createInsightStatsRequest,
  INSIGHT_STATS_SCENES_QUERY as PLAYGROUND_SCENES_QUERY,
} from "../src/components/InsightStats/insightStatsQuery_custom.ts";

const loadPlaygroundScenes = (
  url: string,
  signal: AbortSignal,
  progress: (loaded: number, total: number) => void
) =>
  loadInsightStatsScenes(
    createInsightStatsRequest(url, signal),
    progress,
    signal
  );

// Validate the handwritten, compact request against the real API schema.
const schemaRoot = new URL("../../../graphql/schema/", import.meta.url);
const sources: string[] = [];
for (const directory of [schemaRoot, new URL("types/", schemaRoot)]) {
  for (const file of await readdir(directory)) {
    if (file.endsWith(".graphql"))
      sources.push(await readFile(new URL(file, directory), "utf8"));
  }
}
assert.deepEqual(
  validate(buildSchema(sources.join("\n")), parse(PLAYGROUND_SCENES_QUERY)),
  []
);

const originalFetch = globalThis.fetch;
const signal = new AbortController().signal;
type Batch = { count: number; scenes: { id: string }[] };
function mockPages(batches: Batch[]) {
  let index = 0;
  globalThis.fetch = async (_url, init) => {
    assert.equal(init?.signal, signal);
    assert.equal(init?.credentials, "same-origin");
    assert.equal(JSON.parse(String(init?.body)).variables.page, index + 1);
    return new Response(
      JSON.stringify({ data: { findScenes: batches[index++] } }),
      { status: 200 }
    );
  };
}

try {
  mockPages([
    { count: 3, scenes: [{ id: "1" }, { id: "2" }] },
    { count: 3, scenes: [{ id: "3" }] },
  ]);
  const progress: number[] = [];
  const scenes = await loadPlaygroundScenes(
    "https://example.invalid/graphql",
    signal,
    (loaded) => progress.push(loaded)
  );
  assert.deepEqual(
    scenes.map((scene) => scene.id),
    ["1", "2", "3"]
  );
  assert.deepEqual(progress, [2, 3]);
  mockPages([{ count: 0, scenes: [] }]);
  assert.deepEqual(await loadPlaygroundScenes("", signal, () => {}), []);
  mockPages([
    { count: 2, scenes: [{ id: "1" }] },
    { count: 3, scenes: [{ id: "2" }] },
  ]);
  await assert.rejects(
    loadPlaygroundScenes("", signal, () => {}),
    /library changed/
  );
  mockPages([
    { count: 2, scenes: [{ id: "1" }] },
    { count: 2, scenes: [{ id: "1" }] },
  ]);
  await assert.rejects(
    loadPlaygroundScenes("", signal, () => {}),
    /pages changed/
  );
  mockPages([{ count: 2, scenes: [] }]);
  await assert.rejects(
    loadPlaygroundScenes("", signal, () => {}),
    /incomplete/
  );
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ errors: [{ message: "Query failed" }], data: {} }),
      { status: 200 }
    );
  await assert.rejects(
    loadPlaygroundScenes("", signal, () => {}),
    /Query failed/
  );
  globalThis.fetch = async () => new Response("Failed", { status: 500 });
  await assert.rejects(
    loadPlaygroundScenes("", signal, () => {}),
    /500/
  );
  const controller = new AbortController();
  globalThis.fetch = async () => {
    controller.abort();
    return new Response(
      JSON.stringify({ data: { findScenes: { count: 0, scenes: [] } } })
    );
  };
  await assert.rejects(
    loadPlaygroundScenes("", controller.signal, () =>
      assert.fail("aborted requests must not publish progress")
    ),
    /cancelled/
  );
} finally {
  globalThis.fetch = originalFetch;
}
console.log(
  "Playground API schema, pagination, errors, and cancellation tests passed."
);
