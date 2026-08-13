import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sceneCardSource = readFileSync(
  new URL("../src/components/Scenes/SceneCard.tsx", import.meta.url),
  "utf8"
);

assert.doesNotMatch(
  sceneCardSource,
  /scene-card__description|text=\{props\.scene\.details\}/,
  "scene cards leave descriptions to the scene detail page"
);
