import type * as GQL from "src/core/generated-graphql";
import {
  resolveSortMetricCustom,
  type SortMetricDefinitionCustom,
} from "../Shared/sortMetric_custom";
import {
  getSceneActivityMetrics,
  type SceneActivityRoleTagIds,
} from "./sceneActivityMetricsData_custom";

type SceneSortMetricScene = GQL.SlimSceneDataFragment & {
  created_at?: string;
  updated_at?: string;
  last_played_at?: string | null;
  o_history?: string[];
  performers: Array<
    GQL.SlimSceneDataFragment["performers"][number] & {
      birthdate?: string | null;
    }
  >;
};

type SceneSortMetricSource = {
  direction: GQL.SortDirectionEnum;
  fromGroupId?: string;
  roleTagIds: SceneActivityRoleTagIds;
  scene: SceneSortMetricScene;
};

const firstFile = ({ scene }: SceneSortMetricSource) => scene.files[0];
const fileNameFromPath = (path: string) => path.replace(/^.*[\\/]/, "");
const scenePath = (source: SceneSortMetricSource) =>
  firstFile(source)?.path ?? "";
const sceneTitle = (source: SceneSortMetricSource) =>
  source.scene.title ??
  (scenePath(source) ? fileNameFromPath(scenePath(source)) : "");
const fuzzyDate = (value: string) => {
  const [yearValue, monthValue = "1", dayValue = "1"] = value.split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  if (![year, month, day].every(Number.isFinite)) return undefined;
  return new Date(year, Math.max(0, month - 1), day);
};
const ageAtDate = (birthdate: string, atDate: string) => {
  const birth = fuzzyDate(birthdate);
  const at = fuzzyDate(atDate);
  if (!birth || !at) return undefined;
  let age = at.getFullYear() - birth.getFullYear();
  if (
    birth.getMonth() > at.getMonth() ||
    (birth.getMonth() === at.getMonth() && birth.getDate() > at.getDate())
  ) {
    age -= 1;
  }
  return age;
};
const activityPercent = (
  source: SceneSortMetricSource,
  key:
    | "sex"
    | "oral"
    | "solo"
    | "other"
    | "outstanding"
    | "standard"
    | "unusable"
) => {
  const metrics = getSceneActivityMetrics(source.scene, source.roleTagIds);
  return [...(metrics?.activity ?? []), ...(metrics?.quality ?? [])].find(
    (metric) => metric.key === key
  )?.percent;
};

const performerAge = (source: SceneSortMetricSource) => {
  const sceneDate = source.scene.effective_date ?? source.scene.date;
  if (!sceneDate) return undefined;

  const ages = source.scene.performers
    .map((performer) =>
      performer.birthdate
        ? ageAtDate(performer.birthdate, sceneDate)
        : undefined
    )
    .filter((age): age is number => age !== undefined);
  if (ages.length === 0) return undefined;

  return source.direction === "DESC" ? Math.max(...ages) : Math.min(...ages);
};

const groupSceneNumber = (source: SceneSortMetricSource) => {
  const contextual = source.fromGroupId
    ? source.scene.groups.find(
        (sceneGroup) => sceneGroup.group.id === source.fromGroupId
      )?.scene_index
    : undefined;
  if (contextual !== undefined && contextual !== null) return contextual;

  const indexes = source.scene.groups
    .map((sceneGroup) => sceneGroup.scene_index)
    .filter((index): index is number => index !== undefined && index !== null);
  if (indexes.length === 0) return undefined;
  return source.direction === "DESC"
    ? Math.max(...indexes)
    : Math.min(...indexes);
};

const definitions: Record<
  string,
  SortMetricDefinitionCustom<SceneSortMetricSource>
> = {
  organized: {
    messageID: "organized",
    format: "boolean",
    value: ({ scene }) => scene.organized,
  },
  effective_date: {
    messageID: "effective_date",
    format: "date",
    value: ({ scene }) => scene.effective_date,
  },
  file_count: {
    messageID: "file_count",
    format: "count",
    value: ({ scene }) => scene.files.length,
  },
  filesize: {
    messageID: "filesize",
    format: "bytes",
    value: (source) => firstFile(source)?.size,
  },
  duration: {
    messageID: "duration",
    format: "duration",
    value: (source) => firstFile(source)?.duration,
  },
  framerate: {
    messageID: "framerate",
    format: "decimal",
    value: (source) => firstFile(source)?.frame_rate,
  },
  resolution: {
    messageID: "resolution",
    format: "text",
    value: (source) => {
      const file = firstFile(source);
      return file?.width && file?.height
        ? `${file.width}\u00d7${file.height}`
        : undefined;
    },
  },
  bitrate: {
    messageID: "bitrate",
    format: "text",
    value: (source) => {
      const value = firstFile(source)?.bit_rate;
      return value ? `${(value / 1_000_000).toFixed(2)} Mbps` : undefined;
    },
  },
  last_played_at: {
    messageID: "last_played_at",
    format: "datetime",
    value: ({ scene }) => scene.last_played_at,
  },
  resume_time: {
    messageID: "resume_time",
    format: "duration",
    value: ({ scene }) => scene.resume_time,
  },
  play_duration: {
    messageID: "play_duration",
    format: "duration",
    value: ({ scene }) => scene.play_duration,
  },
  play_count: {
    messageID: "play_count",
    format: "count",
    value: ({ scene }) => scene.play_count,
  },
  interactive: {
    messageID: "interactive",
    format: "boolean",
    value: ({ scene }) => scene.interactive,
  },
  interactive_speed: {
    messageID: "interactive_speed",
    format: "decimal",
    value: ({ scene }) => scene.interactive_speed,
  },
  perceptual_similarity: {
    messageID: "perceptual_similarity",
    format: "text",
    value: (source) =>
      firstFile(source)?.fingerprints.find(
        (fingerprint) => fingerprint.type === "phash"
      )?.value,
  },
  performer_age: {
    messageID: "performer_age",
    format: "decimal",
    value: performerAge,
  },
  studio: {
    messageID: "studio",
    format: "text",
    value: ({ scene }) => scene.studio?.name,
  },
  title: {
    messageID: "title",
    format: "text",
    value: sceneTitle,
  },
  path: {
    messageID: "path",
    format: "text",
    value: scenePath,
  },
  rating: {
    messageID: "rating",
    format: "rating",
    value: ({ scene }) => scene.rating100,
  },
  file_mod_time: {
    messageID: "file_mod_time",
    format: "datetime",
    value: (source) => firstFile(source)?.mod_time,
  },
  tag_count: {
    messageID: "tag_count",
    format: "count",
    value: ({ scene }) => scene.tags.length,
  },
  performer_count: {
    messageID: "performer_count",
    format: "count",
    value: ({ scene }) => scene.performers.length,
  },
  random: { messageID: "random", format: "none", value: () => undefined },
  o_counter: {
    messageID: "o_count",
    format: "count",
    value: ({ scene }) => scene.o_counter,
  },
  last_o_at: {
    messageID: "last_o_at",
    format: "datetime",
    value: ({ scene }) =>
      scene.o_history && scene.o_history.length > 0
        ? [...scene.o_history].sort()[scene.o_history.length - 1]
        : undefined,
  },
  group_scene_number: {
    messageID: "group_scene_number",
    format: "count",
    value: groupSceneNumber,
  },
  code: {
    messageID: "scene_code",
    format: "text",
    value: ({ scene }) => scene.code,
  },
  sex_activity_percent: {
    messageID: "sex_activity_percent",
    format: "percent",
    value: (source) => activityPercent(source, "sex"),
  },
  oral_activity_percent: {
    messageID: "oral_activity_percent",
    format: "percent",
    value: (source) => activityPercent(source, "oral"),
  },
  solo_activity_percent: {
    messageID: "solo_activity_percent",
    format: "percent",
    value: (source) => activityPercent(source, "solo"),
  },
  other_activity_percent: {
    messageID: "other_activity_percent",
    format: "percent",
    value: (source) => activityPercent(source, "other"),
  },
  outstanding_activity_percent: {
    messageID: "outstanding_activity_percent",
    format: "percent",
    value: (source) => activityPercent(source, "outstanding"),
  },
  standard_activity_percent: {
    messageID: "standard_activity_percent",
    format: "percent",
    value: (source) => activityPercent(source, "standard"),
  },
  unusable_activity_percent: {
    messageID: "unusable_activity_percent",
    format: "percent",
    value: (source) => activityPercent(source, "unusable"),
  },
  created_at: {
    messageID: "created_at",
    format: "datetime",
    value: ({ scene }) => scene.created_at,
  },
  updated_at: {
    messageID: "updated_at",
    format: "datetime",
    value: ({ scene }) => scene.updated_at,
  },
};

export function getSceneSortMetricCustom(
  sortBy: string | undefined,
  scene: SceneSortMetricScene,
  direction: GQL.SortDirectionEnum,
  roleTagIds: SceneActivityRoleTagIds,
  fromGroupId?: string
) {
  return resolveSortMetricCustom(sortBy, "date", definitions, {
    direction,
    fromGroupId,
    roleTagIds,
    scene,
  });
}
