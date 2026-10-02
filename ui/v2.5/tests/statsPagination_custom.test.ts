import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { STATS_TOP_PAGING_CUSTOM } from "../src/utils/statsTopPaging_custom.ts";
import {
  addOStatsStudioScopeToPath,
  readOStatsStudioScope,
} from "../src/components/OStats/oStatsStudioScope_custom.ts";
import {
  addStatsDateRangeToPath,
  readStatsDateRange,
} from "../src/utils/statsDateRange_custom.ts";
import {
  O_STATS_LATEST_COUNT_CUSTOM,
  O_STATS_TIMELINE_PAGE_SIZE_CUSTOM,
  oStatsTimelinePageCustom,
  oStatsTimelinePageURLCustom,
  oStatsTimelineSearchCustom,
} from "../src/components/OStats/oStatsTimelinePaging_custom.ts";

test("stats rankings start with five scenes or six vatos and expand by ten or twelve", () => {
  assert.deepEqual(STATS_TOP_PAGING_CUSTOM, {
    scene: { initial: 5, more: 10 },
    vato: { initial: 6, more: 12 },
  });
  const source = readFileSync(
    new URL("../src/components/StatsTopCards_custom.tsx", import.meta.url),
    "utf8"
  );
  assert.match(source, /STATS_TOP_PAGING_CUSTOM\[variant\]/);
  assert.match(source, /useState<number>\(initial\)/);
  assert.match(source, /current \+ more/);
});

test("O timeline pages preserve studio and Dates scope and recover invalid page values", () => {
  assert.equal(O_STATS_LATEST_COUNT_CUSTOM, 5);
  assert.equal(O_STATS_TIMELINE_PAGE_SIZE_CUSTOM, 25);
  for (const value of [
    "",
    "?page=0",
    "?page=-1",
    "?page=1.5",
    "?page=NaN",
    "?page=2147483648",
  ]) {
    assert.equal(oStatsTimelinePageCustom(value), 1);
  }
  assert.equal(oStatsTimelinePageCustom("?page=3"), 3);
  const scope = { id: "3", name: "Studio Three", depth: -1 };
  const dates = "?statsRange=custom&statsFrom=2026-01-01&statsTo=2026-03-01";
  const source = addStatsDateRangeToPath(
    addOStatsStudioScopeToPath("/ostats/timeline?page=4", scope),
    dates
  );
  const next = new URL(
    oStatsTimelinePageURLCustom(source, 5),
    "http://localhost"
  );
  assert.deepEqual(readOStatsStudioScope(next.search), scope);
  assert.deepEqual(readStatsDateRange(next.search), readStatsDateRange(dates));
  assert.equal(next.searchParams.get("page"), "5");
  assert.equal(
    new URLSearchParams(oStatsTimelineSearchCustom(next.search, 1)).has("page"),
    false
  );
});

test("Latest precedes summary cards and View All reaches the explicit full timeline route", () => {
  const overview = readFileSync(
    new URL("../src/components/OStats/OStats.tsx", import.meta.url),
    "utf8"
  );
  const timeline = readFileSync(
    new URL(
      "../src/components/OStats/OStatsTimeline_custom.tsx",
      import.meta.url
    ),
    "utf8"
  );
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.ok(
    overview.indexOf("<OStatsLatest") <
      overview.indexOf('className="ostats-summary"')
  );
  assert.match(timeline, /perPage: O_STATS_LATEST_COUNT_CUSTOM/);
  assert.match(
    timeline,
    /to=\{withScope\(O_STATS_TIMELINE_PATH_CUSTOM\)\}[\s\S]*View All/
  );
  assert.match(timeline, /perPage: O_STATS_TIMELINE_PAGE_SIZE_CUSTOM/);
  assert.match(timeline, /aria-label="O timeline pages"/);
  assert.ok(
    app.indexOf('path="/ostats/timeline"') <
      app.indexOf('path="/ostats/:year?/:month?/:day?"')
  );
});
