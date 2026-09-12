import { useEffect, useRef, useState } from "react";
import { getPlatformURL } from "src/core/createClient";
import InsightStatsWorker from "./insightStatsWorker_custom?worker&inline";
import type { SceneCardInsightThresholds } from "../Scenes/sceneCardInsightTypes_custom";
import type {
  InsightStatsWorkerInput,
  InsightStatsWorkerOutput,
} from "./insightStatsWorker_custom";

export function useInsightStats(
  configJSON: string,
  thresholds: SceneCardInsightThresholds,
  refresh: number
) {
  const workerRef = useRef<Worker>();
  const lastRefresh = useRef(refresh);
  const revision = useRef(0);
  const [result, setResult] =
    useState<Extract<InsightStatsWorkerOutput, { type: "result" }>>();
  const [message, setMessage] = useState("Reading scenes…");
  const [error, setError] = useState<string>();
  const thresholdJSON = JSON.stringify(thresholds);
  const previousThresholdJSON = useRef(thresholdJSON);
  const [updatingPreview, setUpdatingPreview] = useState(true);

  useEffect(() => {
    setResult(undefined);
    setError(undefined);
    setMessage("Reading scenes…");
    setUpdatingPreview(true);
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
      setUpdatingPreview(false);
      return undefined;
    }
    workerRef.current = worker;
    worker.onmessage = ({ data }: MessageEvent<InsightStatsWorkerOutput>) => {
      if (data.type === "error") {
        setError(data.message);
        setUpdatingPreview(false);
      }
      if (data.type === "progress") setMessage(data.message);
      if (data.type === "result" && data.requestId === revision.current) {
        setResult(data);
        setUpdatingPreview(false);
      }
    };
    worker.onerror = (event) => {
      setError(
        event.message || "The insights worker failed. Refresh to retry."
      );
      setUpdatingPreview(false);
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
    previousThresholdJSON.current = thresholdJSON;
    revision.current += 1;
    if (chipsChanged) setUpdatingPreview(true);
    const requestId = revision.current;
    const timeout = setTimeout(() => {
      const input: InsightStatsWorkerInput = {
        type: "simulate",
        requestId,
        thresholds: JSON.parse(thresholdJSON),
      };
      workerRef.current?.postMessage(input);
    }, 250);
    return () => clearTimeout(timeout);
  }, [configJSON, refresh, thresholdJSON]);

  return {
    result,
    message,
    error,
    updatingChips: updatingPreview,
  };
}
