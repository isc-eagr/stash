import assert from "node:assert/strict";

import { ROLE_COLORS_CUSTOM } from "../src/utils/roleColors_custom.ts";

assert.deepEqual(ROLE_COLORS_CUSTOM.top, {
  color: "var(--semantic-top)",
  variant: "role-top",
  outlineVariant: "outline-role-top",
});
assert.deepEqual(ROLE_COLORS_CUSTOM.bottom, {
  color: "var(--semantic-bottom)",
  variant: "role-bottom",
  outlineVariant: "outline-role-bottom",
});
