import type { IUIConfig } from "src/core/config";

type ScenePlayerControlConfig = Pick<
  IUIConfig,
  | "showScenePlayerChromecastControl"
  | "showScenePlayerStreamControl"
  | "showScenePlayerAutostartControl"
>;

/** Hide controls without changing their plugins or playback preferences. */
export function scenePlayerControlClassesCustom(
  ui?: ScenePlayerControlConfig | null
) {
  return {
    "scene-player-hide-chromecast": !(
      ui?.showScenePlayerChromecastControl ?? false
    ),
    "scene-player-hide-stream": !(ui?.showScenePlayerStreamControl ?? false),
    "scene-player-hide-autostart": !(
      ui?.showScenePlayerAutostartControl ?? false
    ),
  };
}
