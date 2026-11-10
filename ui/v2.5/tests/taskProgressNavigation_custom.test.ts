import assert from "node:assert/strict";
import test from "node:test";
import {
  taskProgressFilterFromSearch,
  taskProgressSearchForFilter,
  taskProgressSortFromSearch,
  taskProgressSearchForSort,
} from "../src/components/TaskProgress/taskProgressNavigation_custom";

test("Task Progress restores the tracker status from the URL", () => {
  assert.equal(taskProgressFilterFromSearch("?status=COMPLETED"), "COMPLETED");
  assert.equal(taskProgressFilterFromSearch("?status=unknown"), "CURRENT");
  assert.equal(taskProgressFilterFromSearch(""), "CURRENT");
});

test("Task Progress restores valid percentage sorts and defaults to manual order", () => {
  assert.equal(
    taskProgressSortFromSearch("?sort=progress_desc"),
    "progress_desc"
  );
  assert.equal(
    taskProgressSortFromSearch("?sort=progress_asc"),
    "progress_asc"
  );
  assert.equal(taskProgressSortFromSearch("?sort=unknown"), "manual");
  assert.equal(taskProgressSortFromSearch(""), "manual");
});

test("sorting and status filters preserve each other and unrelated URL parameters", () => {
  const sorted = taskProgressSearchForSort(
    "?status=COMPLETED&existing=value",
    "progress_desc"
  );
  const parameters = new URLSearchParams(sorted);
  assert.equal(parameters.get("status"), "COMPLETED");
  assert.equal(parameters.get("existing"), "value");
  assert.equal(parameters.get("sort"), "progress_desc");
  const filtered = taskProgressSearchForFilter(sorted, "ACTIVE");
  assert.equal(taskProgressSortFromSearch(filtered), "progress_desc");
  assert.equal(taskProgressFilterFromSearch(filtered), "ACTIVE");
  assert.equal(
    taskProgressSearchForSort(filtered, "manual"),
    "?status=ACTIVE&existing=value"
  );
  assert.equal(taskProgressSearchForSort("?sort=progress_asc", "unknown"), "");
});

test("Task Progress status URLs preserve unrelated query parameters", () => {
  const completed = taskProgressSearchForFilter("?existing=value", "COMPLETED");
  const parameters = new URLSearchParams(completed);
  assert.equal(parameters.get("existing"), "value");
  assert.equal(parameters.get("status"), "COMPLETED");

  assert.equal(
    taskProgressSearchForFilter(completed, "CURRENT"),
    "?existing=value"
  );
});
