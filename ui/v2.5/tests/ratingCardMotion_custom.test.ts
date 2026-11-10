import assert from "node:assert/strict";

import { isPremiumRatingCardMotionTargetCustom } from "../src/utils/ratingCardMotion_custom.ts";

assert.equal(
  isPremiumRatingCardMotionTargetCustom(
    "card scene-card rating-card-theme-premium rating-5-stars"
  ),
  true
);
assert.equal(
  isPremiumRatingCardMotionTargetCustom(
    "performer-card rating-card-theme-premium rating-royal-sapphire"
  ),
  true
);
assert.equal(
  isPremiumRatingCardMotionTargetCustom(
    "scene-card rating-card-theme-classic rating-5-stars"
  ),
  false,
  "classic cards keep their separate motion treatment"
);
assert.equal(
  isPremiumRatingCardMotionTargetCustom("scene-card rating-card-theme-premium"),
  false,
  "plain premium cards do not need an animation observer"
);
