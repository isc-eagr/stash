import assert from "node:assert/strict";
import test from "node:test";
import {
  makeSceneStatsActivityMatrix,
  makeSceneStatsActivityMatrixTagURL,
  makeSceneStatsActivityMatrixTreeRows,
} from "../src/components/SceneStats/sceneStatsActivityMatrixData_custom";

test("global activity matrix has only Total and sorts duration descending", () => {
  const matrix = makeSceneStatsActivityMatrix([
    {
      tag_id: "feet",
      tag_name: "Feet",
      parent_tag_ids: [],
      duration: 20,
      marker_count: 3,
      percent: 10,
    },
    {
      tag_id: "body",
      tag_name: "Body",
      parent_tag_ids: [],
      duration: 70,
      marker_count: 2,
      percent: 35,
    },
  ]);

  assert.deepEqual(matrix.columns, []);
  assert.deepEqual(
    matrix.rows.map((row) => row.tag.name),
    ["Body", "Feet"]
  );
  assert.equal(matrix.rows[0].markerCount, 2);
});

test("sub-tag matrix rows expand recursively while retaining each row's totals", () => {
  const matrix = makeSceneStatsActivityMatrix([
    {
      tag_id: "parent",
      tag_name: "Pito",
      parent_tag_ids: [],
      duration: 100,
      marker_count: 10,
      percent: 50,
    },
    {
      tag_id: "child",
      tag_name: "Closeup",
      parent_tag_ids: ["parent"],
      duration: 60,
      marker_count: 6,
      percent: 30,
    },
    {
      tag_id: "grandchild",
      tag_name: "Extreme Closeup",
      parent_tag_ids: ["child"],
      duration: 20,
      marker_count: 2,
      percent: 10,
    },
    {
      tag_id: "root",
      tag_name: "Feet",
      parent_tag_ids: [],
      duration: 50,
      marker_count: 4,
      percent: 25,
    },
  ]);

  const collapsed = makeSceneStatsActivityMatrixTreeRows(
    matrix.rows,
    new Set()
  );
  assert.deepEqual(
    collapsed.map(({ row, depth, hasChildren }) => ({
      id: row.tag.id,
      depth,
      hasChildren,
    })),
    [
      { id: "parent", depth: 0, hasChildren: true },
      { id: "root", depth: 0, hasChildren: false },
    ]
  );

  const expanded = makeSceneStatsActivityMatrixTreeRows(
    matrix.rows,
    new Set(["parent", "child"])
  );
  assert.deepEqual(
    expanded.map(({ row, depth }) => [row.tag.id, depth, row.markerCount]),
    [
      ["parent", 0, 10],
      ["child", 1, 6],
      ["grandchild", 2, 2],
      ["root", 0, 4],
    ]
  );
});

test("studio matrix tag links open the marker tab with the studio scope", () => {
  const url = makeSceneStatsActivityMatrixTagURL(
    { id: "168" },
    { id: "6", name: "Bilatinmen", depth: 0 }
  );
  const parsed = new URL(url, "http://localhost");
  const criterion = JSON.parse(parsed.searchParams.get("c") ?? "{}");

  assert.equal(parsed.pathname, "/tags/168/markers");
  assert.equal(parsed.searchParams.get("sortby"), "title");
  assert.equal(parsed.searchParams.get("includeSubTags"), "false");
  assert.deepEqual(criterion, {
    type: "studios",
    modifier: "INCLUDES",
    value: {
      items: [{ id: "6", label: "Bilatinmen" }],
      excluded: [],
      depth: 0,
    },
  });
});

test("global matrix tag links open the unfiltered marker tab", () => {
  assert.equal(
    makeSceneStatsActivityMatrixTagURL({ id: "168" }),
    "/tags/168/markers?includeSubTags=false&sortby=title"
  );
  assert.equal(
    makeSceneStatsActivityMatrixTagURL({ id: "168" }, undefined, true),
    "/tags/168/markers?includeSubTags=true&sortby=title"
  );
});

test("performer matrix tag links keep the marker evidence scoped to that vato", () => {
  const url = makeSceneStatsActivityMatrixTagURL(
    { id: "168" },
    undefined,
    true,
    { id: "47", name: "El Vato" }
  );
  const parsed = new URL(url, "http://localhost");
  const criterion = JSON.parse(parsed.searchParams.get("c") ?? "{}");

  assert.equal(parsed.pathname, "/tags/168/markers");
  assert.equal(parsed.searchParams.get("includeSubTags"), "true");
  assert.deepEqual(criterion, {
    type: "marker_performers",
    modifier: "EQUALS",
    tag_ids: [],
    include_subtags: false,
    require_overlap: false,
    performer_mode: "OR",
    top_performer_ids: [{ id: "47", label: "El Vato" }],
    bottom_performer_ids: [{ id: "47", label: "El Vato" }],
    unnamed_performers: [],
  });
});
