import assert from "node:assert/strict";
import test from "node:test";
import {
  SITE_SYNC_ALL_STEPS_CUSTOM,
  SiteSyncReportCustom,
  siteSyncChangeLabelsCustom,
  siteSyncHasStepCustom,
  siteSyncInputCustom,
  siteSyncStepsCustom,
  siteSyncSummaryCustom,
  splitSiteSyncScenesCustom,
} from "../src/components/Studios/StudioDetails/studioSiteSync_custom.ts";

const papis = { name: "NakedPapis", pictures: true };
const latinboyz = { name: "LatinBoyz", pictures: false };

test("site sync hides the pictures step for sites without downloads", () => {
  assert.deepEqual(
    siteSyncStepsCustom(papis).map((step) => step.key),
    ["codes", "metadata", "pictures", "galleries"]
  );
  assert.deepEqual(
    siteSyncStepsCustom(latinboyz).map((step) => step.key),
    ["codes", "metadata", "galleries"]
  );
});

test("site sync input sends the chosen steps and never pictures for hand-added folders", () => {
  const selection = { ...SITE_SYNC_ALL_STEPS_CUSTOM, metadata: false };
  assert.deepEqual(siteSyncInputCustom("18", papis, selection), {
    studio_id: "18",
    codes: true,
    metadata: false,
    pictures: true,
    galleries: true,
  });
  assert.equal(siteSyncInputCustom("7", latinboyz, selection).pictures, false);
});

test("site sync needs a visible step", () => {
  const onlyPictures = {
    codes: false,
    metadata: false,
    pictures: true,
    galleries: false,
  };
  assert.equal(siteSyncHasStepCustom(papis, onlyPictures), true);
  assert.equal(siteSyncHasStepCustom(latinboyz, onlyPictures), false);
});

const scene = (
  overrides: Partial<SiteSyncReportCustom["scenes"][number]>
): SiteSyncReportCustom["scenes"][number] => ({
  scene_id: "1",
  title: "",
  basename: "x.mp4",
  code: "",
  filled: [],
  pictures: false,
  gallery_id: null,
  issues: [],
  ...overrides,
});

const report: SiteSyncReportCustom = {
  job_id: "4",
  site: "NakedPapis",
  finished: true,
  cancelled: false,
  error: null,
  checked: 120,
  postponed: 3,
  no_pictures: 1,
  scanned_folders: 1,
  warnings: [],
  scenes: [
    scene({
      scene_id: "33250",
      title: "Alby, Mascara & JoJo",
      basename: "995-high.mp4",
      code: "995",
      filled: ["code", "title", "urls", "cover"],
      pictures: true,
      gallery_id: "88",
    }),
    scene({
      scene_id: "33251",
      basename: "river-lucas.mp4",
      issues: [
        "Not in the members index or the folders after it; set the code by hand",
      ],
    }),
  ],
};

test("site sync report splits changes from issues and labels each change", () => {
  const { changed, issues } = splitSiteSyncScenesCustom(report.scenes);
  assert.deepEqual(
    changed.map((s) => s.scene_id),
    ["33250"]
  );
  assert.deepEqual(
    issues.map((s) => s.scene_id),
    ["33251"]
  );
  assert.deepEqual(siteSyncChangeLabelsCustom(changed[0]), [
    "Code",
    "Title",
    "Links",
    "Cover",
    "Pictures",
    "Gallery",
  ]);
});

test("site sync summary lists only non-zero totals", () => {
  assert.deepEqual(siteSyncSummaryCustom(report), [
    "Checked 120 scenes",
    "3 postponed",
    "1 scene updated",
    "1 picture set downloaded",
    "1 folder scanned",
    "1 gallery made",
    "1 scene without pictures",
  ]);
  assert.deepEqual(
    siteSyncSummaryCustom({
      ...report,
      postponed: 0,
      no_pictures: 0,
      scanned_folders: 0,
      scenes: [],
    }),
    ["Checked 120 scenes"]
  );
});
