// CUSTOM: Scene marker layout preference helpers.

import type { IUIConfig } from "src/core/config";

export function shouldShowOfficialSceneMarkerLayout(
  uiConfig?: Pick<IUIConfig, "showOfficialSceneMarkerLayout">
) {
  return uiConfig?.showOfficialSceneMarkerLayout === true;
}
