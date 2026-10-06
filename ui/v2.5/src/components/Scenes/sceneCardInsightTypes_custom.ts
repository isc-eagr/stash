import type { IUIConfig } from "src/core/config";
import type * as GQL from "src/core/generated-graphql";

export type SceneCardInsightThresholds = Required<
  NonNullable<IUIConfig["sceneCardInsightThresholds"]>
>;

export type SceneCardInsightThresholdKey = keyof SceneCardInsightThresholds;

export type SceneCardInsightTone = "event" | "rare";

export interface ISceneCardInsight {
  key: string;
  label: string;
  detail: string;
  tone: SceneCardInsightTone;
  performerPreviews: SceneCardInsightPerformer[]; // CUSTOM: hover portraits.
}

export type SceneCardInsightEvent = {
  id: string;
  category: "orgasm" | "facial";
  topPerformers: SceneCardInsightPerformer[];
  bottomPerformers: SceneCardInsightPerformer[];
  quality?: "GOAT" | "Really Hot";
};

export type SceneCardInsightTagParent = {
  id: string;
  parents?: SceneCardInsightTagParent[] | null;
};

export type SceneCardInsightTag = {
  id: string;
  name: string;
  ancestor_ids?: string[];
  parents?: SceneCardInsightTagParent[] | null;
};

export type SceneCardInsightPerformer = {
  id: string;
  name: string;
  image_path?: string | null;
  country?: string | null;
  rating100?: number | null;
  rating_tier_tags?: Array<{ id: string }>;
};

export type SceneCardInsightMarker = Pick<
  GQL.SlimSceneDataFragment["scene_markers"][number],
  "id" | "seconds" | "end_seconds"
> & {
  primary_tag: SceneCardInsightTag;
  tags: SceneCardInsightTag[];
  top_performers?: SceneCardInsightPerformer[];
  bottom_performers?: SceneCardInsightPerformer[];
};

export type SceneCardInsightScene = Pick<GQL.SlimSceneDataFragment, "id"> & {
  files: Array<Pick<GQL.VideoFileDataFragment, "duration">>;
  performers: SceneCardInsightPerformer[];
  // CUSTOM: rating fields used by Playground Scene Tiers.
  rating100?: number | null;
  rating_tier_tags?: Array<{ id: string }>;
  rating_scores?: Array<{
    section: string;
    key: string;
    raw_value: number;
  }>;
  scene_markers: SceneCardInsightMarker[];
  scene_marker_tag_ancestors?: Array<{
    tag_id: string;
    ancestor_ids: string[];
  }>;
};

export type SceneCardInsightPerformerRoleStats = {
  scene_count: number;
  sex_top_count: number;
  sex_bottom_count: number;
  oral_role_top_count?: number;
  oral_role_bottom_count?: number;
  facial_scene_count: number;
};

export type SceneCardInsightCandidateKind =
  | "orgasm-event"
  | "only-scene"
  | "rare-role";

export type SceneCardInsightCandidate = ISceneCardInsight & {
  kind: SceneCardInsightCandidateKind;
  score: number;
};
