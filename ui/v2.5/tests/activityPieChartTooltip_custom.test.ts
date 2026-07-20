import assert from "node:assert/strict";

import {
  formatActivityPieSliceTooltip,
  getActivityPieTooltipPosition,
} from "../src/components/Shared/activityPieChartTooltip_custom.ts";

assert.equal(
  formatActivityPieSliceTooltip({
    label: "Sex",
    percentLabel: "64%",
  }),
  "Sex: 64%",
  "slice tooltips show the footer label and percentage without the duration"
);

assert.equal(
  formatActivityPieSliceTooltip({
    label: "Outstanding",
    percentLabel: "18%",
  }),
  "Outstanding: 18%",
  "slice tooltips fall back to the displayed percentage"
);

assert.equal(
  formatActivityPieSliceTooltip({ label: "Standard" }),
  "Standard",
  "slice tooltips remain useful when no percentage is supplied"
);

assert.deepEqual(
  getActivityPieTooltipPosition(100, 120, 1000, 800),
  { above: false, x: 112, y: 132 },
  "slice tooltips follow the cursor with a small offset"
);

assert.deepEqual(
  getActivityPieTooltipPosition(990, 790, 1000, 800),
  { above: true, x: 792, y: 778 },
  "slice tooltips stay inside the viewport near its right and bottom edges"
);
