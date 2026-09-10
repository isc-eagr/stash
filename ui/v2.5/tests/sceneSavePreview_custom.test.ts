import assert from "node:assert/strict";
import React from "react";
import ReactDOMServer from "react-dom/server.js";
import {
  ApolloClient,
  ApolloLink,
  ApolloProvider,
  InMemoryCache,
} from "@apollo/client";
import {
  buildSceneSaveInput,
  getSceneSaveChanges,
} from "../src/components/Tagger/scenes/sceneSavePreview_custom.ts";
import { SceneSavePreview } from "../src/components/Tagger/scenes/SceneSavePreview.tsx";

const local = {
  id: "1",
  title: "Local title",
  details: "Keep my notes",
  code: "old-code",
  date: "2020-01-01",
  director: null,
  organized: false,
  studio: { id: "s1", name: "Local studio" },
  performers: [{ id: "p1", name: "Local performer" }],
  tags: [{ id: "t1", name: "Local tag" }],
  urls: ["https://example.com/local"],
  stash_ids: [
    {
      endpoint: "https://stashdb.org/graphql",
      stash_id: "old",
      updated_at: "2020-01-01",
    },
    {
      endpoint: "https://other.example/graphql",
      stash_id: "keep",
      updated_at: "2020-01-01",
    },
  ],
  paths: { screenshot: "/current.jpg" },
};
const options = {
  local,
  remote: {
    title: "Remote title",
    details: null,
    date: undefined,
    code: "",
    director: "New director",
    urls: [local.urls[0], "https://example.com/new"],
    remote_site_id: "new",
  },
  excluded: {},
  performerIDs: ["p1", "p2", undefined],
  studioID: "s2",
  tagIDs: ["t2"],
  endpoint: "https://stashdb.org/graphql",
  organized: true,
};
const input = buildSceneSaveInput(options);
assert.equal(input.title, "Remote title");
assert.equal(
  input.details,
  local.details,
  "null remote metadata never clears local values"
);
assert.equal(
  input.date,
  local.date,
  "missing remote metadata preserves local values"
);
assert.equal(
  input.code,
  "",
  "explicit empty strings follow existing Save semantics"
);
assert.deepEqual(
  input.performer_ids,
  ["p1", "p2"],
  "merge performers, deduplicate and omit unresolved matches"
);
assert.deepEqual(input.urls, [local.urls[0], "https://example.com/new"]);
assert.deepEqual(
  input.tag_ids,
  ["t2"],
  "overwrite selections can remove local tags"
);
assert.equal(input.studio_id, "s2");
assert.equal(input.organized, true);
assert.deepEqual(
  input.stash_ids?.map((s) => s.stash_id),
  ["keep", "new"],
  "replace only this source's ID"
);

const changes = getSceneSaveChanges(local, input);
assert.equal(changes.find((c) => c.key === "title")?.status, "Changed");
assert.equal(changes.find((c) => c.key === "code")?.status, "Removed");
assert.equal(changes.find((c) => c.key === "director")?.status, "Added");
assert.equal(changes.find((c) => c.key === "details")?.status, "Unchanged");
assert.equal(changes.find((c) => c.key === "organized")?.status, "Changed");
assert.deepEqual(changes.find((c) => c.key === "tags")?.before, ["t1"]);
assert.deepEqual(changes.find((c) => c.key === "tags")?.after, ["t2"]);

const excluded = buildSceneSaveInput({
  ...options,
  organized: false,
  excluded: {
    title: true,
    director: true,
    code: true,
    url: true,
    stash_ids: true,
  },
});
assert.equal(excluded.title, local.title);
assert.equal(excluded.director, local.director);
assert.equal(excluded.code, local.code);
assert.deepEqual(excluded.urls, local.urls);
assert.equal(
  excluded.stash_ids,
  undefined,
  "excluded Stash IDs are omitted from the mutation"
);
assert.equal(
  excluded.organized,
  undefined,
  "disabled organization does not clear the local flag"
);
assert.equal(
  buildSceneSaveInput({ ...options, endpoint: undefined }).stash_ids,
  undefined
);
assert.deepEqual(
  buildSceneSaveInput({ ...options, tagIDs: ["t1", "t2"] }).tag_ids,
  ["t1", "t2"],
  "merge selection keeps local tags"
);
assert.deepEqual(
  buildSceneSaveInput({ ...options, tagIDs: [] }).tag_ids,
  [],
  "clearing the tag selector is previewed as removal"
);

const unchanged = getSceneSaveChanges(local, {
  id: local.id,
  stash_ids: [...local.stash_ids]
    .reverse()
    .map((s) => ({ ...s, updated_at: "2026-09-09" })),
});
assert.ok(
  unchanged.every((c) => c.status === "Unchanged"),
  "list order and Stash ID refresh timestamps are not metadata differences"
);
assert.equal(
  getSceneSaveChanges({ ...local, organized: true }, { id: local.id }).find(
    (c) => c.key === "organized"
  )?.status,
  "Unchanged"
);

const informative = getSceneSaveChanges(local, input, options.remote);
for (const key of ["details", "date"]) {
  const change = informative.find((c) => c.key === key);
  assert.equal(change?.status, "Kept locally");
  assert.equal(change?.remoteMissingField, key);
  assert.deepEqual(
    change?.before,
    change?.after,
    "informational rows preserve the value on Save"
  );
}
assert.equal(
  informative.find((c) => c.key === "director")?.remoteMissingField,
  undefined
);
const cleared = buildSceneSaveInput({
  ...options,
  clearMissingFields: { details: true, date: true },
});
assert.equal(
  cleared.details,
  null,
  "explicit clear sends null in the mutation"
);
assert.equal(
  cleared.date,
  null,
  "explicit date clear sends null, not an omitted property"
);
assert.equal(JSON.parse(JSON.stringify(cleared)).date, null);
const removal = getSceneSaveChanges(local, cleared, options.remote).find(
  (c) => c.key === "details"
);
assert.equal(removal?.status, "Removed");
assert.equal(
  removal?.remoteMissingField,
  "details",
  "checkbox remains available to undo clearing"
);
assert.deepEqual(removal?.after, []);
assert.equal(
  buildSceneSaveInput({ ...options, clearMissingFields: { details: false } })
    .details,
  local.details,
  "unchecking restores local data"
);
assert.equal(
  buildSceneSaveInput({
    ...options,
    excluded: { details: true },
    clearMissingFields: { details: true },
  }).details,
  local.details,
  "excluded fields cannot be cleared"
);
assert.equal(
  buildSceneSaveInput({ ...options, clearMissingFields: { title: true } })
    .title,
  options.remote.title,
  "a stale clear selection cannot erase an incoming value"
);
assert.equal(
  getSceneSaveChanges(
    { ...local, details: null },
    { id: local.id },
    options.remote
  ).find((c) => c.key === "details")?.status,
  "Unchanged",
  "both empty is not an informational difference"
);
for (const key of ["title", "details", "date", "code", "director"]) {
  const scenario = {
    ...options,
    local: { ...local, [key]: "local value" },
    remote: { ...options.remote, [key]: null },
  };
  assert.equal(buildSceneSaveInput(scenario)[key], "local value");
  assert.equal(
    buildSceneSaveInput({ ...scenario, clearMissingFields: { [key]: true } })[
      key
    ],
    null
  );
}

function render(previewInput, cover, remote = local, excludedFields = {}) {
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
    ssrMode: true,
  });
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(
      ApolloProvider,
      { client },
      React.createElement(SceneSavePreview, {
        local,
        input: previewInput,
        remote,
        excluded: excludedFields,
        onClearField: () => {},
        cover,
        unresolved: 1,
      })
    )
  );
}
const markup = render(input, "/remote.jpg");
assert.match(markup, /Local now/);
assert.match(markup, /After Save/);
assert.match(markup, /Local title/);
assert.match(markup, /Remote title/);
assert.match(markup, /Local tag/);
assert.match(markup, /tagger-value-before/);
assert.match(markup, /tagger-value-after/);
assert.match(markup, /<details/);
assert.match(markup, /1 unmatched performer omitted/);
assert.match(markup, /current.jpg/);
assert.match(markup, /remote.jpg/);
const noChanges = render({ id: local.id }, undefined);
assert.match(noChanges, /No metadata changes/);
assert.doesNotMatch(noChanges, /Cover replacement/);
const keptMarkup = render(input, undefined, options.remote);
assert.match(keptMarkup, /Kept locally/);
assert.match(keptMarkup, /Remote empty/);
assert.match(keptMarkup, /9 changes · 2 kept locally/);
assert.match(keptMarkup, /aria-label="Clear Details on Save"/);
assert.doesNotMatch(keptMarkup, /checked=""/);
assert.ok(
  keptMarkup.indexOf("Keep my notes") < keptMarkup.indexOf("<details"),
  "remote-empty values stay in the main comparison"
);
const clearMarkup = render(cleared, undefined, options.remote);
assert.match(clearMarkup, /checked=""/);
assert.match(clearMarkup, /11 changes/);
const excludedMarkup = render(input, undefined, options.remote, {
  details: true,
});
assert.match(excludedMarkup, /disabled=""/);
assert.match(excludedMarkup, /Field excluded/);
console.log("Scene Save preview tests passed.");
