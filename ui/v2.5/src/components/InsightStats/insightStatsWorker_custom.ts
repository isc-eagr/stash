import { normalizeSceneCardInsightThresholds } from "../Scenes/sceneCardInsightsData_custom";
import type {
  SceneCardInsightPerformerRoleStats,
  SceneCardInsightThresholds,
} from "../Scenes/sceneCardInsightTypes_custom";
import {
  calculateInsightStats,
  type InsightStatsConfig,
  type InsightStatsResult,
  type InsightStatsScene,
} from "./insightStatsData_custom";
import { deriveInsightRoleCounts } from "./insightStatsRoles_custom";
import {
  loadInsightSnapshot,
  writeInsightBaseline,
} from "./insightStatsCache_custom";

export type InsightStatsWorkerInput =
  | { type: "load"; url: string; config: InsightStatsConfig; force?: boolean }
  | {
      type: "simulate";
      requestId: number;
      thresholds: SceneCardInsightThresholds;
    };
export type InsightStatsWorkerOutput =
  | { type: "progress"; message: string }
  | { type: "error"; message: string }
  | {
      type: "result";
      requestId: number;
      current: InsightStatsResult;
      preview: InsightStatsResult;
      scannedAt: string;
      cacheAvailable: boolean;
    };

const worker = self as unknown as {
  onmessage: (event: MessageEvent<InsightStatsWorkerInput>) => void;
  postMessage: (message: InsightStatsWorkerOutput) => void;
};
let config: InsightStatsConfig = {};
let scenes: InsightStatsScene[] = [];
let roles = new Map<string, SceneCardInsightPerformerRoleStats>();
let baseline: InsightStatsResult | undefined;
let baselineThresholds = normalizeSceneCardInsightThresholds();
let previewThresholds = baselineThresholds;
let requestId = 0;
let scannedAt = "";
let cacheAvailable = false;

function fail(error: unknown) {
  worker.postMessage({
    type: "error",
    message: error instanceof Error ? error.message : String(error),
  });
}

async function simulate() {
  if (!baseline) return;
  const revision = requestId;
  const preview =
    JSON.stringify(previewThresholds) === JSON.stringify(baselineThresholds)
      ? baseline
      : await calculateInsightStats(
          scenes,
          config,
          previewThresholds,
          roles,
          () => revision !== requestId
        );
  if (!preview || revision !== requestId) return;
  worker.postMessage({
    type: "result",
    requestId: revision,
    current: baseline,
    preview,
    scannedAt,
    cacheAvailable,
  });
}

async function load(url: string, force = false) {
  const {
    snapshot,
    fromCache,
    cacheAvailable: stored,
  } = await loadInsightSnapshot(
    url,
    new AbortController().signal,
    (loaded, total) => {
      worker.postMessage({
        type: "progress",
        message: `Reading scenes: ${loaded.toLocaleString()} / ${total.toLocaleString()}`,
      });
    },
    { force }
  );
  scenes = snapshot.scenes;
  worker.postMessage({
    type: "progress",
    message: fromCache ? "Using cached scan…" : "Evaluating chip coverage…",
  });
  roles = deriveInsightRoleCounts(scenes, config);
  worker.postMessage({
    type: "progress",
    message: "Evaluating current chip coverage…",
  });
  const configKey = JSON.stringify(config);
  baseline =
    (snapshot.configKey === configKey ? snapshot.baseline : undefined) ??
    (await calculateInsightStats(scenes, config, baselineThresholds, roles));
  scannedAt = snapshot.scannedAt;
  cacheAvailable = stored;
  if (baseline && (snapshot.configKey !== configKey || !snapshot.baseline)) {
    await writeInsightBaseline(url, snapshot, configKey, baseline);
  }
  await simulate();
}

worker.onmessage = ({ data }) => {
  if (data.type === "load") {
    baseline = undefined;
    config = data.config;
    baselineThresholds = normalizeSceneCardInsightThresholds(
      config.sceneCardInsightThresholds
    );
    previewThresholds = baselineThresholds;
    void load(data.url, data.force).catch(fail);
  } else {
    requestId = data.requestId;
    previewThresholds = data.thresholds;
    void simulate().catch(fail);
  }
};
