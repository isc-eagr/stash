import assert from "node:assert/strict";
import test from "node:test";
import {
  CATALOG_CARD_SORT_HIGHLIGHT_CLASS_CUSTOM,
  catalogCardSortHighlightClassCustom,
  hasCatalogCardSortValueCustom,
  isCatalogCardSortHighlightedCustom,
} from "../src/components/Shared/catalogCardSortHighlight_custom.ts";

test("matching card metrics use the shared emerald highlight", () => {
  assert.equal(isCatalogCardSortHighlightedCustom("rating", "rating"), true);
  assert.equal(
    catalogCardSortHighlightClassCustom("o_counter", "o_counter"),
    CATALOG_CARD_SORT_HIGHLIGHT_CLASS_CUSTOM
  );
  assert.equal(
    isCatalogCardSortHighlightedCustom("performer_count", "tag_count"),
    false
  );
});

test("random sorts never highlight an existing card metric", () => {
  assert.equal(
    catalogCardSortHighlightClassCustom("random", "rating"),
    undefined
  );
  assert.equal(
    catalogCardSortHighlightClassCustom("random_42", "rating"),
    undefined
  );
});

test("zero remains eligible as a visible sorted value", () => {
  assert.equal(hasCatalogCardSortValueCustom(0), true);
  assert.equal(hasCatalogCardSortValueCustom(""), false);
  assert.equal(hasCatalogCardSortValueCustom(null), false);
  assert.equal(hasCatalogCardSortValueCustom(undefined), false);
});
