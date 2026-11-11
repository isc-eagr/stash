import assert from "node:assert/strict";
import test from "node:test";
import { sceneReleaseEditInputCustom } from "../src/components/Scenes/SceneDetails/sceneReleaseEditInput_custom.ts";

test("release edit input maps every release-owned field", () => {
  const stashIDs = [
    {
      endpoint: "https://stashdb.org/graphql",
      stash_id: "abc",
      updated_at: "2024-01-01T00:00:00Z",
    },
  ];
  assert.deepEqual(
    sceneReleaseEditInputCustom("7", {
      title: "Alt",
      code: "ALT-1",
      details: "notes",
      director: "Dir",
      urls: ["https://example.com/a"],
      date: "2021-02-03",
      studio_id: "4",
      performer_ids: ["1", "2"],
      tag_ids: ["3"],
      groups: [{ group_id: "5", scene_index: 2 }],
      gallery_ids: ["9"],
      stash_ids: stashIDs,
      custom_fields: { full: { source: "scraped" } },
      cover_image: "data:image/png;base64,AAAA",
      stashdb_matches: 3,
    }),
    {
      id: "7",
      title: "Alt",
      code: "ALT-1",
      details: "notes",
      director: "Dir",
      urls: ["https://example.com/a"],
      date: "2021-02-03",
      studio_id: "4",
      performer_ids: ["1", "2"],
      tag_ids: ["3"],
      groups: [{ group_id: "5", scene_index: 2 }],
      gallery_ids: ["9"],
      stash_ids: stashIDs,
      custom_fields: { full: { source: "scraped" } },
      cover_image: "data:image/png;base64,AAAA",
      stashdb_matches: 3,
    }
  );
});

test("release edit input never sends ratings, organized, or production date", () => {
  assert.deepEqual(
    sceneReleaseEditInputCustom("7", {
      title: "Alt",
      rating100: 80,
      organized: true,
      production_date: "2020-01-01",
    }),
    { id: "7", title: "Alt" }
  );
});

test("release edit input sends only the fields present", () => {
  assert.deepEqual(sceneReleaseEditInputCustom("7", { tag_ids: [] }), {
    id: "7",
    tag_ids: [],
  });
  assert.deepEqual(sceneReleaseEditInputCustom("7", {}), { id: "7" });
});

test("release edit input clears date, studio, and cover with explicit null", () => {
  assert.deepEqual(
    sceneReleaseEditInputCustom("7", {
      date: null,
      studio_id: null,
      cover_image: null,
    }),
    { id: "7", date: null, studio_id: null, cover_image: null }
  );
  assert.deepEqual(
    sceneReleaseEditInputCustom("7", { date: "", studio_id: "" }),
    { id: "7", date: null, studio_id: null }
  );
});

test("release edit input keeps a cleared StashDB Matches count and zero", () => {
  assert.deepEqual(
    sceneReleaseEditInputCustom("7", { stash_ids: [], stashdb_matches: null }),
    { id: "7", stash_ids: [], stashdb_matches: null }
  );
  assert.deepEqual(sceneReleaseEditInputCustom("7", { stashdb_matches: 0 }), {
    id: "7",
    stashdb_matches: 0,
  });
});
