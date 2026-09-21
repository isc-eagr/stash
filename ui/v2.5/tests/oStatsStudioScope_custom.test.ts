import assert from "node:assert/strict";
import test from "node:test";
import {
  addOStatsStudioScopeToPath,
  getOStatsStudioScope,
  getOStatsStudioScopeVariables,
  readOStatsStudioScope,
} from "../src/components/OStats/oStatsStudioScope_custom.ts";

test("studio O Stats scope follows the child-studio details toggle", () => {
  assert.deepEqual(
    getOStatsStudioScope({ id: "42", name: "Mi Estudio" }, false),
    { id: "42", name: "Mi Estudio", depth: 0 }
  );
  assert.deepEqual(getOStatsStudioScope({ id: "42" }, true), {
    id: "42",
    name: "Studio 42",
    depth: -1,
  });
});

test("O Stats carries studio scope through chart and timeline links", () => {
  const scope = getOStatsStudioScope({ id: "42", name: "Mi Estudio" }, true);
  const path = addOStatsStudioScopeToPath("/ostats/2026/4?view=day", scope);
  assert.deepEqual(readOStatsStudioScope(path.slice(path.indexOf("?"))), scope);
  assert.deepEqual(getOStatsStudioScopeVariables(scope), {
    studioId: "42",
    depth: -1,
  });
});
