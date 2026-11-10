import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CARD_SKELETON_MAX_COUNT,
  cardGridSkeletonCustom,
} from "../src/components/Shared/cardSkeletonLayout_custom.ts";
import { DisplayMode } from "../src/models/list-filter/types.ts";

const filter = (
  displayMode: DisplayMode,
  zoomIndex = 1,
  itemsPerPage = 40
) => ({ displayMode, zoomIndex, itemsPerPage });

test("placeholders take each catalog's card shape and zoom width", () => {
  assert.deepEqual(cardGridSkeletonCustom("scene", filter(DisplayMode.Grid)), {
    layout: "grid",
    shape: "landscape",
    cardWidth: 340,
    count: CARD_SKELETON_MAX_COUNT,
  });
  assert.deepEqual(
    cardGridSkeletonCustom("performer", filter(DisplayMode.Grid, 3)),
    { layout: "grid", shape: "portrait", cardWidth: 470, count: 12 }
  );
  assert.equal(
    cardGridSkeletonCustom("group", filter(DisplayMode.Wall, 0)).shape,
    "portrait"
  );
  assert.equal(
    cardGridSkeletonCustom("studio", filter(DisplayMode.Grid, 2)).cardWidth,
    420
  );
});

test("List and Tagger views get rows; counts never exceed the page", () => {
  for (const mode of [DisplayMode.List, DisplayMode.Tagger]) {
    const skeleton = cardGridSkeletonCustom("scene", filter(mode));
    assert.equal(skeleton.layout, "rows");
    assert.equal(skeleton.count, 8);
  }
  assert.equal(
    cardGridSkeletonCustom("tag", filter(DisplayMode.Grid, 1, 5)).count,
    5
  );
  assert.equal(
    cardGridSkeletonCustom("tag", filter(DisplayMode.Grid, 1, 0)).count,
    CARD_SKELETON_MAX_COUNT,
    "a missing page size still shows placeholders"
  );
  assert.equal(
    cardGridSkeletonCustom("image", filter(DisplayMode.Grid, 99)).cardWidth,
    640,
    "an out-of-range zoom clamps to the widest card"
  );
  assert.equal(
    cardGridSkeletonCustom("image", filter(DisplayMode.Grid, -3)).cardWidth,
    280
  );
});

test("every catalog and the stats pages load with placeholders", () => {
  const read = (path: string) =>
    readFileSync(new URL(`../src/components/${path}`, import.meta.url), "utf8");
  for (const [path, entity] of [
    ["Scenes/SceneList.tsx", "scene"],
    ["Scenes/SceneMarkerList.tsx", "marker"],
    ["Galleries/GalleryList.tsx", "gallery"],
    ["Images/ImageList.tsx", "image"],
    ["Groups/GroupList.tsx", "group"],
    ["Performers/PerformerList.tsx", "performer"],
    ["Studios/StudioList.tsx", "studio"],
    ["Tags/TagList.tsx", "tag"],
  ]) {
    assert.ok(
      read(path).includes(
        `skeleton={cardGridSkeletonCustom("${entity}", filter)}`
      ),
      `${path} passes its card shape`
    );
  }
  assert.match(
    read("List/PagedList.tsx"),
    /skeleton \? <CardGridSkeleton \{\.\.\.skeleton\} \/> : <LoadingIndicator \/>/,
    "lists without a shape keep the loading indicator"
  );
  assert.match(read("StatsPage_custom.tsx"), /<StatsPageSkeleton message=/);
  assert.doesNotMatch(read("StatsPage_custom.tsx"), /LoadingIndicator/);

  const styles = read("Shared/cardGridSkeleton_custom.scss");
  assert.match(
    styles,
    /prefers-reduced-motion: reduce\) \{\s*\.card-skeleton-block \{\s*animation: none;/
  );
  assert.match(read("Shared/CardGridSkeleton_custom.tsx"), /role="status"/);
});
