import type {
  InsightStatsConfig,
  InsightStatsScene,
} from "./insightStatsData_custom";
import type { SceneCardInsightPerformerRoleStats } from "../Scenes/sceneCardInsightTypes_custom";

// Only the four counts consumed by Rare Role; no partner, duration, or matrix calculations.
// Matches backend direct tags/descendants, narrower-marker precedence, and distinct scene/role counting.
export function deriveInsightRoleCounts(
  scenes: InsightStatsScene[],
  config: InsightStatsConfig
) {
  const result = new Map<string, SceneCardInsightPerformerRoleStats>();
  for (const scene of scenes) {
    const ancestors = new Map(
      scene.scene_marker_tag_ancestors?.map((row) => [
        row.tag_id,
        row.ancestor_ids,
      ])
    );
    const seen = new Set<string>();
    for (const category of ["sex", "oral"] as const) {
      const tagID =
        config.roleTagIds?.[category === "sex" ? "sexTagId" : "oralTagId"];
      if (!tagID) continue;
      const matching = scene.scene_markers.filter((marker) =>
        [marker.primary_tag, ...marker.tags].some(
          (tag) =>
            tag.id === tagID ||
            (ancestors.get(tag.id) ?? tag.ancestor_ids ?? []).includes(tagID)
        )
      );
      const end = (marker: (typeof matching)[number]) =>
        marker.end_seconds ?? marker.seconds + 20;
      for (const marker of matching) {
        const duration = end(marker) - marker.seconds;
        if (
          matching.some(
            (other) =>
              other.id !== marker.id &&
              other.seconds < end(marker) &&
              end(other) > marker.seconds &&
              (end(other) - other.seconds < duration ||
                (end(other) - other.seconds === duration &&
                  Number(other.id) < Number(marker.id)))
          )
        )
          continue;
        for (const role of ["top", "bottom"] as const) {
          const key =
            category === "sex"
              ? (`sex_${role}_count` as const)
              : (`oral_role_${role}_count` as const);
          for (const performer of marker[`${role}_performers`] ?? []) {
            const unique = `${performer.id}:${key}`;
            if (seen.has(unique)) continue;
            seen.add(unique);
            const counts = result.get(performer.id) ?? {
              scene_count: 0,
              sex_top_count: 0,
              sex_bottom_count: 0,
              oral_role_top_count: 0,
              oral_role_bottom_count: 0,
              facial_scene_count: 0,
            };
            counts[key] = (counts[key] ?? 0) + 1;
            result.set(performer.id, counts);
          }
        }
      }
    }
  }
  return result;
}
