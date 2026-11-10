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
  /SceneCardInsightChip/,
  "Scene Card Insight settings should retain painted example chips"
);
assert.doesNotMatch(
  customPanelSource,
  /fillerTotalPercent|Lots of filler|scene-card-insights-filler-total/,
  "the retired Lots of filler setting should not be exposed"
);
assert.doesNotMatch(
  customPanelSource,
  /leaningBalanceTolerancePercent|leaningMinority(?:Some|GoodAmount|ALot)Percent/,
  "Custom Settings should not expose obsolete sex/oral wording thresholds"
);
