import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tagMarkerIncludeSubTagsFromSearch } from "../src/components/Tags/TagDetails/tagMarkerNavigation_custom";

const tagMarkersPanelSource = readFileSync(
  new URL(
    "../src/components/Tags/TagDetails/TagMarkersPanel.tsx",
    import.meta.url
  ),
  "utf8"
);

test("matrix tag links explicitly restore direct or sub-tag mode", () => {
  assert.equal(tagMarkerIncludeSubTagsFromSearch("?includeSubTags=true"), true);
  assert.equal(
    tagMarkerIncludeSubTagsFromSearch("?includeSubTags=false"),
    false
  );
  assert.equal(tagMarkerIncludeSubTagsFromSearch("?sortby=title"), undefined);
});

test("ordinary Tag Markers navigation does not invoke overlap-aware matching", () => {
  assert.match(
    tagMarkersPanelSource,
    /tagCriterion\.modifier = GQL\.CriterionModifier\.Includes;/
  );
  assert.doesNotMatch(
    tagMarkersPanelSource,
    /tagCriterion\.modifier = GQL\.CriterionModifier\.IncludesAll;/
  );
});
