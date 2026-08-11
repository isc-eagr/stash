import assert from "node:assert/strict";
import test from "node:test";
import { getHoverPopoverVerticalLayout } from "../src/components/Shared/hoverPopoverPlacement_custom.ts";
import {
  SCENE_PERFORMER_OVERVIEW_EXCLUDED_FIELDS,
  SCENE_PERFORMER_OVERVIEW_LINK_PROPS,
  getScenePerformerOverviewActivityMetrics,
  getScenePerformerOverviewInteractions,
  getUniqueScenePerformerOverviewPartners,
  isScenePerformerOverviewFieldExcluded,
  shouldOpenScenePerformerOverview,
} from "../src/utils/scenePerformerOverview_custom.ts";

test("panel hover popovers flip above only when their content will not fit below", () => {
  assert.deepEqual(
    getHoverPopoverVerticalLayout({
      preferredPlacement: "bottom",
      triggerTop: 500,
      triggerBottom: 530,
      viewportHeight: 700,
      contentHeight: 320,
    }).placement,
    "top"
  );
  assert.deepEqual(
    getHoverPopoverVerticalLayout({
      preferredPlacement: "bottom",
      triggerTop: 200,
      triggerBottom: 230,
      viewportHeight: 700,
      contentHeight: 240,
    }).placement,
    "bottom"
  );
});

test("scene performer overview links always use a protected new tab", () => {
  assert.deepEqual(SCENE_PERFORMER_OVERVIEW_LINK_PROPS, {
    target: "_blank",
    rel: "noopener noreferrer",
  });
});

test("scene performer overview excludes only requested performer fields", () => {
  assert.deepEqual([...SCENE_PERFORMER_OVERVIEW_EXCLUDED_FIELDS].sort(), [
    "piercings",
    "stash_ids",
    "tattoos",
  ]);
});

test("scene performer overview partner hover deduplicates and sorts portraits", () => {
  const partners = getUniqueScenePerformerOverviewPartners([
    [
      {
        performer: { id: "2", name: "Zane", image_path: "/zane.jpg" },
      },
      {
        performer: { id: "1", name: "Alex", image_path: "/alex.jpg" },
      },
    ],
    [
      {
        performer: { id: "1", name: "Alex", image_path: "/alex.jpg" },
      },
    ],
  ]);

  assert.deepEqual(
    partners.map(({ id }) => id),
    ["1", "2"]
  );
});

test("scene performer overview groups this-scene partners in the fixed role order", () => {
  const performer = { id: "1", name: "Current" };
  const alex = { id: "2", name: "Alex", image_path: "/alex.jpg" };
  const zane = { id: "3", name: "Zane", image_path: "/zane.jpg" };
  const groups = getScenePerformerOverviewInteractions(
    [
      {
        primary_tag: { id: "sex-child", parents: [{ id: "sex" }] },
        tags: [],
        top_performers: [performer],
        bottom_performers: [zane, alex],
      },
      {
        primary_tag: { id: "sex" },
        tags: [],
        top_performers: [performer],
        bottom_performers: [alex],
      },
      {
        primary_tag: { id: "oral" },
        tags: [],
        top_performers: [zane],
        bottom_performers: [performer],
      },
      {
        primary_tag: { id: "oral" },
        tags: [],
        top_performers: [performer],
        bottom_performers: [alex],
      },
      {
        primary_tag: { id: "sex" },
        tags: [],
        top_performers: [zane],
        bottom_performers: [performer],
      },
      {
        primary_tag: { id: "orgasm" },
        tags: [{ id: "facial" }],
        top_performers: [performer],
        bottom_performers: [zane],
      },
    ],
    performer.id,
    {
      sexTagId: "sex",
      oralTagId: "oral",
      facialTagId: "facial",
      orgasmTagId: "orgasm",
    }
  );

  assert.deepEqual(
    groups.map(({ category, role, partners }) => ({
      category,
      role,
      partnerIds: partners.map(({ id }) => id),
    })),
    [
      { category: "sex", role: "top", partnerIds: ["2", "3"] },
      { category: "oral", role: "top", partnerIds: ["2"] },
      { category: "sex", role: "bottom", partnerIds: ["3"] },
      { category: "oral", role: "bottom", partnerIds: ["3"] },
    ]
  );
});

test("scene performer overview activity metrics retain zero durations", () => {
  const metrics = getScenePerformerOverviewActivityMetrics({
    sex_top_seconds: 90,
    sex_bottom_seconds: 0,
    oral_top_seconds: 45,
    oral_bottom_seconds: 0,
    solo_seconds: 0,
  });

  assert.deepEqual(
    metrics.map(({ role, seconds }) => ({ role, seconds })),
    [
      { role: "top", seconds: 90 },
      { role: "bottom", seconds: 0 },
      { role: "top", seconds: 45 },
      { role: "bottom", seconds: 0 },
      { role: "solo", seconds: 0 },
    ]
  );
});

test("scene performer overview retains the remaining detail metadata", () => {
  ["details", "penis_length", "tags", "career_length"].forEach((field) => {
    assert.equal(isScenePerformerOverviewFieldExcluded(field), false);
  });

  SCENE_PERFORMER_OVERVIEW_EXCLUDED_FIELDS.forEach((field) => {
    assert.equal(isScenePerformerOverviewFieldExcluded(field), true);
  });
});

test("scene performer cards open the overview only for plain primary clicks", () => {
  const primaryClick = {
    altKey: false,
    button: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
  };

  assert.equal(shouldOpenScenePerformerOverview(primaryClick), true);
  assert.equal(
    shouldOpenScenePerformerOverview({ ...primaryClick, ctrlKey: true }),
    false
  );
  assert.equal(
    shouldOpenScenePerformerOverview({ ...primaryClick, metaKey: true }),
    false
  );
  assert.equal(
    shouldOpenScenePerformerOverview({ ...primaryClick, button: 1 }),
    false
  );
});
