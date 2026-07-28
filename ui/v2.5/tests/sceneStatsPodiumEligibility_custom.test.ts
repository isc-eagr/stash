import assert from "node:assert/strict";

import { sceneStatsPodiumIncludesScene } from "../src/components/SceneStats/sceneStatsPodiumEligibility_custom.ts";

const oldRelease = {
  is_past_year: true,
  is_release_past_year: false,
};
const recentRelease = {
  is_past_year: false,
  is_release_past_year: true,
};

assert.equal(
  sceneStatsPodiumIncludesScene(oldRelease, "performer_count_past_year"),
  false,
  "recent Vato Count excludes scenes released before the rolling year"
);
assert.equal(
  sceneStatsPodiumIncludesScene(oldRelease, "facial_count_past_year"),
  false,
  "recent Facial Count excludes scenes released before the rolling year"
);
assert.equal(
  sceneStatsPodiumIncludesScene(recentRelease, "performer_count_past_year"),
  true,
  "recent Vato Count includes scenes released within the rolling year"
);
assert.equal(
  sceneStatsPodiumIncludesScene(recentRelease, "facial_count_past_year"),
  true,
  "recent Facial Count includes scenes released within the rolling year"
);
assert.equal(
  sceneStatsPodiumIncludesScene(oldRelease, "rating100_past_year"),
  true,
  "recent Rating continues to use the scene creation date"
);
