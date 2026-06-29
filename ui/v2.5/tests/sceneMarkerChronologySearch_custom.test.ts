import assert from "node:assert/strict";

import {
  filterChronologicalSceneMarkers,
  getChronologicalSceneMarkerPerformers,
  getChronologicalSceneMarkerTags,
  getCompatibleChronologicalSceneMarkerTags,
} from "../src/components/Scenes/SceneDetails/sceneMarkerChronologySearch_custom.ts";

const tag = (
  id: string,
  name: string,
  parents: Array<{ id: string }> = []
) => ({
  id,
  name,
  parents,
});
const performer = (id: string, name: string, aliases: string[] = []) => ({
  id,
  name,
  alias_list: aliases,
});

const marker = (
  id: string,
  seconds: number,
  endSeconds: number | null,
  primaryTag: ReturnType<typeof tag>,
  secondaryTags: Array<ReturnType<typeof tag>> = [],
  topPerformers: Array<ReturnType<typeof performer>> = [],
  bottomPerformers: Array<ReturnType<typeof performer>> = []
) => ({
  id,
  seconds,
  end_seconds: endSeconds,
  primary_tag: primaryTag,
  tags: secondaryTags,
  top_performers: topPerformers,
  bottom_performers: bottomPerformers,
});

const feet = tag("feet", "Feet");
const verga = tag("verga", "Verga");
const bj = tag("bj", "BJ");
const oral = tag("oral", "Oral");
const orgasm = tag("orgasm", "Orgasm");
const juan = performer("juan", "Juan", ["El Guapo"]);
const luis = performer("luis", "Luis");

assert.deepEqual(
  filterChronologicalSceneMarkers(
    [
      marker("1", 20, 30, oral),
      marker("2", 10, 15, feet, [verga]),
      marker("3", 40, 50, feet),
    ],
    { tags: [verga, feet], topPerformers: [], bottomPerformers: [] }
  ).map((m) => m.id),
  ["2"],
  "a direct marker with both requested tags matches"
);

assert.deepEqual(
  filterChronologicalSceneMarkers(
    [
      marker("1", 0, 100, feet),
      marker("2", 10, 20, verga),
      marker("3", 120, 130, oral),
    ],
    { tags: [feet, verga], topPerformers: [], bottomPerformers: [] }
  ).map((m) => m.id),
  ["2"],
  "overlapping single-tag markers keep only the narrower matching marker"
);

assert.deepEqual(
  filterChronologicalSceneMarkers(
    [marker("1", 0, 10, feet), marker("2", 11, 20, verga)],
    { tags: [feet, verga], topPerformers: [], bottomPerformers: [] }
  ).map((m) => m.id),
  [],
  "single-tag markers must overlap to satisfy a multi-tag search"
);

assert.deepEqual(
  filterChronologicalSceneMarkers(
    [
      marker("1", 0, 15, feet),
      marker("2", 10, 20, bj),
      marker("3", 18, 25, orgasm),
    ],
    { tags: [feet, bj, orgasm], topPerformers: [], bottomPerformers: [] }
  ).map((m) => m.id),
  [],
  "multi-tag searches require all contributing tag markers to share one overlap window"
);

assert.deepEqual(
  filterChronologicalSceneMarkers(
    [
      marker("1", 0, 30, feet),
      marker("2", 10, 20, bj),
      marker("3", 15, 25, orgasm),
    ],
    { tags: [feet, bj, orgasm], topPerformers: [], bottomPerformers: [] }
  ).map((m) => m.id),
  ["2"],
  "multi-tag searches match when every selected tag shares a common overlap window"
);

assert.deepEqual(
  filterChronologicalSceneMarkers(
    [
      marker("1", 0, 10, oral, [], [juan], [luis]),
      marker("2", 20, 30, oral, [], [luis], [juan]),
    ],
    { tags: [], topPerformers: [juan], bottomPerformers: [luis] }
  ).map((m) => m.id),
  ["1"],
  "top and bottom performer searches match direct marker roles"
);

assert.deepEqual(
  filterChronologicalSceneMarkers(
    [marker("1", 0, 10, tag("child", "Feet closeup", [{ id: "feet" }]))],
    { tags: [feet], topPerformers: [], bottomPerformers: [] }
  ).map((m) => m.id),
  ["1"],
  "selected parent tags match child marker tags when parent data is loaded"
);

assert.deepEqual(
  getChronologicalSceneMarkerTags([
    marker("1", 0, 10, feet, [verga]),
    marker("2", 20, 30, oral),
  ]).map((t) => t.id),
  ["feet", "oral", "verga"],
  "scene tag options only include tags used by markers"
);

assert.deepEqual(
  getCompatibleChronologicalSceneMarkerTags(
    [
      marker("1", 0, 100, feet),
      marker("2", 10, 20, verga),
      marker("3", 120, 130, oral),
    ],
    [feet]
  ).map((t) => t.id),
  ["verga"],
  "next tag options only include tags that still produce an overlap/share match"
);

assert.deepEqual(
  getCompatibleChronologicalSceneMarkerTags(
    [
      marker("1", 0, 15, feet),
      marker("2", 10, 20, bj),
      marker("3", 18, 25, orgasm),
    ],
    [feet, bj]
  ).map((t) => t.id),
  [],
  "next tag options reject chain overlaps without one shared overlap window"
);

assert.deepEqual(
  getChronologicalSceneMarkerPerformers(
    [
      marker("1", 0, 100, feet, [], [juan]),
      marker("2", 10, 20, verga, [], [luis]),
      marker("3", 120, 130, oral, [], [luis]),
    ],
    [feet, verga],
    "top"
  ).map((p) => p.id),
  ["luis"],
  "performer options are derived from tag-filtered marker results"
);
