import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server.js";
import { useStudioFilterHook } from "../src/core/studios.ts";
import { StudiosCriterion } from "../src/models/list-filter/criteria/studios.ts";

function apply(filter, includeChildren) {
  function Harness() {
    const scope = useStudioFilterHook(
      { id: "42", name: "Studio" },
      includeChildren
    );
    scope(filter);
    return null;
  }
  renderToStaticMarkup(React.createElement(Harness));
}

test("studio child toggle replaces saved scope and clears contradictory exclusions", () => {
  const saved = new StudiosCriterion();
  saved.value = {
    items: [{ id: "99", label: "Other" }],
    excluded: [{ id: "42", label: "Studio" }],
    depth: 0,
  };
  const filter = { criteria: [saved] };
  apply(filter, true);
  assert.equal(filter.criteria.length, 1);
  assert.deepEqual(saved.value, {
    items: [{ id: "42", label: "Studio" }],
    excluded: [],
    depth: -1,
  });
  apply(filter, false);
  assert.equal(saved.value.depth, 0);
  assert.equal(saved.modifier, "INCLUDES");
});

test("studio filter adds the same scope when no saved criterion exists", () => {
  const filter = { criteria: [] };
  apply(filter, true);
  assert.deepEqual(filter.criteria[0].value, {
    items: [{ id: "42", label: "Studio" }],
    excluded: [],
    depth: -1,
  });
});
