import type { SceneCardInsightScene } from "../Scenes/sceneCardInsightTypes_custom";

// One library scan supplies every scene-backed Playground tab.
export type StatsScene = SceneCardInsightScene & {
  title?: string | null;
  date?: string | null;
  paths: { screenshot?: string | null };
  studio?: { id: string; name: string } | null;
  performers: Array<
    SceneCardInsightScene["performers"][number] & {
      ethnicity?: string | null;
    }
  >;
  rating_tier_tags: { id: string }[];
  rating_scores: {
    section: string;
    key: string;
    raw_value: number;
    weighted_value: number;
  }[];
  scene_marker_tag_ancestors: { tag_id: string; ancestor_ids: string[] }[];
};
