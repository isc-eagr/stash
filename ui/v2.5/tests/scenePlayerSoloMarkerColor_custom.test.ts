import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const markerPluginSource = readFileSync(
  new URL("../src/components/ScenePlayer/markers.ts", import.meta.url),
  "utf8"
);
const scenePlayerSource = readFileSync(
  new URL("../src/components/ScenePlayer/ScenePlayer.tsx", import.meta.url),
  "utf8"
);
const multiVideoViewerSource = readFileSync(
  new URL("../src/components/Scenes/MultiVideoViewer.tsx", import.meta.url),
  "utf8"
);
const paletteSource = readFileSync(
  new URL(
    "../src/components/Shared/ActivityPieChart_custom.tsx",
    import.meta.url
  ),
  "utf8"
);

test("scene scrubber colors configured solo markers with the shared jerk color", () => {
  assert.match(paletteSource, /solo:\s*"#a855f7"/);
  assert.match(
    markerPluginSource,
    /findColors\(tagNames: string\[\], soloTagNames: string\[\] = \[\]\)/
  );
  assert.match(
    markerPluginSource,
    /soloTagNames\.includes\(tag\)[\s\S]*?ACTIVITY_PIE_COLORS\.solo/
  );
  assert.match(scenePlayerSource, /marker\.primaryTag\.id === soloTagId/);
  assert.match(
    scenePlayerSource,
    /markers\.findColors\(uniqueTagNames, soloTagNames\)/
  );
  assert.match(multiVideoViewerSource, /marker\.primaryTag\.id === soloTagId/);
  assert.match(
    multiVideoViewerSource,
    /markers\.findColors\(uniqueTagNames, soloTagNames\)/
  );
});
