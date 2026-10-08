import {
  sceneActivityMarkerCategory,
  type SceneActivityRoleTagIds,
  type SceneActivityScene,
} from "./sceneActivityMetricsData_custom";

export interface IScenePerformerRoleSeconds {
  sexTopSeconds: number;
  sexBottomSeconds: number;
  oralTopSeconds: number;
  oralBottomSeconds: number;
}

// Vatos with no timed sex/oral markers get no time strips.
export const NO_SCENE_PERFORMER_ROLE_SECONDS: IScenePerformerRoleSeconds = {
  sexTopSeconds: 0,
  sexBottomSeconds: 0,
  oralTopSeconds: 0,
  oralBottomSeconds: 0,
};

type RoleKey = keyof IScenePerformerRoleSeconds;
type Interval = { start: number; end: number };

type RoleSecondsScene = Pick<SceneActivityScene, "files"> & {
  scene_markers: Array<
    SceneActivityScene["scene_markers"][number] & {
      top_performers: ReadonlyArray<{ id: string }>;
      bottom_performers: ReadonlyArray<{ id: string }>;
    }
  >;
};

function mergedDuration(intervals: Interval[]) {
  let total = 0;
  let current: Interval | undefined;
  [...intervals]
    .sort((a, b) => a.start - b.start)
    .forEach((interval) => {
      if (current && interval.start <= current.end) {
        current.end = Math.max(current.end, interval.end);
        return;
      }
      if (current) total += current.end - current.start;
      current = { ...interval };
    });
  return current ? total + current.end - current.start : total;
}

// CUSTOM: sex/oral top and bottom seconds per vato, measured like the scene
// Stats Versatility by Time (primary-tag markers, overlaps merged, clamped to
// the file). Lets scene cards show time bars from already loaded markers.
export function getScenePerformerRoleSeconds(
  scene: RoleSecondsScene,
  roleTagIds: SceneActivityRoleTagIds
): Map<string, IScenePerformerRoleSeconds> {
  const totalSeconds = scene.files[0]?.duration ?? 0;
  const intervals = new Map<string, Record<RoleKey, Interval[]>>();
  if (totalSeconds <= 0) return new Map();

  const add = (
    performers: ReadonlyArray<{ id: string }>,
    key: RoleKey,
    interval: Interval
  ) =>
    performers.forEach(({ id }) => {
      let entry = intervals.get(id);
      if (!entry) {
        entry = {
          sexTopSeconds: [],
          sexBottomSeconds: [],
          oralTopSeconds: [],
          oralBottomSeconds: [],
        };
        intervals.set(id, entry);
      }
      entry[key].push(interval);
    });

  scene.scene_markers.forEach((marker) => {
    if (marker.end_seconds === null || marker.end_seconds === undefined) return;
    const category = sceneActivityMarkerCategory(marker, roleTagIds);
    if (category !== "sex" && category !== "oral") return;

    const interval = {
      start: Math.max(0, Math.min(marker.seconds, totalSeconds)),
      end: Math.max(0, Math.min(marker.end_seconds, totalSeconds)),
    };
    if (interval.end <= interval.start) return;

    add(marker.top_performers, `${category}TopSeconds`, interval);
    add(marker.bottom_performers, `${category}BottomSeconds`, interval);
  });

  return new Map(
    [...intervals].map(([id, entry]) => [
      id,
      {
        sexTopSeconds: mergedDuration(entry.sexTopSeconds),
        sexBottomSeconds: mergedDuration(entry.sexBottomSeconds),
        oralTopSeconds: mergedDuration(entry.oralTopSeconds),
        oralBottomSeconds: mergedDuration(entry.oralBottomSeconds),
      },
    ])
  );
}
