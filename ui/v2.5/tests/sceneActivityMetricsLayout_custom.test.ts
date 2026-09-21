import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const cardSource = readFileSync(
  new URL("../src/components/Scenes/SceneCard.tsx", import.meta.url),
  "utf8"
);
const detailSource = readFileSync(
  new URL("../src/components/Scenes/SceneDetails/Scene.tsx", import.meta.url),
  "utf8"
);
const sceneStatsSource = readFileSync(
  new URL(
    "../src/components/Scenes/SceneDetails/SceneStatsPanel.tsx",
    import.meta.url
  ),
  "utf8"
);
const aggregateStatsSource = readFileSync(
  new URL(
    "../src/components/Shared/ActivityStatsCharts_custom.tsx",
    import.meta.url
  ),
  "utf8"
);
const paletteSource = readFileSync(
  new URL(
    "../src/components/Shared/ActivityPieChart_custom.tsx",
    import.meta.url
  ),
  "utf8"
);
const sceneStatsPanelSource = readFileSync(
  new URL(
    "../src/components/Scenes/SceneDetails/SceneStatsPanel.tsx",
    import.meta.url
  ),
  "utf8"
);
const performerStatsSource = readFileSync(
  new URL(
    "../src/components/Performers/PerformerDetails/PerformerStatsPanel.tsx",
    import.meta.url
  ),
  "utf8"
);
const metricsSource = readFileSync(
  new URL(
    "../src/components/Scenes/SceneActivityMetrics_custom.tsx",
    import.meta.url
  ),
  "utf8"
);
const stylesSource = readFileSync(
  new URL("../src/components/Scenes/styles.scss", import.meta.url),
  "utf8"
);
const activityCopyStyles = stylesSource.slice(
  stylesSource.indexOf(".scene-activity-metric__copy {"),
  stylesSource.lastIndexOf(".scene-activity-metric__svg {")
);
const ratingStylesSource = readFileSync(
  new URL(
    "../src/components/Shared/ratingCardStyles_custom.scss",
    import.meta.url
  ),
  "utf8"
);

test("scene cards place objective activity icons after the date", () => {
  const detailsStart = cardSource.indexOf('className="scene-card__details"');
  const dateIndex = cardSource.indexOf("scene-card__date", detailsStart);
  const metricsIndex = cardSource.indexOf("<SceneActivityMetrics", dateIndex);

  assert.ok(detailsStart >= 0);
  assert.ok(dateIndex > detailsStart);
  assert.ok(metricsIndex > dateIndex);
});

test("scene card popovers render below scene insights", () => {
  const popoverRenderer = cardSource.slice(
    cardSource.indexOf("function maybeRenderPopoverButtonGroup"),
    cardSource.indexOf("const SceneCardDetails")
  );
  const insightsIndex = popoverRenderer.indexOf("<SceneCardInsights");
  const popoversIndex = popoverRenderer.indexOf(
    '<ButtonGroup className="card-popovers">'
  );

  assert.ok(insightsIndex >= 0);
  assert.ok(popoversIndex > insightsIndex);
});

test("scene details place activity boxes below the title and above metadata", () => {
  const headerStart = detailSource.indexOf(
    'className="scene-header-container"'
  );
  const metricsIndex = detailSource.indexOf(
    "<SceneActivityMetrics",
    headerStart
  );
  const metadataIndex = detailSource.indexOf(
    'className="scene-subheader"',
    headerStart
  );
  const toolbarIndex = detailSource.indexOf(
    'className="scene-toolbar"',
    metadataIndex
  );

  assert.ok(headerStart >= 0);
  assert.ok(metricsIndex > headerStart);
  assert.ok(metadataIndex > metricsIndex);
  assert.ok(toolbarIndex > metadataIndex);
  assert.doesNotMatch(detailSource, /mouthSvg|gaySvg|straightSvg/);
  assert.match(
    detailSource,
    /<TruncatedText lineCount=\{2\} text=\{title\} \/>/
  );
});

test("activity boxes expose named tooltips and objective distribution bars", () => {
  assert.match(metricsSource, /metric\.percent/);
  assert.match(metricsSource, /metric\.duration/);
  assert.match(metricsSource, /metric\.outstandingPercent/);
  assert.match(metricsSource, /metric\.outstandingDuration/);
  assert.match(
    metricsSource,
    /metric\.label\s*\+\s*": "[\s\S]*?"; Outstanding: "\s*\+/
  );
  assert.match(
    metricsSource,
    /<strong>\{formatMetricValue\(metric\)\}<\/strong>/
  );
  assert.match(metricsSource, /aria-label=\{tooltip\}/);
  assert.match(metricsSource, /aria-hidden="true"/);
  assert.match(metricsSource, /renderDistributionBar\("Quality"/);
  assert.match(metricsSource, /"Activity Type"/);
  assert.match(
    metricsSource,
    /className="scene-activity-metrics__distribution"/
  );
  assert.match(metricsSource, /role="img"/);
  assert.match(metricsSource, /metric\.showPercent !== false/);
  assert.match(cardSource, /showDistributionBars/);
  assert.match(aggregateStatsSource, /<SceneActivityMetrics/);
  assert.match(aggregateStatsSource, /showDistributionBars/);
  assert.doesNotMatch(aggregateStatsSource, /ActivityPieChart/);
  const overviewRenderer = sceneStatsSource.slice(
    sceneStatsSource.indexOf("function renderOverviewPanel"),
    sceneStatsSource.indexOf("function renderPerformerActivity")
  );
  assert.ok(
    overviewRenderer.indexOf('className="scene-stats-stacked-bar"') <
      overviewRenderer.indexOf("<SceneActivityMetricBox")
  );
  assert.match(
    overviewRenderer,
    /label=\{<span className="sr-only">\{row\.label\}/
  );
  assert.match(
    metricsSource,
    /const qualityMetrics = activityMetrics\.quality\.filter/
  );
  assert.match(metricsSource, /\(metric\) => \(metric\.duration \?\? 0\) > 0/);
  assert.match(metricsSource, /gaySvg/);
  assert.match(metricsSource, /mouthSvg/);
  assert.match(metricsSource, /faHand/);
  assert.match(
    stylesSource,
    /\.scene-activity-metric__icon\s*\{[^}]*background-color:\s*transparent;/
  );
  assert.match(stylesSource, /\.scene-activity-metrics__row--quality/);
  assert.match(stylesSource, /\.scene-activity-metrics__distribution\s*\{/);
  assert.match(stylesSource, /\.scene-activity-metrics--stats\s*\{/);
  assert.match(
    stylesSource,
    /\.scene-stats-overview-rows\.scene-stats-overview-metric-boxes\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:/
  );
  assert.match(
    stylesSource,
    /\.scene-activity-metric__icon\s*\{[^}]*color:/,
    "untiered activity and quality icons share the same neutral color"
  );
  assert.doesNotMatch(
    stylesSource,
    /\.scene-activity-metric--(?:sex|oral|solo|outstanding|standard|unclassified|unusable)\s+\.scene-activity-metric__icon/
  );
  assert.match(
    stylesSource,
    /\.scene-activity-metric__icon\s*\{[^}]*border:\s*1px solid rgba\(255, 255, 255, 0\.28\)/
  );
  assert.match(
    stylesSource,
    /\.scene-activity-metric__copy\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;/
  );
  assert.match(stylesSource, /font-size:\s*0\.86rem;/);
  assert.doesNotMatch(activityCopyStyles, /white-space:\s*nowrap;/);
  assert.match(
    ratingStylesSource,
    /\.scene-activity-metric__icon\s*\{[^}]*border-color:[\s\S]*?--rating-card-classic-border,[\s\S]*?--rating-card-border-color,[\s\S]*?rgba\(255, 255, 255, 0\.28\)/
  );
  assert.doesNotMatch(
    stylesSource,
    /\.scene-activity-metric--oral\s+\.scene-activity-metric__icon\s*\{[^}]*background/
  );
});

test("scene type icons are retired from the scene card title", () => {
  assert.doesNotMatch(
    cardSource,
    /pretitleIcon|scene-gay-icon|scene-mouth-icon|scene-hand-icon/
  );
});

test("jerk activity uses a distinct shared color across activity charts", () => {
  assert.match(paletteSource, /oral:\s*"#00b3a4"/);
  assert.match(paletteSource, /solo:\s*"#a855f7"/);
  assert.match(metricsSource, /const soloColor = ACTIVITY_PIE_COLORS\.solo/);
  assert.match(
    sceneStatsPanelSource,
    /const soloMarkerColor = ACTIVITY_PIE_COLORS\.solo/
  );
  assert.match(
    performerStatsSource,
    /const soloMarkerColor = ACTIVITY_PIE_COLORS\.solo/
  );
  assert.doesNotMatch(metricsSource, /getSceneMarkerTagColorCustom/);
});
