import { useEffect, useState } from "react";
import { getPlatformURL } from "src/core/createClient";
import {
  expandSceneStatsCompactData,
  type SceneStatsCompactData,
  type SceneStatsScene,
} from "./sceneStatsCompactData_custom";

const SCENE_STATS_COMPACT_QUERY = `
  query SceneStatsScenes($studioId: ID, $depth: Int) {
    s: sceneStats(studio_id: $studioId, depth: $depth) {
      r: scenes {
        i: id
        t: title
        d: date
        e: effective_date
        a: rating100
        o: o_counter
        p: o_counter_past_year
        n: is_past_year
        l: is_release_past_year
        u: duration
        z: filesize
        v: performer_count
        w: performer_count_past_year
        j: performer_ethnicities
        k: performer_countries
        m: marker_tag_groups { g: tag_ids }
        g: tag_ids
        x: primary_width
        y: primary_height
        q: most_recent_o_date
        h: has_royal_sapphire_bonus
      }
    }
  }
`;

type SceneStatsCompactGraphQLResponse = {
  data?: SceneStatsCompactData;
  errors?: Array<{ message?: string }>;
};

interface ISceneStatsCompactQueryResult {
  error?: Error;
  loading: boolean;
  scenes: SceneStatsScene[];
}

// This large dashboard result intentionally bypasses Apollo normalization.
// At tens of thousands of scenes it is ephemeral aggregate input, not reusable
// entity cache data, and the compact aliases cut repeated JSON field names.
export function useSceneStatsCompactQuery(
  studioId?: string,
  depth?: number
): ISceneStatsCompactQueryResult {
  const [result, setResult] = useState<ISceneStatsCompactQueryResult>({
    loading: true,
    scenes: [],
  });

  useEffect(() => {
    const abortController = new AbortController();
    setResult({ loading: true, scenes: [] });

    void fetch(getPlatformURL("graphql").toString(), {
      body: JSON.stringify({
        operationName: "SceneStatsScenes",
        query: SCENE_STATS_COMPACT_QUERY,
        variables: { depth: depth ?? null, studioId: studioId ?? null },
      }),
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`SceneStats request failed (${response.status})`);
        }
        const payload =
          (await response.json()) as SceneStatsCompactGraphQLResponse;
        if (payload.errors?.length) {
          throw new Error(
            payload.errors
              .map((error) => error.message)
              .filter((message): message is string => !!message)
              .join("; ") || "SceneStats request failed"
          );
        }
        if (!payload.data) throw new Error("SceneStats returned no data");
        if (abortController.signal.aborted) return;
        setResult({
          loading: false,
          scenes: expandSceneStatsCompactData(payload.data),
        });
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) return;
        setResult({
          error: error instanceof Error ? error : new Error(String(error)),
          loading: false,
          scenes: [],
        });
      });

    return () => abortController.abort();
  }, [depth, studioId]);

  return result;
}
