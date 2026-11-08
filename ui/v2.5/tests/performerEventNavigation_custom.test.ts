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
  makePerformerTopMarkersWithTagsUrlCustom,
  makeTopMarkersWithTagsUrlCustom,
} from "../src/utils/navigation_custom.ts";
import { nutTypeMarkerTagsCustom } from "../src/components/Performers/PerformerDetails/nutTypes_custom.ts";

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

test("Nut tile pips open his top markers with the quality tag and without the excluded tags", () => {
  const url = new URL(
    makePerformerTopMarkersWithTagsUrlCustom(
      { id: "42", name: "Beto" },
      [
        { id: "10", label: "Nut" },
        { id: "60", label: "Really Hot" },
      ],
      [
        { id: "30", label: "Facial" },
        { id: "50", label: "GOAT" },
      ]
    ),
    "http://stash"
  );
  assert.equal(url.pathname, "/scenes/markers");
  const filter = new ListFilterModel(FilterMode.SceneMarkers);
  filter.configureFromQueryString(url.search);
  const input = filter.makeFilter() as SceneMarkerFilterType;
  const group = input.scene_marker_tags?.groups_extended?.[0] as
    | (NonNullable<
        NonNullable<
          SceneMarkerFilterType["scene_marker_tags"]
        >["groups_extended"]
      >[number] & { exclude_tag_ids_on_marker?: string[] })
    | undefined;
  assert.ok(group);
  assert.equal(group.depth, -1);
  assert.deepEqual(group.tag_ids, ["10", "60"]);
  assert.deepEqual(group.top_performer_ids, ["42"]);
  assert.deepEqual(group.exclude_tag_ids_on_marker, ["30", "50"]);
  assert.equal(group.own_tags_only, true, "the list matches the pip count");
  assert.equal(
    makePerformerTopMarkersWithTagsUrlCustom({}, [{ id: "10", label: "Nut" }]),
    "#"
  );
});

test("Nut tile pip tags: nuts leave out facials, Really Hot leaves out GOAT, plain leaves out both", () => {
  const roleTagIds = {
    orgasmTagId: "10",
    facialTagId: "30",
    goatTagId: "50",
    reallyHotTagId: "60",
    secondCameraTagId: "70",
  };
  const ids = (tags?: Array<{ id: string }>) => tags?.map((t) => t.id);
  const hotNut = nutTypeMarkerTagsCustom("nut", "really_hot", roleTagIds);
  assert.deepEqual(ids(hotNut?.tags), ["10", "60"]);
  assert.deepEqual(ids(hotNut?.excludeTags), ["30", "50", "70"]);
  const plainFacial = nutTypeMarkerTagsCustom("facial", "plain", roleTagIds);
  assert.deepEqual(ids(plainFacial?.tags), ["30"]);
  assert.deepEqual(ids(plainFacial?.excludeTags), ["60", "50", "70"]);
  assert.equal(
    nutTypeMarkerTagsCustom("nut", "goat", { orgasmTagId: "10" }),
    undefined,
    "an unconfigured quality tag has no link"
  );
});

test("Studio Nut tile pips open markers with the tags and any vato", () => {
  const url = new URL(
    makeTopMarkersWithTagsUrlCustom([], [{ id: "10", label: "Nut" }]),
    "http://stash"
  );
  const filter = new ListFilterModel(FilterMode.SceneMarkers);
  filter.configureFromQueryString(url.search);
  const input = filter.makeFilter() as SceneMarkerFilterType;
  const group = input.scene_marker_tags?.groups_extended?.[0];
  assert.ok(group);
  assert.deepEqual(group.tag_ids, ["10"]);
  assert.deepEqual(group.top_performer_ids ?? [], []);
  assert.equal(group.own_tags_only, true);
  assert.equal(makeTopMarkersWithTagsUrlCustom([], []), "#");
});
