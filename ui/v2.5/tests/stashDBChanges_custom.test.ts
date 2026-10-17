import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import ReactDOMServer from "react-dom/server.js";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { InMemoryCache } from "@apollo/client";
import {
  STASHDB_PERFORMER_FIELDS_CUSTOM,
  STASHDB_SCENE_FIELDS_CUSTOM,
  stashDBApplicableCustom,
  stashDBEntryURLCustom,
  stashDBFieldCountsCustom,
  stashDBSkippedCustom,
  toggleStashDBFieldCustom,
  visibleStashDBChangesCustom,
} from "../src/components/StashDBChanges/stashDBChanges_custom.ts";
import { updateStashDBChangesReportCustom } from "../src/core/stashDBChangesCache_custom.ts";
import {
  StashDbChangesReportDocument,
  type StashDbChangesReportQuery,
} from "../src/core/generated-graphql.ts";
import {
  StashDBChangesEntry,
  StashDBChangesGroup,
} from "../src/components/StashDBChanges/StashDBChangesEntry.tsx";

const field = (name: string) => ({ field: name });

test("excluded fields hide changed entries but never gone ones", () => {
  const entries = [
    { stash_id: "a", status: "CHANGED", fields: [field("title")] },
    {
      stash_id: "b",
      status: "CHANGED",
      fields: [field("disambiguation"), field("tags")],
    },
    { stash_id: "c", status: "DELETED", fields: [] },
    { stash_id: "d", status: "MERGED", fields: [field("title")] },
  ];

  const all = visibleStashDBChangesCustom(entries, []);
  assert.deepEqual(
    all.changed.map((e) => e.stash_id),
    ["a", "b"]
  );
  assert.deepEqual(
    all.gone.map((e) => e.stash_id),
    ["c", "d"]
  );

  const filtered = visibleStashDBChangesCustom(entries, ["title", "tags"]);
  assert.deepEqual(
    filtered.changed.map((e) => [e.stash_id, e.fields.map((f) => f.field)]),
    [["b", ["disambiguation"]]]
  );
  assert.deepEqual(
    filtered.gone.map((e) => [e.stash_id, e.fields.length]),
    [
      ["c", 0],
      ["d", 0],
    ],
    "a merged entry stays listed when its fields are hidden"
  );
  assert.equal(entries[0].fields.length, 1, "entries are not mutated");
});

test("field counts include every field regardless of exclusions", () => {
  const counts = stashDBFieldCountsCustom([
    { stash_id: "a", status: "CHANGED", fields: [field("urls")] },
    {
      stash_id: "b",
      status: "CHANGED",
      fields: [field("urls"), field("name")],
    },
    { stash_id: "c", status: "NOT_FOUND", fields: [] },
  ]);
  assert.deepEqual(Object.fromEntries(counts), { urls: 2, name: 1 });
});

test("toggling a field adds or removes its exclusion", () => {
  assert.deepEqual(toggleStashDBFieldCustom([], "ethnicity"), ["ethnicity"]);
  assert.deepEqual(
    toggleStashDBFieldCustom(["ethnicity", "disambiguation"], "ethnicity"),
    ["disambiguation"]
  );
});

test("every field the backend compares has a picker entry", () => {
  const keys = (fields: readonly [string, string][]) =>
    fields.map(([key]) => key).sort();
  assert.deepEqual(keys(STASHDB_SCENE_FIELDS_CUSTOM), [
    "code",
    "date",
    "details",
    "director",
    "performers",
    "studio",
    "tags",
    "title",
    "urls",
  ]);
  assert.deepEqual(keys(STASHDB_PERFORMER_FIELDS_CUSTOM), [
    "aliases",
    "birthdate",
    "career_end",
    "career_start",
    "country",
    "death_date",
    "disambiguation",
    "ethnicity",
    "eye_color",
    "fake_tits",
    "gender",
    "hair_color",
    "height",
    "measurements",
    "name",
    "piercings",
    "tattoos",
    "urls",
  ]);
});

test("StashDB links point at the endpoint's site", () => {
  assert.equal(
    stashDBEntryURLCustom("https://stashdb.org/graphql", "scene", "a/b"),
    "https://stashdb.org/scenes/a%2Fb"
  );
  assert.equal(
    stashDBEntryURLCustom("https://stashdb.org/graphql", "performer", "p1"),
    "https://stashdb.org/performers/p1"
  );
});

const render = (element: React.ReactElement) =>
  ReactDOMServer.renderToStaticMarkup(
    React.createElement(
      IntlProvider,
      { locale: "en", messages: {} },
      React.createElement(MemoryRouter, {}, element)
    )
  );

test("an entry shows scalar and list changes side by side", () => {
  const markup = render(
    React.createElement(StashDBChangesEntry, {
      kind: "scene",
      endpoint: "https://stashdb.org/graphql",
      name: "Scene One",
      subtitle: "2024-05-06",
      url: "/scenes/1",
      status: "MERGED",
      stashID: "old",
      mergedIntoID: "new",
      labels: new Map([
        ["title", "Title"],
        ["tags", "Tags"],
      ]),
      fields: [
        { field: "title", local: null, remote: "New", added: [], removed: [] },
        {
          field: "tags",
          local: null,
          remote: null,
          added: ["Rimming"],
          removed: ["Dropped"],
        },
      ],
    })
  );
  assert.match(markup, /href="\/scenes\/1"[^>]*>Scene One</);
  assert.match(markup, /Merged on StashDB/);
  assert.match(markup, /href="https:\/\/stashdb.org\/scenes\/new"/);
  assert.match(markup, /href="https:\/\/stashdb.org\/scenes\/old"/);
  assert.match(
    markup,
    /<th scope="row">Title<\/th><td[^>]*><span class="text-muted">—<\/span><\/td><td[^>]*>New<\/td>/
  );
  assert.match(markup, /class="text-danger">− Dropped</);
  assert.match(markup, /class="text-success">\+ Rimming</);
});

test("groups render their rows only once opened", () => {
  const markup = render(
    React.createElement(
      StashDBChangesGroup,
      { name: "Studio", count: 2 },
      React.createElement("p", {}, "row")
    )
  );
  assert.match(
    markup,
    /<details[^>]*><summary>Studio <span class="text-muted">\(2\)<\/span><\/summary><\/details>/
  );
});

const change = (
  name: string,
  values: {
    local?: string;
    remote?: string;
    added?: string[];
    removed?: string[];
  }
) => ({
  field: name,
  local: values.local ?? null,
  remote: values.remote ?? null,
  added: values.added ?? [],
  removed: values.removed ?? [],
});

test("only fields with a StashDB value or added entries can be applied", () => {
  assert.equal(
    stashDBApplicableCustom(change("title", { remote: "New" })),
    true
  );
  assert.equal(
    stashDBApplicableCustom(
      change("tags", { added: ["Rimming"], removed: ["Old"] })
    ),
    true
  );
  assert.equal(
    stashDBApplicableCustom(change("tags", { removed: ["Old"] })),
    false,
    "removed entries are never removed automatically"
  );
});

test("skips are what the applied fields still miss locally", () => {
  const left = [
    change("studio", { local: "Studio", remote: "Unknown Studio" }),
    change("performers", { added: ["Nobody"], removed: ["Gone"] }),
    change("tags", { removed: ["Dropped"] }),
    change("director", { remote: "Not applied" }),
    change("urls", { added: ["https://not-applied.com"] }),
  ];
  assert.deepEqual(
    stashDBSkippedCustom(["studio", "performers", "tags", "title"], left),
    ["Unknown Studio", "Nobody"]
  );
  assert.deepEqual(stashDBSkippedCustom(["title"], []), []);
});

const sceneEntry = (
  id: string,
  stashID: string,
  status: string,
  title: string,
  fields: ReturnType<typeof change>[]
) => ({
  __typename: "StashDBSceneChange",
  stash_id: stashID,
  status,
  merged_into_id: null,
  fields: fields.map((f) => ({ __typename: "StashDBFieldChange", ...f })),
  scene: {
    __typename: "Scene",
    id,
    title,
    date: null,
    files: [],
    studio: null,
  },
});

const performerEntry = (id: string, fields: ReturnType<typeof change>[]) => ({
  __typename: "StashDBPerformerChange",
  stash_id: `p${id}`,
  status: "CHANGED",
  merged_into_id: null,
  fields: fields.map((f) => ({ __typename: "StashDBFieldChange", ...f })),
  performer: {
    __typename: "Performer",
    id,
    name: `Vato ${id}`,
    disambiguation: null,
  },
});

test("an apply updates the cached report without a re-check", () => {
  const cache = new InMemoryCache();
  const report = {
    stashDBChangesReport: {
      __typename: "StashDBChangesReport",
      scene_run: null,
      performer_run: null,
      scenes: [
        sceneEntry("1", "a", "CHANGED", "Old", [
          change("title", { local: "Old", remote: "New" }),
          change("tags", { added: ["Nope"], removed: ["Dropped"] }),
        ]),
        sceneEntry("1", "b", "CHANGED", "Old", [
          change("title", { remote: "B" }),
        ]),
        sceneEntry("2", "c", "CHANGED", "Two", [
          change("code", { remote: "X1" }),
        ]),
        sceneEntry("3", "d", "MERGED", "Three", [
          change("date", { remote: "2024" }),
        ]),
      ],
      performers: [
        performerEntry("7", [change("name", { remote: "Papi" })]),
        performerEntry("8", [change("height", { remote: "180" })]),
      ],
    },
  };
  cache.writeQuery({ query: StashDbChangesReportDocument, data: report });
  const read = () =>
    cache.readQuery<StashDbChangesReportQuery>({
      query: StashDbChangesReportDocument,
    })!.stashDBChangesReport;

  // Title applied, an unmatched tag left; the scene title is normalized.
  updateStashDBChangesReportCustom(
    cache,
    sceneEntry("1", "a", "CHANGED", "New", [
      change("tags", { added: ["Nope"], removed: ["Dropped"] }),
    ])
  );
  // Fully applied changed entry drops out; a merged one stays listed.
  updateStashDBChangesReportCustom(
    cache,
    sceneEntry("2", "c", "CHANGED", "Two", [])
  );
  updateStashDBChangesReportCustom(
    cache,
    sceneEntry("3", "d", "MERGED", "Three", [])
  );
  updateStashDBChangesReportCustom(cache, performerEntry("7", []));

  const got = read();
  assert.deepEqual(
    got.scenes.map((e) => [
      e.scene.id,
      e.stash_id,
      e.scene.title,
      e.fields.map((f) => f.field),
    ]),
    [
      ["1", "a", "New", ["tags"]],
      ["1", "b", "New", ["title"]],
      ["3", "d", "Three", []],
    ],
    "only the applied link changes; its scene shows the new title"
  );
  assert.deepEqual(got.scenes[0].fields[0].added, ["Nope"]);
  assert.deepEqual(
    got.performers.map((e) => e.performer.id),
    ["8"]
  );
});

const entryProps = {
  kind: "scene" as const,
  endpoint: "https://stashdb.org/graphql",
  name: "Scene One",
  url: "/scenes/1",
  status: "CHANGED",
  stashID: "a",
  labels: new Map<string, string>(),
};

test("entries offer Use StashDB per applicable field and Use all for several", () => {
  const fields = [
    change("title", { remote: "New" }),
    change("tags", { added: ["Rimming"] }),
    change("performers", { removed: ["Gone"] }),
  ];
  const markup = render(
    React.createElement(StashDBChangesEntry, {
      ...entryProps,
      fields,
      onApply: () => {},
    })
  );
  assert.equal(
    markup.match(/>Use StashDB</g)?.length,
    2,
    "not on removed-only fields"
  );
  assert.match(markup, />Use all</);

  const single = render(
    React.createElement(StashDBChangesEntry, {
      ...entryProps,
      fields: fields.slice(0, 1),
      onApply: () => {},
      applying: true,
    })
  );
  assert.doesNotMatch(single, />Use all</, "one field needs no Use all");
  assert.match(single, /<button[^>]*disabled=""[^>]*>Use StashDB</);

  const readOnly = render(
    React.createElement(StashDBChangesEntry, { ...entryProps, fields })
  );
  assert.doesNotMatch(readOnly, /Use StashDB|Use all/);
});
