import assert from "node:assert/strict";
import test from "node:test";

import {
  FilterMode,
  SortDirectionEnum,
} from "../src/core/generated-graphql.ts";
import { getDefaultFilterForListLocationCustom } from "../src/components/List/defaultFilterUrl_custom.ts";
import { ListFilterModel } from "../src/models/list-filter/filter.ts";

test("a zoom-only scenes menu URL overlays the saved default filter", () => {
  const savedDefault = new ListFilterModel(FilterMode.Scenes, undefined, {
    defaultSortBy: "rating",
    defaultSortDir: SortDirectionEnum.Desc,
  });
  savedDefault.searchTerm = "saved search";

  const result = getDefaultFilterForListLocationCustom(savedDefault, "?z=2");

  assert.ok(result);
  assert.notEqual(result, savedDefault);
  assert.equal(result.sortBy, "rating");
  assert.equal(result.sortDirection, SortDirectionEnum.Desc);
  assert.equal(result.searchTerm, "saved search");
  assert.equal(result.zoomIndex, 2);
});

test("real URL filter parameters take precedence over the saved default", () => {
  const savedDefault = new ListFilterModel(FilterMode.Scenes, undefined, {
    defaultSortBy: "rating",
    defaultSortDir: SortDirectionEnum.Desc,
  });

  assert.equal(
    getDefaultFilterForListLocationCustom(
      savedDefault,
      "?sortby=date&sortdir=asc&z=2"
    ),
    undefined
  );
});

test("presentation-only parameters preserve the model's existing sort", () => {
  const filter = new ListFilterModel(FilterMode.Scenes, undefined, {
    defaultSortBy: "rating",
    defaultSortDir: SortDirectionEnum.Desc,
  });

  filter.configureFromQueryString("?z=2");

  assert.equal(filter.sortBy, "rating");
  assert.equal(filter.sortDirection, SortDirectionEnum.Desc);
  assert.equal(filter.zoomIndex, 2);
});
