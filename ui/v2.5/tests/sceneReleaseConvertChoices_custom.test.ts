import assert from "node:assert/strict";
import test from "node:test";

import {
  IConvertChoiceScene,
  convertSourceDefaults,
  convertStashDBMatchesCustom,
} from "../src/components/Scenes/SceneDetails/sceneReleaseConvertChoices_custom.ts";

const scene = (
  overrides: Partial<IConvertChoiceScene> = {}
): IConvertChoiceScene => ({
  title: null,
  code: null,
  date: null,
  director: null,
  details: null,
  urls: [],
  studio: null,
  performers: [],
  tags: [],
  groups: [],
  galleries: [],
  ...overrides,
});

const source = scene({
  title: "Davos Reamed And Creamed",
  code: "RH-1",
  date: "2023-02-14",
  director: "Raw",
  details: "Source details",
  urls: ["https://rawhole.example/1"],
  studio: { id: "27" },
  performers: [{ id: "174" }, { id: "1448" }],
  tags: [{ id: "76" }, { id: "113" }],
  groups: [{ group: { id: "9" } }],
  galleries: [{ id: "4" }],
});

test("an empty target takes every source value except organized and Stash IDs", () => {
  assert.deepEqual(convertSourceDefaults(scene(), source), {
    title: true,
    code: true,
    date: true,
    director: true,
    details: true,
    urls: true,
    studio: true,
    performers: true,
    tags: true,
    groups: true,
    galleries: true,
  });
});

test("a filled target keeps its identity and merges only new cast and tags", () => {
  const dest = scene({
    title: "When Hunks Collide",
    code: "SU-1",
    date: "2022-04-27",
    director: "Uncle",
    details: "Target details",
    urls: ["https://sayuncle.example/1"],
    studio: { id: "55" },
    performers: [{ id: "174" }, { id: "1448" }],
    tags: [{ id: "113" }],
    groups: [{ group: { id: "8" } }],
    galleries: [{ id: "3" }],
  });
  assert.deepEqual(convertSourceDefaults(dest, source), {
    title: false,
    code: false,
    date: false,
    director: false,
    details: false,
    urls: false,
    studio: false,
    performers: false,
    tags: true,
    groups: false,
    galleries: false,
  });
});

test("an empty source changes nothing", () => {
  const defaults = convertSourceDefaults(scene(), scene());
  assert.ok(Object.values(defaults).every((useSource) => !useSource));
});

test("the target takes the StashDB count only with the source's StashDB link", () => {
  const stashDB = "https://stashdb.org/graphql";
  const source = {
    stash_ids: [{ endpoint: stashDB, stash_id: "raw-hole" }],
    stashdb_matches: 12,
  };
  const empty = { stash_ids: [] };
  assert.equal(
    convertStashDBMatchesCustom(empty, source, source.stash_ids),
    12
  );
  assert.equal(
    convertStashDBMatchesCustom(empty, source, undefined),
    undefined
  );
  const linked = { stash_ids: [{ endpoint: stashDB, stash_id: "say-uncle" }] };
  assert.equal(
    convertStashDBMatchesCustom(linked, source, linked.stash_ids),
    undefined
  );
  assert.equal(
    convertStashDBMatchesCustom(
      empty,
      { ...source, stashdb_matches: null },
      source.stash_ids
    ),
    undefined
  );
});
