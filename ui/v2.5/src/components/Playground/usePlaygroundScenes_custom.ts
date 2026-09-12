import { useEffect, useState } from "react";
import { getPlatformURL } from "src/core/createClient";
import { loadInsightSnapshot } from "../InsightStats/insightStatsCache_custom";
import {
  playgroundScenesFromSnapshot,
  type IPlaygroundScene,
} from "./playgroundData_custom";

export interface IPlaygroundScenesState {
  scenes: IPlaygroundScene[];
  loading: boolean;
  loaded: number;
  total: number;
  error?: string;
  loadedAt?: number;
}

export function usePlaygroundScenes(revision: number) {
  const [state, setState] = useState<IPlaygroundScenesState>({
    scenes: [],
    loading: true,
    loaded: 0,
    total: 0,
  });
  useEffect(() => {
    const controller = new AbortController();
    setState({ scenes: [], loading: true, loaded: 0, total: 0 });
    void loadInsightSnapshot(
      getPlatformURL("graphql").toString(),
      controller.signal,
      (loaded, total) => {
        if (!controller.signal.aborted)
          setState({ scenes: [], loading: true, loaded, total });
      },
      { force: revision > 0 }
    )
      .then(({ snapshot }) => {
        if (!controller.signal.aborted) {
          const scenes = playgroundScenesFromSnapshot(snapshot.scenes);
          setState({
            scenes,
            loading: false,
            loaded: scenes.length,
            total: scenes.length,
            loadedAt: Date.parse(snapshot.scannedAt),
          });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            scenes: [],
            loading: false,
            loaded: 0,
            total: 0,
            error: error instanceof Error ? error.message : String(error),
          });
      });
    return () => controller.abort();
  }, [revision]);
  return state;
}
