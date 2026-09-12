import type { StatsScene } from "../Shared/statsSceneData_custom";

// Deliberately fetch only engine inputs, in bounded pages, without filling the
// Apollo entity cache with an entire library's markers and performers.
export const INSIGHT_STATS_SCENES_QUERY = `
  query InsightStatsScenes($page: Int!) {
    findScenes(filter: { page: $page, per_page: 200, sort: "id", direction: ASC }) {
      count
      scenes {
        id title date
        rating100
        paths { screenshot }
        studio { id name }
        rating_tier_tags: tags { id }
        files { duration }
        performers { id name ethnicity country rating100 rating_tier_tags: tags { id } }
        rating_scores { section key raw_value weighted_value }
        scene_markers {
          id seconds end_seconds
          primary_tag { id name }
          tags { id name }
          top_performers { id name }
          bottom_performers { id name }
        }
        scene_marker_tag_ancestors { tag_id ancestor_ids }
        negative_markers { id start_seconds end_seconds }
      }
    }
  }
`;

type GraphQLRequest = <T>(
  query: string,
  variables: Record<string, unknown>
) => Promise<T>;

export function createInsightStatsRequest(
  url: string,
  signal?: AbortSignal
): GraphQLRequest {
  return async <T>(
    query: string,
    variables: Record<string, unknown>
  ): Promise<T> => {
    const response = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok)
      throw new Error(`Insights request failed (${response.status})`);
    const payload = (await response.json()) as {
      data?: T;
      errors?: Array<{ message: string }>;
    };
    if (payload.errors?.length)
      throw new Error(payload.errors.map(({ message }) => message).join("; "));
    if (!payload.data) throw new Error("Insights request returned no data");
    return payload.data;
  };
}

export async function loadInsightStatsScenes(
  request: GraphQLRequest,
  progress: (loaded: number, total: number) => void,
  signal?: AbortSignal
) {
  const scenes: StatsScene[] = [];
  const seen = new Set<string>();
  let total: number | undefined;
  for (let page = 1; ; page += 1) {
    if (signal?.aborted) throw new Error("Loading cancelled.");
    const data = await request<{
      findScenes: { count: number; scenes: StatsScene[] };
    }>(INSIGHT_STATS_SCENES_QUERY, { page });
    const batch = data.findScenes;
    if (total !== undefined && total !== batch.count)
      throw new Error(
        "The library changed during the scan. Refresh to scan again."
      );
    total = batch.count;
    batch.scenes.forEach((scene) => {
      if (seen.has(scene.id))
        throw new Error(
          "Scene pages changed during the scan. Refresh to scan again."
        );
      seen.add(scene.id);
      scenes.push(scene);
    });
    if (signal?.aborted) throw new Error("Loading cancelled.");
    progress(scenes.length, total);
    if (scenes.length === total) return scenes;
    if (!batch.scenes.length || scenes.length > total)
      throw new Error(
        "The scan returned incomplete scene data. Refresh to retry."
      );
  }
}
