import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { buildSchema, parse, validate } from "graphql";
import React from "react";
import ReactDOMServer from "react-dom/server.js";
import { StaticRouter } from "react-router-dom";
import { VatoTiersView } from "../src/components/Playground/PlaygroundVatoTiers.tsx";
import { ratingTierForEntity } from "../src/components/Playground/ratingTiersData_custom.ts";
import { makeVatoTierPerformersUrl } from "../src/utils/navigation_custom.ts";
import {
  countVatoTiers,
  emptyVatoTierFilters,
  filterTierVatos,
  groupTierVatos,
  loadTierVatos,
  projectVatoTiers,
  projectedVatoTier,
  vatoTierFilterValue,
  vatoTierRequest,
  vatoTierUnknownValue,
  vatoTierValue,
  VATO_TIERS_QUERY,
  type IVatoTierPerformer,
  type IVatoTierPage,
} from "../src/components/Playground/vatoTiersData_custom.ts";

const ratingConfig = {
  thresholds: {
    scene: { bronze: 50, silver: 70, gold: 80, royalSapphire: 95 },
    performer: { bronze: 60, silver: 75, gold: 85, royalSapphire: 90 },
  },
  overrideTagIds: {
    bronzeTagId: "bronze-override",
    silverTagId: "silver-override",
    goldTagId: "gold-override",
    royalSapphireTagId: "sapphire-override",
  },
  goatTagId: "goat",
};

assert.equal(
  ratingTierForEntity({ rating100: 75 }, ratingConfig, "scene"),
  "silver"
);
assert.equal(
  ratingTierForEntity({ rating100: 40 }, ratingConfig, "scene"),
  "none"
);
assert.equal(
  ratingTierForEntity({ rating100: null }, ratingConfig, "scene"),
  undefined
);
assert.equal(
  ratingTierForEntity(
    { rating100: 100, rating_tier_tags: [{ id: "gold-override" }] },
    ratingConfig,
    "scene"
  ),
  "gold",
  "tag overrides take precedence over numeric thresholds"
);
assert.equal(
  ratingTierForEntity(
    {
      rating100: 20,
      rating_tier_tags: [{ id: "bronze-override" }],
      rating_scores: [{ section: "bonus", key: "goatElement", raw_value: 0.5 }],
    },
    ratingConfig,
    "scene"
  ),
  "royal_sapphire",
  "advisor promotion takes precedence over tag overrides"
);
assert.equal(
  ratingTierForEntity(
    { rating100: 20, rating_tier_tags: [{ id: "bronze-override" }] },
    ratingConfig,
    "scene",
    {
      scene_markers: [{ primary_tag: { id: "goat-child" }, tags: [] }],
      scene_marker_tag_ancestors: [
        { tag_id: "goat-child", ancestor_ids: ["goat"] },
      ],
    }
  ),
  "royal_sapphire",
  "GOAT marker descendants take precedence over scene tag overrides"
);
assert.equal(
  ratingTierForEntity(
    { rating100: null, rating_tier_tags: [{ id: "goat" }] },
    ratingConfig,
    "performer"
  ),
  "royal_sapphire",
  "the configured GOAT performer tag remains an override"
);

// Projection must retain the fixed server cohort, including vatos that have
// never appeared in a scene. The raw rating changes the preview tier only.
const vatosWithoutScenes: IVatoTierPerformer[] = [
  { id: "no-scenes", name: "No Scenes", rating100: 72, tier: "silver" },
  { id: "legacy", name: "Legacy", rating100: null, tier: "gold" },
];
const projectedVatoConfig = {
  ...ratingConfig,
  thresholds: {
    ...ratingConfig.thresholds,
    performer: { bronze: 75, silver: 80, gold: 90, royalSapphire: 98 },
  },
};
assert.equal(
  projectedVatoTier(vatosWithoutScenes[0], projectedVatoConfig),
  "none",
  "a no-scenes vato is still projected from their own rating"
);
assert.equal(
  projectedVatoTier(vatosWithoutScenes[1], projectedVatoConfig),
  "gold",
  "a legacy payload without a rating preserves its saved tier"
);
assert.deepEqual(
  projectVatoTiers(vatosWithoutScenes, projectedVatoConfig).map(
    ({ id, tier }) => [id, tier]
  ),
  [
    ["no-scenes", "none"],
    ["legacy", "gold"],
  ],
  "projection keeps every server-selected member in the cohort"
);

const performers: IVatoTierPerformer[] = [
  { id: "1", name: "Uno", ethnicity: " Latin ", country: "mx", tier: "gold" },
  { id: "2", name: "Dos", ethnicity: "Latin", country: "MX", tier: "bronze" },
  { id: "3", name: "Tres", ethnicity: "White", country: "US", tier: "silver" },
  {
    id: "4",
    name: "Cuatro",
    ethnicity: "Latin",
    country: "US",
    tier: "royal_sapphire",
  },
  { id: "5", name: "Cinco", ethnicity: "", country: null, tier: "gold" },
  { id: "6", name: "Seis", ethnicity: null, country: "Mexico", tier: "bronze" },
  { id: "7", name: "Siete", ethnicity: null, country: null, tier: "none" },
];
assert.equal(vatoTierValue(performers[0], "country"), "Mexico");
assert.equal(vatoTierValue(performers[4], "ethnicity"), "Unknown");
assert.equal(
  vatoTierFilterValue(performers[4], "country"),
  vatoTierUnknownValue
);
assert.equal(filterTierVatos(performers, emptyVatoTierFilters).length, 7);
assert.deepEqual(
  filterTierVatos(performers, {
    ethnicity: ["Latin"],
    country: ["MX"],
  }).map(({ id }) => id),
  ["1", "2"]
);
assert.deepEqual(
  filterTierVatos(performers, {
    ethnicity: ["Latin", "White"],
    country: ["US"],
  }).map(({ id }) => id),
  ["3", "4"]
);
assert.deepEqual(
  filterTierVatos(performers, {
    ethnicity: [vatoTierUnknownValue],
    country: [vatoTierUnknownValue],
  }).map(({ id }) => id),
  ["5", "7"]
);
assert.equal(
  filterTierVatos(performers, { ethnicity: ["White"], country: ["MX"] }).length,
  0
);
assert.deepEqual(countVatoTiers(performers), {
  bronze: 2,
  silver: 1,
  gold: 2,
  royal_sapphire: 1,
  none: 1,
});
const ethnicities = groupTierVatos(performers, "ethnicity", "total", true);
assert.deepEqual(
  ethnicities.map(({ label, total }) => [label, total]),
  [
    ["Latin", 3],
    ["Unknown", 3],
    ["White", 1],
  ]
);
assert.equal(
  ethnicities.reduce((sum, row) => sum + row.total, 0),
  performers.length
);
assert.deepEqual(
  groupTierVatos(performers, "country", "total", true).map(
    ({ label, total }) => [label, total]
  ),
  [
    ["Mexico", 3],
    ["United States", 2],
    ["Unknown", 2],
  ]
);
assert.equal(
  groupTierVatos(performers, "ethnicity", "silver", true)[0].label,
  "White"
);
assert.equal(
  groupTierVatos(performers, "ethnicity", "label", false)[0].label,
  "Latin"
);
assert.deepEqual(groupTierVatos([], "country", "total", true), []);
assert.deepEqual(
  groupTierVatos(performers, "country", "total", true)
    .find(({ label }) => label === "Mexico")
    ?.values.sort(),
  ["MX", "Mexico"]
);
assert.deepEqual(vatoTierRequest("gold"), {
  values: ["gold"],
  modifier: "INCLUDES",
});
assert.deepEqual(vatoTierRequest("none"), {
  values: [
    "bronze",
    "silver",
    "gold",
    "royal_sapphire",
    "__include_non_metallic__",
  ],
  modifier: "EXCLUDES",
  rating: { value: 0, modifier: "NOT_NULL" },
});
const bronzeLatinUrl = decodeURIComponent(
  makeVatoTierPerformersUrl({
    ethnicity: ["Latino"],
    country: ["MX"],
    tier: "bronze",
  })
);
assert.match(bronzeLatinUrl, /^\/performers\?/);
assert.match(bronzeLatinUrl, /"type":"ethnicity"/);
assert.match(bronzeLatinUrl, /"value":"Latino"/);
assert.match(bronzeLatinUrl, /"type":"country"/);
assert.match(bronzeLatinUrl, /"value":"MX"/);
assert.match(bronzeLatinUrl, /"type":"metallic_rating"/);
assert.match(bronzeLatinUrl, /"value":\["bronze"\]/);
const noTierUrl = decodeURIComponent(
  makeVatoTierPerformersUrl({
    country: [vatoTierUnknownValue],
    tier: "none",
  })
);
assert.match(noTierUrl, /"modifier":"EXCLUDES"/);
assert.match(noTierUrl, /__include_non_metallic__/);
assert.match(noTierUrl, /__unknown__/);
assert.match(noTierUrl, /"type":"rating100"/);
assert.match(noTierUrl, /"modifier":"NOT_NULL"/);

const schemaRoot = new URL("../../../graphql/schema/", import.meta.url);
const sources: string[] = [];
for (const directory of [schemaRoot, new URL("types/", schemaRoot)]) {
  for (const file of await readdir(directory)) {
    if (file.endsWith(".graphql"))
      sources.push(await readFile(new URL(file, directory), "utf8"));
  }
}
assert.deepEqual(
  validate(buildSchema(sources.join("\n")), parse(VATO_TIERS_QUERY)),
  []
);
const signal = new AbortController().signal;
const emptyPage = { findPerformers: { count: 0, performers: [] } };
const progress: number[] = [];
const loaded = await loadTierVatos(
  async (page, tier) => {
    const matches = performers.filter((performer) => performer.tier === tier);
    return {
      findPerformers: {
        count: matches.length,
        performers: matches.slice(page - 1, page),
      },
    };
  },
  signal,
  (count) => progress.push(count)
);
assert.equal(loaded.length, performers.length);
assert.equal(new Set(loaded.map(({ id }) => id)).size, performers.length);
assert.equal(progress[progress.length - 1], 7);
assert.deepEqual(
  await loadTierVatos(
    async () => emptyPage,
    signal,
    () => {}
  ),
  []
);
async function scanPages(pages: IVatoTierPage[]) {
  let index = 0;
  return loadTierVatos(
    async () => pages[index++] ?? emptyPage,
    signal,
    () => {}
  );
}
const first = { findPerformers: { count: 2, performers: [performers[0]] } };
await assert.rejects(scanPages([first, emptyPage]), /library changed/);
await assert.rejects(scanPages([first, first]), /tiers changed/);
await assert.rejects(
  scanPages([first, { findPerformers: { count: 2, performers: [] } }]),
  /Incomplete/
);
await assert.rejects(
  scanPages([{ findPerformers: { count: 0, performers: [performers[0]] } }]),
  /Incomplete/
);
await assert.rejects(
  loadTierVatos(
    async () => {
      throw new Error("Offline");
    },
    signal,
    () => {}
  ),
  /Offline/
);
const controller = new AbortController();
controller.abort();
await assert.rejects(
  loadTierVatos(
    async () => {
      assert.fail("Must not request after cancellation");
    },
    controller.signal,
    () => {}
  ),
  /cancelled/
);
const inFlight = new AbortController();
await assert.rejects(
  loadTierVatos(
    async () => {
      inFlight.abort();
      return emptyPage;
    },
    inFlight.signal,
    () => assert.fail("Must not update after cancellation")
  ),
  /cancelled/
);

function render(loading = false, error?: string, members = performers) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(
      StaticRouter,
      undefined,
      React.createElement(VatoTiersView, {
        state: { performers: members, loading, loaded: members.length, error },
        onReload: () => {},
      })
    )
  );
}
const markup = render();
assert.match(markup, /7 of 7 vatos/);
assert.match(markup, /aria-sort="descending"/);
assert.match(markup, /No Tier/);
assert.match(markup, /100.0%/);
assert.match(markup, /vato-tiers-country/);
assert.doesNotMatch(markup, /Row percentages|Previous|Next/);
const cardsMarkup = markup.slice(
  markup.indexOf('class="vato-tiers-cards"'),
  markup.indexOf('class="vato-tiers-table-panel"')
);
assert.ok(cardsMarkup.indexOf("Royal Sapphire") < cardsMarkup.indexOf("Gold"));
assert.ok(cardsMarkup.indexOf("Gold") < cardsMarkup.indexOf("Silver"));
assert.ok(cardsMarkup.indexOf("Silver") < cardsMarkup.indexOf("Bronze"));
assert.doesNotMatch(markup, /Current age|Birthdate|Scene comparison/);
assert.match(render(true), /role="status"/);
assert.doesNotMatch(render(true), /<table/);
assert.match(render(false, "Offline"), /Offline/);
assert.doesNotMatch(render(false, "Offline"), /<table/);
assert.match(render(false, undefined, []), /No vatos yet/);
