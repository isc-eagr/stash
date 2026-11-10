import type { ILoopSegmentInput } from "./multi-segment-loop";

interface ISceneMarkerRepeat {
  markerId: string;
  segment: ILoopSegmentInput;
  resumeTime: number;
}

function boundSegment(
  markerId: string,
  segment: ILoopSegmentInput,
  duration: number
): ILoopSegmentInput | null {
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
    end <= start
  ) {
    return null;
  }
  return { ...segment, start, end };
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

    const bounded = boundSegment(markerId, segment, duration);
    if (!bounded || !Number.isFinite(currentTime)) return null;

    this.active = {
      markerId,
      segment: bounded,
      // Switching markers retains the position from the first repeat click.
      resumeTime: this.active?.resumeTime ?? currentTime,
    };
    return bounded.start;
  }

  /** Moves the running repeat of an edited draft; returns the new start to seek to. */
  retarget(
    markerId: string,
    segment: ILoopSegmentInput,
    duration: number
  ): number | null {
    if (this.active?.markerId !== markerId) return null;

    const bounded = boundSegment(markerId, segment, duration);
    if (!bounded) return null;

    this.active = { ...this.active, segment: bounded };
    return bounded.start;
  }

  clear(): void {
    this.active = null;
  }
}
