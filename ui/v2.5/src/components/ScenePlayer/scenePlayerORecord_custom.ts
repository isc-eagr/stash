export const SCENE_PLAYER_O_IDLE_MS = 2000;

export type ScenePlayerORecordTarget = {
  sceneId: string;
  videoTimestamp: number;
};

export function getScenePlayerORecordTargetCustom(
  sceneId: string,
  videoTimestamp: number
): ScenePlayerORecordTarget | undefined {
  if (!sceneId || !Number.isFinite(videoTimestamp) || videoTimestamp < 0) {
    return undefined;
  }

  return { sceneId, videoTimestamp };
}
