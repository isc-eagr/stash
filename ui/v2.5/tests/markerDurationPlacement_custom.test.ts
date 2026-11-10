import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const tagScenes = source(
  "../src/components/Tags/TagDetails/TagScenesPanel.tsx"
);
const tagMarkers = source(
  "../src/components/Tags/TagDetails/TagMarkersPanel.tsx"
);
const markerList = source("../src/components/Scenes/SceneMarkerList.tsx");
const markerQuery = source("../graphql/queries/scene-marker.graphql");

assert.match(
  tagScenes,
  /useTagMarkerDurationQuery/,
  "tag marker duration should load with the tag Scenes tab"
);
assert.match(
  tagScenes,
  /additionalMetadataByline=\{markerDurationByline\}/,
  "tag marker duration should share the existing scene totals byline"
);
assert.doesNotMatch(
  tagMarkers,
  /tag-marker-duration-summary|useTagMarkerDurationQuery/,
  "the tag Markers tab should not retain the removed duration box"
);
assert.match(
  markerQuery,
  /\bduration\s+# CUSTOM:/,
  "the filtered marker query should request its duration aggregate"
);
assert.match(
  markerList,
  /metadataByline=\{metadataByline\}/,
  "the global Markers page should display duration in its pagination byline"
);
