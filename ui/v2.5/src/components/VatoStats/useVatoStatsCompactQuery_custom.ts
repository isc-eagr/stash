import { useEffect, useState } from "react";
import { gql } from "@apollo/client";
import { print } from "graphql";
import { getPlatformURL } from "src/core/createClient";
import type { StatsDateRangeInput } from "src/core/generated-graphql";
import {
  expandVatoStatsCompactData,
  type VatoStatsCompactData,
} from "./vatoStatsCompactData_custom";

export const VATO_STATS_COMPACT_QUERY = gql`
  query VatoStatsPerformersCompact(
    $studioId: ID
    $depth: Int
    $dateRange: StatsDateRangeInput
  ) {
    p: vatoStatsPerformers(
      studio_id: $studioId
      depth: $depth
      date_range: $dateRange
    ) {
      a: id
      b: name
      c: image_path
      d: rating100
      e: scene_o_count
      h: scene_count
      i: sex_top_count
      j: sex_bottom_count
      k: oral_top_count
      l: oral_bottom_count
      m: solo_scene_count
      n: facial_given_count
      o: facial_received_count
      p: most_recent_o_date
      q: career_span_days
      r: metallic_rating
      s: ethnicity
      t: country
      u: hair_color
      v: eye_color
      w: height_cm
      x: penis_length
      y: circumcised
      z: unknown_scene_age_count
      ac: age_counts {
        a: age_range
        c: count
      }
    }
  }
`;

export function useVatoStatsCompactQuery(
  studioId?: string,
  depth?: number,
  dateRange?: StatsDateRangeInput | null
) {
  const [result, setResult] = useState<{
    data: ReturnType<typeof expandVatoStatsCompactData>;
    error?: Error;
    loading: boolean;
  }>({ data: expandVatoStatsCompactData(), loading: true });

  // Like Scene Stats, retain only the expanded snapshot. Keeping the raw result
  // in Apollo as well would retain a second object graph for the whole library.
  useEffect(() => {
    const controller = new AbortController();
    setResult({ data: expandVatoStatsCompactData(), loading: true });
    void fetch(getPlatformURL("graphql").toString(), {
      body: JSON.stringify({
        operationName: "VatoStatsPerformersCompact",
        query: print(VATO_STATS_COMPACT_QUERY),
        variables: {
          dateRange: dateRange ?? null,
          depth: depth ?? null,
          studioId: studioId ?? null,
        },
      }),
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`VatoStats request failed (${response.status})`);
        }
        const payload = (await response.json()) as {
          data?: VatoStatsCompactData;
          errors?: Array<{ message?: string }>;
        };
        if (payload.errors?.length) {
          throw new Error(
            payload.errors
              .map((error) => error.message)
              .filter(Boolean)
              .join("; ") || "VatoStats request failed"
          );
        }
        if (!payload.data) throw new Error("VatoStats returned no data");
        if (controller.signal.aborted) return;
        setResult({
          data: expandVatoStatsCompactData(payload.data),
          loading: false,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setResult({
          data: expandVatoStatsCompactData(),
          error: error instanceof Error ? error : new Error(String(error)),
          loading: false,
        });
      });
    return () => controller.abort();
  }, [dateRange, studioId, depth]);

  return result;
}
