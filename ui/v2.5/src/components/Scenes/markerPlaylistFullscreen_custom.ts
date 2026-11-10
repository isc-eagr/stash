type FullscreenCallCustom = () => Promise<void> | void;

export interface IMarkerPlayerFullscreenTargetCustom {
  requestFullscreen?: FullscreenCallCustom;
  webkitRequestFullscreen?: FullscreenCallCustom;
}

export interface IMarkerPlayerFullscreenDocumentCustom {
  fullscreenEnabled?: boolean;
  webkitFullscreenEnabled?: boolean;
  fullscreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
  exitFullscreen?: FullscreenCallCustom;
  webkitExitFullscreen?: FullscreenCallCustom;
}

// Resolves false when the browser cannot make the player element fullscreen
// (iPhone Safari only fullscreens bare <video> elements), so the player can
// fill the viewport instead.
export async function requestMarkerPlayerFullscreenCustom(
  target: IMarkerPlayerFullscreenTargetCustom,
  doc: IMarkerPlayerFullscreenDocumentCustom
): Promise<boolean> {
  if ((doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled) === false) {
    return false;
  }

  const request = target.requestFullscreen ?? target.webkitRequestFullscreen;
  if (!request) return false;

  try {
    await request.call(target);
    return true;
  } catch {
    return false;
  }
}

export function isMarkerPlayerNativeFullscreenCustom(
  doc: IMarkerPlayerFullscreenDocumentCustom
): boolean {
  return !!(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

export function exitMarkerPlayerFullscreenCustom(
  doc: IMarkerPlayerFullscreenDocumentCustom
): void {
  const exit = doc.exitFullscreen ?? doc.webkitExitFullscreen;
  Promise.resolve(exit?.call(doc)).catch(() => {});
}

// Phones rotate landscape videos the way native players do.
export function shouldLockMarkerPlayerLandscapeCustom(
  video: { videoWidth: number; videoHeight: number } | null,
  coarsePointer: boolean
): boolean {
  return coarsePointer && !!video && video.videoWidth > video.videoHeight;
}
