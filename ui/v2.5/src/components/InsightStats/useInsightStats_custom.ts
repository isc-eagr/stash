import { useEffect, useRef, useState } from "react";
import { getPlatformURL } from "src/core/createClient";
import InsightStatsWorker from "./insightStatsWorker_custom?worker&inline";
import type { SceneCardInsightThresholds } from "../Scenes/sceneCardInsightTypes_custom";
import type { IRatingCardThresholdConfig } from "../../utils/ratingCardStyles_custom";
import type {
  InsightStatsWorkerInput,
  InsightStatsWorkerOutput,
} from "./insightStatsWorker_custom";

export function useInsightStats(
  configJSON: string,
  thresholds: SceneCardInsightThresholds,
  ratingThresholds: IRatingCardThresholdConfig,
  refresh: number
) {
  const workerRef = useRef<Worker>();
  const lastRefresh = useRef(refresh);
  const revision = useRef(0);
  const [result, setResult] =
    useState<Extract<InsightStatsWorkerOutput, { type: "result" }>>();
  const [message, setMessage] = useState("Reading scenes…");
  const [error, setError] = useState<string>();
  const [updating, setUpdating] = useState(true);
  const thresholdJSON = JSON.stringify(thresholds);
  const ratingThresholdJSON = JSON.stringify(ratingThresholds);
  const previousThresholdJSON = useRef(thresholdJSON);
  const previousRatingThresholdJSON = useRef(ratingThresholdJSON);
  const [updatingPreview, setUpdatingPreview] = useState({
    chips: true,
    ratings: true,
  });

  useEffect(() => {
    setResult(undefined);
    setError(undefined);
    setMessage("Reading scenes…");
    setUpdating(true);
    setUpdatingPreview({ chips: true, ratings: true });
    // Stash's CSP permits blob workers; inline bundling also avoids a separate
    // worker URL that can go stale across deployments.
    let worker: Worker;
    try {
      worker = new InsightStatsWorker();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to start the insights worker."
      );
      setUpdating(false);
      setUpdatingPreview({ chips: false, ratings: false });
      return undefined;
    }
    workerRef.current = worker;
    worker.onmessage = ({ data }: MessageEvent<InsightStatsWorkerOutput>) => {
      if (data.type === "error") {
        setError(data.message);
        setUpdating(false);
        setUpdatingPreview({ chips: false, ratings: false });
      }
      if (data.type === "progress") setMessage(data.message);
      if (data.type === "result" && data.requestId === revision.current) {
        setResult(data);
        setUpdating(false);
        setUpdatingPreview({ chips: false, ratings: false });
      }
    };
    worker.onerror = (event) => {
      setError(
        event.message || "The insights worker failed. Refresh to retry."
      );
      setUpdating(false);
      setUpdatingPreview({ chips: false, ratings: false });
    };
    const input: InsightStatsWorkerInput = {
      type: "load",
      url: getPlatformURL("graphql").toString(),
      config: JSON.parse(configJSON),
      force: refresh !== lastRefresh.current,
    };
    worker.postMessage(input);
    lastRefresh.current = refresh;
    return () => {
      worker.terminate();
      workerRef.current = undefined;
    };
  }, [configJSON, refresh]);

  useEffect(() => {
    const chipsChanged = previousThresholdJSON.current !== thresholdJSON;
    const ratingsChanged =
      previousRatingThresholdJSON.current !== ratingThresholdJSON;
    previousThresholdJSON.current = thresholdJSON;
    previousRatingThresholdJSON.current = ratingThresholdJSON;
    revision.current += 1;
    setUpdating(true);
    setUpdatingPreview((previous) => ({
      chips: previous.chips || chipsChanged,
      ratings: previous.ratings || ratingsChanged,
    }));
    const requestId = revision.current;
    const timeout = setTimeout(() => {
      const input: InsightStatsWorkerInput = {
        type: "simulate",
        requestId,
        thresholds: JSON.parse(thresholdJSON),
        ratingThresholds: JSON.parse(ratingThresholdJSON),
      };
      workerRef.current?.postMessage(input);
    }, 250);
    return () => clearTimeout(timeout);
  }, [configJSON, ratingThresholdJSON, refresh, thresholdJSON]);

  return {
    result,
    message,
    error,
    updating,
    updatingChips: updatingPreview.chips,
    updatingRatings: updatingPreview.ratings,
  };
}
