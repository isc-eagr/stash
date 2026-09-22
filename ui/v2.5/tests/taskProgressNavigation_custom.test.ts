import assert from "node:assert/strict";
import test from "node:test";
import {
  taskProgressFilterFromSearch,
  taskProgressSearchForFilter,
} from "../src/components/TaskProgress/taskProgressNavigation_custom";

test("Task Progress restores the tracker status from the URL", () => {
  assert.equal(taskProgressFilterFromSearch("?status=COMPLETED"), "COMPLETED");
  assert.equal(taskProgressFilterFromSearch("?status=unknown"), "CURRENT");
  assert.equal(taskProgressFilterFromSearch(""), "CURRENT");
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
