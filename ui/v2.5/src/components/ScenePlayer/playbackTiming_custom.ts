import type { VideoJsPlayer } from "video.js";

// CUSTOM: Precise, frame-aware timing shared by playback-order features.
export interface IPlaybackBoundarySampleCustom {
  currentTime: number;
  boundaryLead: number;
}

export interface INegativePlaybackRangeCustom {
  start_seconds: number;
  end_seconds: number;
}

type PlaybackBoundaryCallbackCustom = (
  sample: IPlaybackBoundarySampleCustom
) => void;

const defaultFrameDurationSeconds = 1 / 24;
const minimumFrameDurationSeconds = 1 / 240;
const maximumObservedFrameDurationSeconds = 1 / 8;
const maximumBoundaryLeadSeconds = 0.25;
const playbackBoundaryEpsilonSeconds = 1e-9;

export function getPlaybackBoundaryLeadCustom(
  frameDuration: number,
  playbackRate = 1
): number {
  const normalizedFrameDuration = Number.isFinite(frameDuration)
    ? Math.min(
        maximumObservedFrameDurationSeconds,
        Math.max(minimumFrameDurationSeconds, frameDuration)
      )
    : defaultFrameDurationSeconds;
  const normalizedPlaybackRate = Number.isFinite(playbackRate)
    ? Math.max(1, playbackRate)
    : 1;

  return Math.min(
    maximumBoundaryLeadSeconds,
    normalizedFrameDuration * normalizedPlaybackRate
  );
}

export function reachesPlaybackBoundaryCustom(
  currentTime: number,
  boundary: number,
  boundaryLead: number
): boolean {
  if (
    !Number.isFinite(currentTime) ||
    !Number.isFinite(boundary) ||
    !Number.isFinite(boundaryLead)
  ) {
    return false;
  }

  return (
    currentTime + Math.max(0, boundaryLead) + playbackBoundaryEpsilonSeconds >=
    boundary
  );
}

export function getNegativeMarkerSkipTargetCustom(
  currentTime: number,
  boundaryLead: number,
  markers: readonly INegativePlaybackRangeCustom[]
): number | undefined {
  if (!Number.isFinite(currentTime)) return undefined;

  const normalizedMarkers = markers
    .map((marker) => ({
      start: Math.min(marker.start_seconds, marker.end_seconds),
      end: Math.max(marker.start_seconds, marker.end_seconds),
    }))
    .filter(
      (marker) =>
        Number.isFinite(marker.start) &&
        Number.isFinite(marker.end) &&
        marker.end > marker.start
    )
    .sort((a, b) => a.start - b.start);

  const firstBlockedIndex = normalizedMarkers.findIndex(
    (marker) =>
      currentTime < marker.end &&
      reachesPlaybackBoundaryCustom(currentTime, marker.start, boundaryLead)
  );
  if (firstBlockedIndex === -1) return undefined;

  let target = normalizedMarkers[firstBlockedIndex].end;
  for (
    let index = firstBlockedIndex + 1;
    index < normalizedMarkers.length;
    index++
  ) {
    const marker = normalizedMarkers[index];
    if (marker.start > target) break;
    target = Math.max(target, marker.end);
  }

  return target;
}

export function startPrecisePlaybackMonitorCustom(
  player: VideoJsPlayer,
  callback: PlaybackBoundaryCallbackCustom
): () => void {
  const techElement = player.tech(true)?.el?.();
  const videoElement = techElement as HTMLVideoElement | undefined;
  if (
    videoElement &&
    typeof videoElement.currentTime === "number" &&
    typeof videoElement.addEventListener === "function"
  ) {
    return startPreciseVideoElementMonitorCustom(videoElement, callback);
  }

  let disposed = false;
  let animationFrameId: number | undefined;
  const checkBoundary = () => {
    if (disposed || player.paused()) return;
    callback({
      currentTime: player.currentTime(),
      boundaryLead: getPlaybackBoundaryLeadCustom(
        defaultFrameDurationSeconds,
        player.playbackRate()
      ),
    });
  };
  const onAnimationFrame = () => {
    if (disposed) return;
    checkBoundary();
    animationFrameId = window.requestAnimationFrame(onAnimationFrame);
  };

  player.on("playing", checkBoundary);
  player.on("seeked", checkBoundary);
  animationFrameId = window.requestAnimationFrame(onAnimationFrame);

  return () => {
    disposed = true;
    player.off("playing", checkBoundary);
    player.off("seeked", checkBoundary);
    if (animationFrameId !== undefined) {
      window.cancelAnimationFrame(animationFrameId);
    }
  };
}

export function startPreciseVideoElementMonitorCustom(
  videoElement: HTMLVideoElement,
  callback: PlaybackBoundaryCallbackCustom
): () => void {
  const supportsVideoFrameCallback =
    typeof videoElement.requestVideoFrameCallback === "function";
  let disposed = false;
  let animationFrameId: number | undefined;
  let videoFrameId: number | undefined;
  let previousMediaTime: number | undefined;
  let estimatedFrameDuration = defaultFrameDurationSeconds;

  const checkBoundary = (currentTime: number) => {
    if (disposed || videoElement.paused) return;
    callback({
      currentTime,
      boundaryLead: getPlaybackBoundaryLeadCustom(
        estimatedFrameDuration,
        supportsVideoFrameCallback ? 1 : videoElement.playbackRate
      ),
    });
  };

  const onVideoFrame: VideoFrameRequestCallback = (_now, metadata) => {
    if (disposed) return;

    if (previousMediaTime !== undefined) {
      const observedFrameDuration = metadata.mediaTime - previousMediaTime;
      if (
        observedFrameDuration >= minimumFrameDurationSeconds &&
        observedFrameDuration <= maximumObservedFrameDurationSeconds
      ) {
        // Retain the slower recent cadence for safety, then let it decay.
        estimatedFrameDuration = Math.max(
          observedFrameDuration,
          estimatedFrameDuration * 0.9
        );
      }
    }
    previousMediaTime = metadata.mediaTime;
    checkBoundary(metadata.mediaTime);
    videoFrameId = videoElement.requestVideoFrameCallback(onVideoFrame);
  };

  const onAnimationFrame = () => {
    if (disposed) return;
    checkBoundary(videoElement.currentTime);
    animationFrameId = window.requestAnimationFrame(onAnimationFrame);
  };

  const checkCurrentTime = () => checkBoundary(videoElement.currentTime);

  videoElement.addEventListener("playing", checkCurrentTime);
  videoElement.addEventListener("seeked", checkCurrentTime);

  if (supportsVideoFrameCallback) {
    videoFrameId = videoElement.requestVideoFrameCallback(onVideoFrame);
  } else {
    animationFrameId = window.requestAnimationFrame(onAnimationFrame);
  }

  return () => {
    disposed = true;
    videoElement.removeEventListener("playing", checkCurrentTime);
    videoElement.removeEventListener("seeked", checkCurrentTime);
    if (videoFrameId !== undefined) {
      videoElement.cancelVideoFrameCallback?.(videoFrameId);
    }
    if (animationFrameId !== undefined) {
      window.cancelAnimationFrame(animationFrameId);
    }
  };
}
