// CUSTOM: scene-level displays show the scene's own O's and StashDB Matches
// plus its releases'. Each owner still stores its own values.

interface ISceneReleaseTotalsSourceCustom {
  o_counter?: number | null;
  release_o_counter?: number | null;
  o_history?: readonly string[] | null;
  release_last_o_at?: string | null;
  stashdb_matches?: number | null;
  release_stashdb_matches?: number | null;
}

export interface ISceneTotalCustom {
  own: number;
  releases: number;
  total: number;
}

const total = (own: number, releases: number): ISceneTotalCustom => ({
  own,
  releases,
  total: own + releases,
});

export function sceneOTotalCustom(
  scene: ISceneReleaseTotalsSourceCustom
): ISceneTotalCustom {
  return total(scene.o_counter ?? 0, scene.release_o_counter ?? 0);
}

// The latest dated O on the scene or any of its releases.
export function sceneLastOAtCustom(
  scene: ISceneReleaseTotalsSourceCustom
): string | undefined {
  const dates = [...(scene.o_history ?? [])];
  if (scene.release_last_o_at) dates.push(scene.release_last_o_at);
  let latest: string | undefined;
  let latestTime = -Infinity;
  for (const date of dates) {
    const time = new Date(date).getTime();
    if (time > latestTime) {
      latest = date;
      latestTime = time;
    }
  }
  return latest;
}

// Undefined while neither the scene nor any release has a StashDB count.
export function sceneStashDBMatchesTotalCustom(
  scene: ISceneReleaseTotalsSourceCustom
): ISceneTotalCustom | undefined {
  if (scene.stashdb_matches == null && scene.release_stashdb_matches == null) {
    return undefined;
  }
  return total(scene.stashdb_matches ?? 0, scene.release_stashdb_matches ?? 0);
}

// Marks a total that includes release values, with its breakdown as a tooltip.
export function sceneTotalHintCustom(value: ISceneTotalCustom | undefined) {
  if (!value?.releases) return {};
  return {
    className: "scene-total-includes-releases",
    title: `${value.own} on this scene + ${value.releases} from releases`,
  };
}
