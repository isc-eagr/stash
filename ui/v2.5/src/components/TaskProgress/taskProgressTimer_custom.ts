export type TaskProgressTimerColor =
  | "green"
  | "light-green"
  | "yellow"
  | "orange"
  | "red";

export const taskProgressTimerMaxMinutes = 24 * 60;

export function timerCountdownMinutesToSeconds(
  minutes: number
): number | undefined {
  if (
    !Number.isFinite(minutes) ||
    minutes <= 0 ||
    minutes > taskProgressTimerMaxMinutes
  ) {
    return undefined;
  }

  return Math.round(minutes * 60);
}

export function timerCountdownPercentage(
  remainingSeconds: number,
  totalSeconds: number
): number {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return 0;

  const remaining = Number.isFinite(remainingSeconds) ? remainingSeconds : 0;
  return Math.min(100, Math.max(0, (remaining / totalSeconds) * 100));
}

export function timerCountdownRemainingSeconds(
  endAt: number,
  now = Date.now()
): number {
  if (!Number.isFinite(endAt) || !Number.isFinite(now)) return 0;

  return Math.max(0, Math.ceil((endAt - now) / 1000));
}

export interface ITaskProgressTimerTiming {
  remainingSeconds: number;
  overtimeSeconds: number;
  elapsedSeconds: number;
}

export function timerCountdownTiming(
  endAt: number,
  totalSeconds: number,
  now = Date.now()
): ITaskProgressTimerTiming {
  if (
    !Number.isFinite(endAt) ||
    !Number.isFinite(totalSeconds) ||
    totalSeconds <= 0 ||
    !Number.isFinite(now)
  ) {
    return { remainingSeconds: 0, overtimeSeconds: 0, elapsedSeconds: 0 };
  }

  const remainingSeconds = timerCountdownRemainingSeconds(endAt, now);
  const overtimeSeconds = Math.max(0, Math.floor((now - endAt) / 1000));
  return {
    remainingSeconds,
    overtimeSeconds,
    elapsedSeconds: Math.max(
      0,
      totalSeconds - remainingSeconds + overtimeSeconds
    ),
  };
}

export function timerCountdownColor(
  percentage: number
): TaskProgressTimerColor {
  const remaining = Number.isFinite(percentage)
    ? Math.min(100, Math.max(0, percentage))
    : 0;

  if (remaining >= 80) return "green";
  if (remaining >= 60) return "light-green";
  if (remaining >= 40) return "yellow";
  if (remaining >= 20) return "orange";
  return "red";
}

export function formatTimerCountdown(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(remainingSeconds).padStart(2, "0");

  if (hours > 0) {
    return `${String(hours).padStart(
      2,
      "0"
    )}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${paddedMinutes}:${paddedSeconds}`;
}
