import assert from "node:assert/strict";

import {
  makeOStatsPerformerUrl,
  makeOStatsSceneEventUrl,
  makePerformerOStatsUrl,
  makeSceneOStatsUrl,
  makeStudioOStatsUrl,
} from "../src/utils/oStatsNavigation_custom.ts";

assert.equal(makeStudioOStatsUrl("42"), "/ostats/studio/42");
assert.equal(makeStudioOStatsUrl("studio/id"), "/ostats/studio/studio%2Fid");
assert.equal(makeSceneOStatsUrl("42"), "/ostats/scene/42");
assert.equal(makeSceneOStatsUrl("scene/id"), "/ostats/scene/scene%2Fid");
assert.equal(makePerformerOStatsUrl("7"), "/ostats/vato/7");
assert.equal(makePerformerOStatsUrl("vato/id"), "/ostats/vato/vato%2Fid");

assert.equal(makeOStatsSceneEventUrl("42", 65.9, false), "/ostats/scene/42");
assert.equal(makeOStatsSceneEventUrl("42", 65.9, true), "/scenes/42?t=65");
assert.equal(makeOStatsSceneEventUrl("42", null, true), "/scenes/42");
assert.equal(makeOStatsPerformerUrl("7", false), "/ostats/vato/7");
assert.equal(makeOStatsPerformerUrl("7", true), "/performers/7");
