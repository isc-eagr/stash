import assert from "node:assert/strict";

import { getActivityTypePercentagesCustom } from "../src/components/Shared/activityTypePercentages_custom.ts";

assert.deepEqual(
  getActivityTypePercentagesCustom({ sex: 120, oral: 120, solo: 100 }, 200),
  { sex: 60, oral: 60, solo: 50 },
  "overlapping activity types use the classified union as their denominator"
);

assert.deepEqual(
  getActivityTypePercentagesCustom({ sex: 1, oral: 1, solo: 1 }, 3),
  { sex: 33, oral: 33, solo: 33 },
  "activity types round independently instead of forcing a 100 percent sum"
);

assert.deepEqual(
  getActivityTypePercentagesCustom({ sex: 0, oral: 0, solo: 0 }, 0),
  { sex: 0, oral: 0, solo: 0 },
  "empty activity has no displayed percentages"
);
