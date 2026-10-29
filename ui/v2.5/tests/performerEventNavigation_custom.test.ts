import assert from "node:assert/strict";
import test from "node:test";
import { ListFilterModel } from "../src/models/list-filter/filter.ts";
import {
  FilterMode,
  type SceneMarkerFilterType,
} from "../src/core/generated-graphql.ts";
import {
  makePerformerFeetMarkersUrl,
  makePerformerOrgasmMarkersUrl,
} from "../src/utils/navigation_custom.ts";

test("Nut and Feet count tiles open the vato's top-role markers including subtags", () => {
  for (const [navigate, tagId, label] of [
    [makePerformerOrgasmMarkersUrl, "10", "Nut"],
    [makePerformerFeetMarkersUrl, "20", "Feet"],
  ] as const) {
    const url = new URL(
      navigate({ id: "42", name: "Beto" }, tagId, label),
      "http://stash"
    );
    assert.equal(url.pathname, "/scenes/markers");
    const filter = new ListFilterModel(FilterMode.SceneMarkers);
    filter.configureFromQueryString(url.search);
    assert.equal(filter.criteria.length, 1);
    const input = filter.makeFilter() as SceneMarkerFilterType;
    const group = input.scene_marker_tags?.groups_extended?.[0];
    assert.ok(group);
    assert.equal(group.depth, -1);
    assert.deepEqual(group.tag_ids, [tagId]);
    assert.deepEqual(group.top_performer_ids, ["42"]);
    assert.deepEqual(group.bottom_performer_ids ?? [], []);
    assert.equal(url.searchParams.get("sortby"), "title");
    assert.equal(navigate({}, tagId, label), "#");
    assert.equal(navigate({ id: "42" }, "", label), "#");
  }
});
