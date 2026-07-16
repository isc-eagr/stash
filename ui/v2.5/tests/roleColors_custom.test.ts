import assert from "node:assert/strict";

import { ROLE_COLORS_CUSTOM } from "../src/utils/roleColors_custom.ts";

assert.deepEqual(ROLE_COLORS_CUSTOM.top, {
  color: "#17a2b8",
  variant: "info",
  outlineVariant: "outline-info",
});
assert.deepEqual(ROLE_COLORS_CUSTOM.bottom, {
  color: "#28a745",
  variant: "success",
  outlineVariant: "outline-success",
});
