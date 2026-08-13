import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const insightsSource = readFileSync(
  new URL(
    "../src/components/Scenes/SceneCardInsights_custom.tsx",
    import.meta.url
  ),
  "utf8"
);

assert.match(
  insightsSource,
  /React\.forwardRef/,
  "scene insight chips should forward refs for OverlayTrigger"
);
assert.match(
  insightsSource,
  /\{\.\.\.triggerProps\}/,
  "scene insight chips should preserve OverlayTrigger event props"
);
assert.match(
  insightsSource,
  /ref=\{ref\}/,
  "scene insight chips should attach the OverlayTrigger ref"
);
