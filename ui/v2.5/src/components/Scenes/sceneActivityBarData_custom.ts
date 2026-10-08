import type {
  SceneActivityCategory,
  SceneActivityMetricRows,
} from "./sceneActivityMetricsData_custom";

// CUSTOM: one end of the scene card activity bar. A zero-duration end keeps
// the Sex/Oral pairing readable when only one of them is present.
export type SceneActivityBarEndCustom = {
  key: SceneActivityCategory;
  percent: number;
  duration: number;
  dominant: boolean;
  // Share of this activity's time that is Outstanding.
  outstandingPercent: number;
  // Share of this activity's time inside negative markers (the red fill).
  negativePercent: number;
};

export type SceneActivityBarCustom = {
  // Missing only for solo-only scenes.
  left?: SceneActivityBarEndCustom;
  right: SceneActivityBarEndCustom;
  // Dial position: 0 = all left, 1 = all right.
  rightShare: number;
};

const activityOrder: readonly SceneActivityCategory[] = ["sex", "oral", "solo"];

// Solo sits left of Sex or Oral; Sex sits left of Oral.
const leftOrder: readonly SceneActivityCategory[] = ["solo", "sex", "oral"];

function barEnd(
  key: SceneActivityCategory,
  percent = 0,
  duration = 0,
  outstandingPercent = 0,
  negativePercent = 0
): SceneActivityBarEndCustom {
  return {
    key,
    percent,
    duration,
    dominant: false,
    outstandingPercent,
    negativePercent,
  };
}

// Places the two longest activities on a two-ended bar. With all three
// present the shown percentages no longer add up to 100.
export function getSceneActivityBarCustom(
  metrics: SceneActivityMetricRows | undefined
): SceneActivityBarCustom | undefined {
  const shown = (metrics?.activity ?? [])
    .flatMap((metric) => {
      const key = activityOrder.find((category) => category === metric.key);
      const duration = metric.duration ?? 0;
      return key && duration > 0
        ? [
            barEnd(
              key,
              metric.percent,
              duration,
              metric.outstandingPercent,
              metric.negativePercent
            ),
          ]
        : [];
    })
    .sort(
      (a, b) =>
        b.duration - a.duration ||
        activityOrder.indexOf(a.key) - activityOrder.indexOf(b.key)
    )
    .slice(0, 2)
    .sort((a, b) => leftOrder.indexOf(a.key) - leftOrder.indexOf(b.key));
  if (shown.length === 0) return undefined;

  let left: SceneActivityBarEndCustom | undefined;
  let right: SceneActivityBarEndCustom;
  if (shown.length === 2) {
    [left, right] = shown;
  } else if (shown[0].key === "sex") {
    left = shown[0];
    right = barEnd("oral");
  } else {
    left = shown[0].key === "oral" ? barEnd("sex") : undefined;
    right = shown[0];
  }

  const leftDuration = left?.duration ?? 0;
  const longest = Math.max(leftDuration, right.duration);
  if (left) left.dominant = leftDuration === longest;
  right.dominant = right.duration === longest;

  return {
    left,
    right,
    rightShare: right.duration / (leftDuration + right.duration),
  };
}

// True when an activity sort value is already printed on one of the bar ends.
export function sceneActivityBarShowsSortCustom(
  sortBy: string | undefined,
  bar: SceneActivityBarCustom | undefined
) {
  return [bar?.left, bar?.right].some(
    (end) => !!end && sortBy === `${end.key}_activity_percent`
  );
}
