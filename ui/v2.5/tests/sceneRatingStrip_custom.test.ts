import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  getSceneCardChipInsightSets,
  getSceneGoatMomentsCustom,
  getSceneOrgasmFacialEvents,
} from "../src/components/Scenes/sceneCardInsightsData_custom.ts";
import {
  getSceneCardOrgasmReportGroupsCustom,
  sceneCardOrgasmReportGroupLabelCustom,
} from "../src/components/Scenes/sceneCardOrgasmReportData_custom.ts";

const roleTagIds = {
  sexTagId: "sex",
  oralTagId: "oral",
  orgasmTagId: "orgasm",
  facialTagId: "facial",
  secondCameraTagId: "second-camera",
  reallyHotTagId: "really-hot",
  goatTagId: "goat",
};

const tag = (id: string, parents: Array<{ id: string }> = []) => ({
  id,
  name: id,
  parents,
});
const vato = (id: string) => ({ id, name: id });
const marker = (
  id: string,
  primaryTag: ReturnType<typeof tag>,
  secondaryTags: Array<ReturnType<typeof tag>> = [],
  topPerformers: Array<ReturnType<typeof vato>> = [],
  bottomPerformers: Array<ReturnType<typeof vato>> = []
) => ({
  id,
  seconds: Number(id.replace(/\D/g, "")) || 0,
  end_seconds: null,
  primary_tag: primaryTag,
  tags: secondaryTags,
  top_performers: topPerformers,
  bottom_performers: bottomPerformers,
});
const scene = (
  sceneMarkers: ReturnType<typeof marker>[],
  performers: Array<ReturnType<typeof vato>> = []
) => ({
  id: "scene-1",
  files: [{ duration: 600 }],
  performers,
  scene_markers: sceneMarkers,
});

const top1 = vato("top-1");
const top2 = vato("top-2");
const events = getSceneOrgasmFacialEvents(
  scene([
    marker("orgasm-10", tag("orgasm"), [], [top1, top2]),
    // A Facial subtag of Orgasm still counts as a facial.
    marker("facial-20", tag("cum-shot", [{ id: "facial" }]), [
      tag("really-hot"),
    ]),
    marker("orgasm-30", tag("orgasm"), [tag("goat")], [top1]),
    marker("orgasm-40", tag("orgasm"), [tag("second-camera")], [top1]),
    marker("sex-50", tag("sex"), [], [top1]),
  ]),
  roleTagIds
);
assert.deepEqual(
  events.map(({ id, category, quality }) => [id, category, quality]),
  [
    ["orgasm-10-0", "orgasm", undefined],
    ["orgasm-10-1", "orgasm", undefined],
    ["facial-20-0", "facial", "Really Hot"],
    ["orgasm-30-0", "orgasm", "GOAT"],
  ],
  "one event per top on Orgasm/Facial markers and subtags, skipping 2nd Camera"
);

const groups = getSceneCardOrgasmReportGroupsCustom(events);
assert.deepEqual(groups, [
  { category: "orgasm", count: 2 },
  { category: "orgasm", quality: "GOAT", count: 1 },
  { category: "facial", quality: "Really Hot", count: 1 },
]);
assert.deepEqual(groups.map(sceneCardOrgasmReportGroupLabelCustom), [
  "2 orgasms",
  "1 GOAT orgasm",
  "1 Really Hot facial",
]);
assert.deepEqual(
  getSceneCardOrgasmReportGroupsCustom([]),
  [],
  "no events leaves the crossed-out drops to the card"
);

const timed = (
  base: ReturnType<typeof marker>,
  seconds: number,
  endSeconds: number
) => ({ ...base, seconds, end_seconds: endSeconds });
const goat = getSceneGoatMomentsCustom(
  scene([
    timed(marker("rim", tag("rimming"), [tag("goat")], [top1]), 100, 130),
    // Overlapping time counts once.
    timed(marker("kiss", tag("kissing"), [tag("goat")], [top2]), 120, 140),
    marker("moment-300", tag("goat")),
    // Orgasms and facials stay in the orgasm report.
    timed(marker("nut", tag("orgasm"), [tag("goat")], [top1]), 200, 210),
    timed(
      marker("cam", tag("rimming"), [tag("goat"), tag("second-camera")]),
      400,
      450
    ),
    timed(marker("plain", tag("rimming")), 500, 550),
  ]),
  roleTagIds
);
assert.equal(goat.duration, 40, "GOAT time is the union of timed markers");
assert.deepEqual(
  goat.moments.map(({ id, label }) => [id, label]),
  [
    ["rim", "rimming"],
    ["kiss", "kissing"],
    ["moment-300", "GOAT moment"],
  ],
  "GOAT moments skip orgasms, facials, and 2nd camera"
);

const onlyVato = vato("only-vato");
const oralTop = vato("oral-top");
const sexTop = vato("sex-top");
const bottom = vato("bottom");
const roleStats = (overrides: Record<string, number>) => ({
  scene_count: 20,
  sex_top_count: 0,
  sex_bottom_count: 0,
  oral_role_top_count: 0,
  oral_role_bottom_count: 0,
  facial_scene_count: 0,
  ...overrides,
});
const chipSets = getSceneCardChipInsightSets(
  scene(
    [
      marker("oral-1", tag("oral"), [], [oralTop], [bottom]),
      marker("sex-2", tag("sex"), [], [sexTop], [bottom]),
    ],
    [onlyVato, oralTop, sexTop, bottom]
  ),
  roleTagIds,
  undefined,
  new Map([
    [onlyVato.id, roleStats({ scene_count: 1 })],
    [
      oralTop.id,
      roleStats({ oral_role_top_count: 1, oral_role_bottom_count: 9 }),
    ],
    [sexTop.id, roleStats({ sex_top_count: 1, sex_bottom_count: 9 })],
  ])
);
assert.deepEqual(
  chipSets.all.map(({ key }) => key).sort(),
  ["only-scene-only-vato", "rare-oral-top-oral-top"],
  "scene cards keep only the Rare oral top and Only scene chip families"
);

const orgasmChipSets = getSceneCardChipInsightSets(
  scene([
    marker("orgasm-10", tag("orgasm"), [], [top1, top2]),
    marker("orgasm-200", tag("orgasm"), [], [top1]),
  ]),
  roleTagIds
);
assert.deepEqual(
  orgasmChipSets.all.map(({ key }) => key).sort(),
  ["orgasm-repeat-top-1", "orgasm-simultaneous"],
  "scene cards also keep Vatos nut at the same time and Repeated orgasms"
);

const source = (path: string) =>
  readFileSync(new URL(`../src/components/${path}`, import.meta.url), "utf8");
const cardSource = source("Scenes/SceneCard.tsx");
assert.doesNotMatch(
  cardSource,
  /scene-facial-overlay|facialPng/,
  "the thumbnail facial icon moved into the rating strip"
);
assert.doesNotMatch(
  cardSource,
  /RatingCriteriaTooltip/,
  "the card rating star has no hover summary"
);
assert.match(cardSource, /<SceneRatingStrip scene=\{props\.scene\} \/>/);
const sceneDetailSource = source("Scenes/SceneDetails/Scene.tsx");
assert.match(
  sceneDetailSource,
  /<SceneDetailActivityBar scene=\{scene\} \/>\s*<SceneRatingStrip/,
  "scene details show the activity bar and rating strip with the orgasm report"
);
const advisorSource = source("Shared/RatingAdvisor_custom.tsx");
assert.doesNotMatch(
  advisorSource,
  /RatingCriteriaTooltip|showSummaryOnHover/,
  "rating strips replace every rating star hover summary"
);
const performerCardSource = source("Performers/PerformerCard.tsx");
assert.ok(
  performerCardSource.indexOf("<RatingCriteriaStrip") <
    performerCardSource.indexOf("<PerformerCategoryStrip"),
  "performer cards show the rating strip above the versatility strips"
);
const performerPageSource = source("Performers/PerformerDetails/Performer.tsx");
assert.match(
  performerPageSource,
  /performer-head-identity[\s\S]*?<RatingCriteriaStrip\s+className="rating-panel rating-panel--vato"/,
  "performer pages show his rating strip beside his name and ratings"
);
assert.doesNotMatch(
  performerPageSource,
  /PerformerSceneRatingStrips/,
  "his scene averages live in the Stats tab"
);
const drawerSource = source(
  "Scenes/SceneDetails/ScenePerformerOverviewPanel_custom.tsx"
);
assert.match(
  drawerSource,
  /<PerformerSceneAverageRating[\s\S]*?scene-performer-overview-rating--o-count[\s\S]*?<\/section>\s*<RatingCriteriaStrip/,
  "the vato drawer shows O Count beside the scene average, then his strip"
);
assert.match(
  drawerSource,
  /ageFromDate=\{scene\.effective_date \?\? scene\.date\}/,
  "the vato drawer shows his age in the scene"
);
assert.match(
  source("Scenes/SceneActivityBar_custom.tsx"),
  /scene-activity-bar--detail"\s*outstandingBatteries/,
  "scene details show the Outstanding batteries"
);
assert.match(
  source("Scenes/SceneRatingStrip_custom.tsx"),
  /<SceneCardGoatMoments \{\.\.\.goat\} \/>/,
  "rating strips show GOAT moment time beside the orgasm report"
);
const studioHeaderSource = source(
  "Studios/StudioDetails/StudioHeaderInsights.tsx"
);
assert.match(
  studioHeaderSource,
  /only="activity"[\s\S]*?rating-panel rating-panel--scenes[\s\S]*?rating-panel rating-panel--vato/,
  "studio pages show Activity Type, then scene averages apart from vato averages"
);
const averagesSource = source(
  "Studios/StudioDetails/StudioRatingAdvisorStats.tsx"
);
assert.match(
  averagesSource,
  /<RatingStrip[\s\S]*?rating-criteria-strip--average/,
  "Rating Advisor averages render as inline strips"
);
assert.match(
  averagesSource,
  /value: \(criterion\.average_fill_percent \/ 100\) \* steps/,
  "averages fill part of a step"
);
const studioCardSource = source("Studios/StudioCard.tsx");
assert.match(
  studioCardSource,
  /<ActivityStatsCharts[\s\S]*?only="activity"[\s\S]*?\{maybeRenderActivityBar\(\)\}/,
  "studio cards show the compact Activity Type bar"
);
assert.match(
  studioCardSource,
  /<ActivityStatsCharts\s+compact\s+only="quality"/,
  "the studio logo hover keeps the compact Quality bar"
);

console.log("Scene rating strip tests passed.");
