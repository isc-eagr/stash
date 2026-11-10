import assert from "node:assert/strict";

import {
  formatStatsDrilldownTotal,
  formatStatsTotal,
} from "../src/utils/statsDrilldown_custom.ts";

assert.equal(formatStatsTotal(0, "scene", "scenes"), "Total: 0 scenes");
assert.equal(formatStatsTotal(1, "O event", "O events"), "Total: 1 O event");
assert.equal(
  formatStatsDrilldownTotal(12, 80, "vato", "vatos"),
  "Drilldown total: 12 vatos · Overall: 80"
);
