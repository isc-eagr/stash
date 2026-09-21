import assert from "node:assert/strict";

import { getActivityTypePercentagesCustom } from "../src/components/Shared/activityTypePercentages_custom.ts";

assert.deepEqual(
  getActivityTypePercentagesCustom({ sex: 120, oral: 120, solo: 100 }),
  { sex: 35, oral: 35, solo: 30 },
  "classified activity ignores unmarked runtime and rounds to exactly 100 percent"
);

assert.deepEqual(
  getActivityTypePercentagesCustom({ sex: 1, oral: 1, solo: 1 }),
  { sex: 34, oral: 33, solo: 33 },
  "equal thirds use a stable largest-remainder allocation"
);

assert.deepEqual(
  getActivityTypePercentagesCustom({ sex: 0, oral: 0, solo: 0 }),
  { sex: 0, oral: 0, solo: 0 },
  "empty activity has no displayed percentages"
);
