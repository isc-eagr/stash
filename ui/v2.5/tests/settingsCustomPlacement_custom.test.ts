import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const settingsSource = readFileSync(
  new URL("../src/components/Settings/Settings.tsx", import.meta.url),
  "utf8"
);
const customPanelSource = readFileSync(
  new URL(
    "../src/components/Settings/SettingsCustomPanel.tsx",
    import.meta.url
  ),
  "utf8"
);

const aboutLink = settingsSource.indexOf('to="/settings?tab=about"');
const customLink = settingsSource.indexOf('to="/settings?tab=custom"');

assert.ok(aboutLink >= 0, "the Settings navigation should include About");
assert.ok(customLink >= 0, "the Settings navigation should include Custom");
assert.ok(
  customLink > aboutLink,
  "the Custom Settings navigation item should be below About"
);
assert.match(
  customPanelSource,
  /SceneCardInsightChip[\s\S]*Lots of filler/,
  "Scene Card Insight settings should show painted example chips"
);
