import assert from "node:assert/strict";
import test from "node:test";
import {
  sortColumnExtrasCustom,
  sortFilterByColumnCustom,
} from "../src/components/List/listTableSort_custom.ts";

type FakeFilter = {
  sortBy?: string;
  sortDirection: string;
  setSortBy: (sortBy: string) => FakeFilter;
  toggleSortDirection: () => FakeFilter;
};

const fakeFilter = (sortBy: string, sortDirection: string): FakeFilter => ({
  sortBy,
  sortDirection,
  setSortBy: (next) => fakeFilter(next, sortDirection),
  toggleSortDirection: () =>
    fakeFilter(sortBy, sortDirection === "ASC" ? "DESC" : "ASC"),
});

const sortBy = (filter: FakeFilter, key: string) =>
  sortFilterByColumnCustom(filter as never, key, [
    "title",
  ]) as never as FakeFilter;

test("header click on the active column flips direction", () => {
  const next = sortBy(fakeFilter("duration", "DESC"), "duration");
  assert.equal(next.sortBy, "duration");
  assert.equal(next.sortDirection, "ASC");
});

test("a new column starts ascending for text and descending for metrics", () => {
  assert.equal(
    sortBy(fakeFilter("duration", "DESC"), "title").sortDirection,
    "ASC"
  );
  assert.equal(
    sortBy(fakeFilter("title", "ASC"), "o_counter").sortDirection,
    "DESC"
  );
});

test("only a hidden, non-mandatory active sort column is added", () => {
  const columns = [
    { value: "title", label: "Title", mandatory: true, sortBy: "title" },
    { value: "o_counter", label: "O", sortBy: "o_counter" },
    { value: "tags", label: "Tags" },
  ];
  assert.deepEqual(sortColumnExtrasCustom(columns, ["title"], "o_counter"), [
    "o_counter",
  ]);
  assert.deepEqual(
    sortColumnExtrasCustom(columns, ["title", "o_counter"], "o_counter"),
    []
  );
  assert.deepEqual(sortColumnExtrasCustom(columns, [], "title"), []);
  assert.deepEqual(sortColumnExtrasCustom(columns, [], "random_123"), []);
  assert.deepEqual(sortColumnExtrasCustom(columns, [], undefined), []);
});
