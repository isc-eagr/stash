import { normalizeSceneCardInsightThresholds } from "../Scenes/sceneCardInsightsData_custom";
import type {
  SceneCardInsightPerformerRoleStats,
  SceneCardInsightThresholds,
} from "../Scenes/sceneCardInsightTypes_custom";
import type { IRatingCardThresholdConfig } from "../../utils/ratingCardStyles_custom";
import {
  calculateInsightStats,
  type InsightStatsConfig,
  type InsightStatsResult,
  type InsightStatsScene,
} from "./insightStatsData_custom";
import {
  createInsightStatsRequest,
  loadInsightStatsScenes,
} from "./insightStatsQuery_custom";
import { deriveInsightRoleCounts } from "./insightStatsRoles_custom";
import {
  readInsightSnapshot,
  writeInsightSnapshot,
  isFreshInsightSnapshot,
} from "./insightStatsCache_custom";

export type InsightStatsWorkerInput =
  | { type: "load"; url: string; config: InsightStatsConfig; force?: boolean }
  | {
      type: "simulate";
      requestId: number;
      thresholds: SceneCardInsightThresholds;
      ratingThresholds: IRatingCardThresholdConfig;
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
let previewRatingThresholds: IRatingCardThresholdConfig = {};
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
  const previewConfig = {
    ...config,
    ratingCardThresholds: previewRatingThresholds,
  };
  const preview =
    JSON.stringify(previewThresholds) === JSON.stringify(baselineThresholds) &&
    JSON.stringify(previewRatingThresholds) ===
      JSON.stringify(config.ratingCardThresholds ?? {})
      ? baseline
      : await calculateInsightStats(
          scenes,
          previewConfig,
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
  const request = createInsightStatsRequest(url);
  const cached = force ? undefined : await readInsightSnapshot(url);
  const usable = cached && isFreshInsightSnapshot(cached) ? cached : undefined;
  scenes =
    usable?.scenes ??
    (await loadInsightStatsScenes(request, (loaded, total) => {
      worker.postMessage({
        type: "progress",
        message: `Reading scenes: ${loaded.toLocaleString()} / ${total.toLocaleString()}`,
      });
    }));
  worker.postMessage({
    type: "progress",
    message: usable ? "Using cached scan…" : "Evaluating chip coverage…",
  });
  roles = deriveInsightRoleCounts(scenes, config);
  worker.postMessage({
    type: "progress",
    message: "Evaluating current chip coverage…",
  });
  const configKey = JSON.stringify(config);
  baseline =
    (usable?.configKey === configKey ? usable.baseline : undefined) ??
    (await calculateInsightStats(scenes, config, baselineThresholds, roles));
  scannedAt = usable?.scannedAt ?? new Date().toISOString();
  cacheAvailable =
    usable?.configKey === configKey ||
    (await writeInsightSnapshot(url, {
      scenes,
      scannedAt,
      configKey,
      baseline,
    }));
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
    previewRatingThresholds = config.ratingCardThresholds ?? {};
    void load(data.url, data.force).catch(fail);
  } else {
    requestId = data.requestId;
    previewThresholds = data.thresholds;
    previewRatingThresholds = data.ratingThresholds;
    void simulate().catch(fail);
  }
};
