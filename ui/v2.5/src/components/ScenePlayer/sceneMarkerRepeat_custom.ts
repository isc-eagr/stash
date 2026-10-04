import type { ILoopSegmentInput } from "./multi-segment-loop";

interface ISceneMarkerRepeat {
  markerId: string;
  segment: ILoopSegmentInput;
  resumeTime: number;
}

/** Temporary playback range; the configured multi-segment loop stays untouched. */
export class SceneMarkerRepeatCustom {
  active: ISceneMarkerRepeat | null = null;

  toggle(
    markerId: string,
    segment: ILoopSegmentInput,
    currentTime: number,
    duration: number
  ): number | null {
    if (this.active?.markerId === markerId) {
      const { resumeTime } = this.active;
      this.active = null;
      return resumeTime;
    }

    const start = Math.max(0, segment.start);
    const end =
      Number.isFinite(duration) && duration > 0
        ? Math.min(segment.end, duration)
        : segment.end;
    if (
      !markerId ||
      !Number.isFinite(segment.start) ||
      !Number.isFinite(segment.end) ||
      !Number.isFinite(end) ||
      !Number.isFinite(currentTime) ||
      end <= start
    ) {
      return null;
    }

    this.active = {
      markerId,
      segment: { ...segment, start, end },
      // Switching markers retains the position from the first repeat click.
      resumeTime: this.active?.resumeTime ?? currentTime,
    };
    return start;
  }

  clear(): void {
    this.active = null;
  }
}
