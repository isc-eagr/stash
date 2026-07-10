import assert from "node:assert/strict";

import { makeStudioOStatsUrl } from "../src/utils/oStatsNavigation_custom.ts";

assert.equal(makeStudioOStatsUrl("42"), "/ostats/studio/42");
assert.equal(makeStudioOStatsUrl("studio/id"), "/ostats/studio/studio%2Fid");
