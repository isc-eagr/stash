import type { VideoJsPlayer } from "video.js";

interface ISceneAutostartConfig {
  autostartVideo?: boolean | null;
  autostartVideoOnPlaySelected?: boolean | null;
}

/** Timestamp and queue links must respect the saved Auto Start preferences. */
export function shouldAutostartSceneCustom(
  config: ISceneAutostartConfig | null | undefined,
  requested: boolean
): boolean {
  return (
    (config?.autostartVideo ?? false) ||
    ((config?.autostartVideoOnPlaySelected ?? false) && requested)
  );
}

/** Seeking an existing video preserves its current playing or paused state. */
export function seekScenePlayerTimestampCustom(
  player: Pick<VideoJsPlayer, "currentTime"> | null,
  seconds: number
): void {
  if (player && Number.isFinite(seconds) && seconds >= 0) {
    player.currentTime(seconds);
  }
}
