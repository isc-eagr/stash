import type { TaskProgressTrackerDataFragment } from "src/core/generated-graphql";
import { useIntl } from "react-intl";
import { ListFilterModel } from "src/models/list-filter/filter";
import {
  TagsCriterion,
  TagsCriterionOption,
} from "src/models/list-filter/criteria/tags";
import { FilterMode } from "src/core/generated-graphql";
import { progressToday } from "./progressMath_custom";

export type Tracker = TaskProgressTrackerDataFragment;
export const itemTypes = [
  "scene",
  "scene_marker",
  "image",
  "gallery",
  "performer",
  "studio",
  "group",
];
export const itemLabels: Record<string, string> = {
  scene: "Scenes",
  scene_marker: "Markers",
  image: "Images",
  gallery: "Galleries",
  performer: "Performers",
  studio: "Studios",
  group: "Groups",
};

export const taskProgressStatuses = [
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
] as const;

export const taskProgressStatusLabels: Record<string, string> = {
  CURRENT: "Current",
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
  ALL: "All",
};

export function taskProgressStatusLabel(status: string): string {
  return taskProgressStatusLabels[status] ?? status;
}

export function taskProgressStatusVariant(
  status: string
): "success" | "warning" | "info" | "secondary" {
  if (status === "ACTIVE") return "success";
  if (status === "PAUSED") return "warning";
  if (status === "COMPLETED") return "info";
  return "secondary";
}

export function visibleTaskProgressItemCounts<T extends { count: number }>(
  items: readonly T[]
): T[] {
  return items.filter((item) => item.count > 0);
}

export type TaskProgressDailyGoalState =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "sapphire";

export function taskProgressDailyGoalState(
  completed: number,
  goal: number
): TaskProgressDailyGoalState {
  const ratio = goal > 0 ? completed / goal : 0;
  if (ratio <= 0.25) return "red";
  if (ratio <= 0.5) return "orange";
  if (ratio <= 0.8) return "yellow";
  if (ratio <= 1) return "green";
  return "sapphire";
}

export function taskProgressDailyGoal(
  tracker: Pick<Tracker, "goal_per_day" | "history" | "status">,
  today = progressToday()
) {
  if (tracker.status !== "ACTIVE" || !tracker.goal_per_day) return undefined;

  const completed =
    tracker.history.find((day) => day.date === today)?.completed ?? 0;
  const state = taskProgressDailyGoalState(completed, tracker.goal_per_day);

  return { completed, goal: tracker.goal_per_day, state };
}

export function useProgressText() {
  const intl = useIntl();
  return (label: string) =>
    intl.formatMessage({
      id: `task_progress_v2.${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      defaultMessage: label,
    });
}

export {
  progressToday,
  progressForecast,
  progressPercentage,
  overallProgressPercentage,
} from "./progressMath_custom";

export function remainingTagURL(
  tracker: Pick<Tracker, "tag_id" | "tag_name">,
  type: string
) {
  const modes: Record<string, FilterMode> = {
    scene: FilterMode.Scenes,
    scene_marker: FilterMode.SceneMarkers,
    image: FilterMode.Images,
    gallery: FilterMode.Galleries,
    performer: FilterMode.Performers,
    studio: FilterMode.Studios,
    group: FilterMode.Groups,
  };
  const paths: Record<string, string> = {
    scene: "scenes",
    scene_marker: "scenes/markers",
    image: "images",
    gallery: "galleries",
    performer: "performers",
    studio: "studios",
    group: "groups",
  };
  const filter = new ListFilterModel(modes[type], undefined);
  const criterion = new TagsCriterion(TagsCriterionOption);
  criterion.value = {
    items: [{ id: tracker.tag_id, label: tracker.tag_name }],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(criterion);
  return `/${paths[type]}?${filter.makeQueryParameters()}`;
}
