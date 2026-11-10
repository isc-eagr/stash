import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import Countries from "i18n-iso-countries";
import { getMetallicRatingTierCustom } from "../src/utils/ratingCardStyles_custom.ts";
import {
  getSceneActivityDataCustom,
  getSceneActivityMetrics,
  getSceneMarkerCountCustom,
} from "../src/components/Scenes/sceneActivityMetricsData_custom.ts";
import {
  cleanStatsValueCustom,
  statsCountCustom,
} from "../src/utils/statsValues_custom.ts";
import {
  setAppLocaleCustom,
  getAppLocaleCustom,
  formatAppDecimalCustom,
} from "../src/utils/appLocale_custom.ts";
import { formatTaskProgressDate } from "../src/components/taskProgress_custom.ts";
import { statsCountryName } from "../src/utils/statsCountry_custom.ts";
import {
  parsePercentageMetricCustom,
  updatePercentageMetricCustom,
} from "../src/utils/percentageMetric_custom.ts";
import {
  statsRankingViewCustom,
  statsRankingViewSearchCustom,
} from "../src/utils/statsRankingView_custom.ts";
import { CriterionModifier } from "../src/core/generated-graphql.ts";

const require = createRequire(import.meta.url);
Countries.registerLocale(require("i18n-iso-countries/langs/en.json"));
Countries.registerLocale(require("i18n-iso-countries/langs/es.json"));
for (const value of [
  undefined,
  null,
  "",
  " ",
  "<NiL>",
  "null",
  "Unknown",
  "__unknown__",
])
  assert.equal(cleanStatsValueCustom(value), undefined);
assert.equal(cleanStatsValueCustom("  Mexican  "), "Mexican");
assert.equal(statsCountCustom(0), 0);
for (const value of [undefined, null, NaN, -1])
  assert.equal(statsCountCustom(value), undefined);

setAppLocaleCustom("es-ES");
assert.equal(formatAppDecimalCustom(12345.5, 1), "12.345,5");
assert.equal(statsCountryName("MX"), "México");
setAppLocaleCustom("en-US");
assert.equal(formatTaskProgressDate("2026-10-21"), "10/21/2026");
setAppLocaleCustom("en-GB");
assert.equal(formatTaskProgressDate("2026-10-21"), "21/10/2026");
assert.equal(statsCountryName("MX"), "Mexico");
assert.equal(getAppLocaleCustom(), "en-GB");

const original = {
  oral_percent: { modifier: CriterionModifier.LessThan, value: 50 },
};
const empty = parsePercentageMetricCustom("", original.oral_percent);
assert.deepEqual(empty, {
  modifier: CriterionModifier.LessThan,
  value: undefined,
});
assert.equal(parsePercentageMetricCustom(""), undefined);
assert.equal(parsePercentageMetricCustom("500")?.value, 100);
assert.equal(parsePercentageMetricCustom("-1")?.value, 0);
assert.deepEqual(
  updatePercentageMetricCustom(original, "oral_percent", undefined),
  {}
);
assert.equal(original.oral_percent.value, 50);

const search = "?range=custom&from=2026-10-01&osStudio=3";
const table = statsRankingViewSearchCustom(search, "table");
assert.equal(statsRankingViewCustom(table), "table");
assert.equal(new URLSearchParams(table).get("osStudio"), "3");
assert.equal(
  statsRankingViewCustom(statsRankingViewSearchCustom(table, "cards")),
  "cards"
);
assert.equal(statsRankingViewCustom("?rankingView=invalid"), "cards");

const tag = (id: string) => ({ id, name: id });
const scene = {
  id: "1",
  files: [{ duration: 120 }],
  scene_markers: [
    { seconds: 0, end_seconds: 60, primary_tag: tag("sex"), tags: [] },
    { seconds: 0, end_seconds: 60, primary_tag: tag("oral"), tags: [] },
  ],
  negative_markers: [{ start_seconds: 20, end_seconds: 30 }],
};
const roles = { sexTagId: "sex", oralTagId: "oral" };
const activity = getSceneActivityDataCustom(scene, roles)!;
assert.equal(activity.activityTimeSeconds, 60);
assert.equal(activity.sexSeconds + activity.oralSeconds, 120);
assert.deepEqual(
  getSceneActivityMetrics(scene, roles)?.activity.map((row) => row.percent),
  [100, 100]
);
assert.equal(activity.standardSeconds, 50);
assert.equal(activity.unusableSeconds, 10);
assert.equal(activity.unclassifiedSeconds, 60);

const fixtures = JSON.parse(
  readFileSync(
    new URL("./fixtures/metallicTiers_custom.json", import.meta.url),
    "utf8"
  )
);
for (const fixture of fixtures)
  assert.equal(
    getMetallicRatingTierCustom({
      rating: fixture.rating,
      tags: fixture.tags.map((id: string) => ({ id })),
      thresholds: fixture.thresholds,
      overrideTagIds: {
        bronzeTagId: "1",
        silverTagId: "2",
        goldTagId: "3",
        royalSapphireTagId: "4",
      },
      goatTagId: "5",
    }),
    fixture.expected ?? undefined,
    JSON.stringify(fixture)
  );

// The list counts use the same exclusive quality buckets as event statistics.
const qualityScene = {
  scene_markers: [
    { primary_tag: tag("facial"), tags: [] },
    { primary_tag: tag("facial"), tags: [tag("hot")] },
    { primary_tag: tag("facial"), tags: [tag("goat")] },
    { primary_tag: tag("facial"), tags: [tag("hot"), tag("goat")] },
  ].map((marker) => ({ ...marker, seconds: 0, end_seconds: 10 })),
};
const qualityRoles = {
  facialTagId: "facial",
  reallyHotTagId: "hot",
  goatTagId: "goat",
};
assert.deepEqual(
  (
    [
      "regular_facial_count",
      "really_hot_facial_count",
      "goat_facial_count",
    ] as const
  ).map((key) => getSceneMarkerCountCustom(qualityScene, qualityRoles, key)),
  [1, 1, 2]
);
