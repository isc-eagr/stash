import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowPerformerRolePartnerDuration } from "../src/components/Performers/performerRolePartnerLabels_custom.ts";

test("partner duration is shown for sex and oral roles only", () => {
  assert.equal(shouldShowPerformerRolePartnerDuration("sex"), true);
  assert.equal(shouldShowPerformerRolePartnerDuration("oral"), true);
  assert.equal(shouldShowPerformerRolePartnerDuration("facial"), false);
});
