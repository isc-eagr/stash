import type { ITaskProgressReportDay } from "./taskProgressReports_custom";

export function taskProgressTrendGeometry(
  days: readonly ITaskProgressReportDay[],
  width = 720
) {
  const height = 220;
  const left = 42;
  const right = width - 42;
  const top = 18;
  const bottom = height - 32;
  const max = Math.max(
    1,
    ...days
      .filter((day) => !day.future)
      .map((day) => Math.max(day.completed, day.goal))
  );
  const y = (value: number) => bottom - (value / max) * (bottom - top);
  const points = days.map((day, index) => ({
    ...day,
    x:
      days.length === 1
        ? (left + right) / 2
        : left + (index / Math.max(1, days.length - 1)) * (right - left),
    y: y(day.completed),
  }));
  const active = points.filter((point) => !point.future);
  const line = active
    .map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`)
    .join(" ");
  const area = active.length
    ? `${line} L${active[active.length - 1].x},${bottom} L${
        active[0].x
      },${bottom} Z`
    : "";
  const goal = points
    .map((point, index) =>
      point.goal > 0 && !point.future
        ? `${
            index && points[index - 1].goal > 0 && !points[index - 1].future
              ? "L"
              : "M"
          }${point.x},${y(point.goal)}`
        : ""
    )
    .join(" ");
  return {
    width,
    height,
    left,
    right,
    top,
    bottom,
    max,
    points,
    line,
    area,
    goal,
    y,
  };
}
