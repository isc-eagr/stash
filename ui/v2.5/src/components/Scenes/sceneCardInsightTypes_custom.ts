import type { IUIConfig } from "src/core/config";
import type * as GQL from "src/core/generated-graphql";

export type SceneCardInsightThresholds = Required<
  NonNullable<IUIConfig["sceneCardInsightThresholds"]>
>;

export type SceneCardInsightThresholdKey = keyof SceneCardInsightThresholds;

export type SceneCardInsightTone =
  | "activity"
  | "interaction"
  | "tag"
  | "goat"
  | "event"
  | "lineup"
  | "negative";

export interface ISceneCardInsight {
  key: string;
  label: string;
  detail: string;
  tone: SceneCardInsightTone;
}

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
  negative_markers?: Array<{
    id: string;
    start_seconds: number;
    end_seconds: number;
  }>;
};

export type SceneCardInsightCandidateKind =
  | "goat"
  | "facial"
  | "really-hot-event"
  | "orgasm-event"
  | "activity-quality"
  | "leaning"
  | "no-orgasm"
  | "interaction"
  | "negative-rating"
  | "favorite-lineup"
  | "country-lineup"
  | "filler"
  | "few-highlights"
  | "everybody-nuts"
  | "tag";

export type SceneCardInsightCandidate = ISceneCardInsight & {
  kind: SceneCardInsightCandidateKind;
  score: number;
};

export type SceneCardInsightRatingConfig = {
  overrideTagIds?: IUIConfig["ratingCardOverrideTagIds"];
  thresholds?: IUIConfig["ratingCardThresholds"];
};
