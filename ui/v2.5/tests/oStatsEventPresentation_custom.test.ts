import assert from "node:assert/strict";

import {
  formatSceneOOrdinalLabelCustom,
  shouldShowSceneOOrdinalChipCustom,
} from "../src/components/OStats/oStatsEventPresentation_custom.ts";

assert.equal(formatSceneOOrdinalLabelCustom(1), "1st O");
assert.equal(formatSceneOOrdinalLabelCustom(2), "2nd O");
assert.equal(formatSceneOOrdinalLabelCustom(3), "3rd O");
assert.equal(formatSceneOOrdinalLabelCustom(4), "4th O");
assert.equal(formatSceneOOrdinalLabelCustom(11), "11th O");
assert.equal(formatSceneOOrdinalLabelCustom(12), "12th O");
assert.equal(formatSceneOOrdinalLabelCustom(13), "13th O");
assert.equal(formatSceneOOrdinalLabelCustom(21), "21st O");
assert.equal(shouldShowSceneOOrdinalChipCustom(true), false);
assert.equal(shouldShowSceneOOrdinalChipCustom(false), true);
