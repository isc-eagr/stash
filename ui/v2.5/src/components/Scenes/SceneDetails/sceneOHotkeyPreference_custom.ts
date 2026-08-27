import type { IUIConfig } from "src/core/config";

export function shouldEnableSceneOHotkeyCustom(
  uiConfig?: Pick<IUIConfig, "enableSceneOHotkey">
): boolean {
  return uiConfig?.enableSceneOHotkey !== false;
}
