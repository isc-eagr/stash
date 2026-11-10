import type { IPlaygroundMetric } from "./playgroundData_custom";

// A dot on the chart: a scene or a vato with its two axis values.
export interface IPlaygroundChartPoint {
  id: string;
  x: number;
  y: number;
}

export const playgroundPlotPadding = {
  left: 58,
  right: 24,
  top: 36,
  bottom: 54,
};

export const playgroundScenesPerCoordinate = 3;
export const playgroundSceneLimit = 250;
export const playgroundPointSpacing = 14;

export function samplePlaygroundPoints<P extends IPlaygroundChartPoint>(
  points: P[],
  random: () => number = Math.random,
  perCoordinate = 1
) {
  const limit = Math.max(
    1,
    Math.min(playgroundScenesPerCoordinate, Math.floor(perCoordinate))
  );
  const coordinates = new Map<string, { count: number; points: P[] }>();
  for (const point of points) {
    const key = `${point.x}:${point.y}`;
    const group = coordinates.get(key);
    if (!group) {
      coordinates.set(key, { count: 1, points: [point] });
    } else {
      group.count += 1;
      // Reservoir sampling gives every scene at this coordinate equal odds.
      if (group.points.length < limit) group.points.push(point);
      else {
        const index = Math.floor(random() * group.count);
        if (index < limit) group.points[index] = point;
      }
    }
  }
  const samples: P[] = [];
  let count = 0;
  for (const point of [...coordinates.values()].flatMap(
    (group) => group.points
  )) {
    count += 1;
    if (samples.length < playgroundSceneLimit) samples.push(point);
    else {
      const index = Math.floor(random() * count);
      if (index < playgroundSceneLimit) samples[index] = point;
    }
  }
  return samples;
}

export function createPlaygroundRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Where each axis starts; zero unless a metric sets a minimum.
export interface IPlaygroundOrigin {
  x: number;
  y: number;
}

const playgroundZeroOrigin: IPlaygroundOrigin = { x: 0, y: 0 };

interface IPlaygroundSpread {
  xMetric: IPlaygroundMetric;
  yMetric: IPlaygroundMetric;
  xSplit: number;
  ySplit: number;
  attempt?: number;
}

function spreadPlaygroundCoordinate(
  value: number,
  maximum: number,
  split: number,
  metric: IPlaygroundMetric,
  sceneID: string
) {
  // Spread discrete advisor choices only. Overall ratings keep exact positions.
  if (!metric.choices || metric.choices.length < 2) return value;
  const values = [
    ...new Set(metric.choices.map((choice) => choice.value)),
  ].sort((a, b) => a - b);
  const step = Math.min(
    ...values.slice(1).map((choice, index) => choice - values[index])
  );
  const radius = step * 0.22;
  // Sample within the available interval so edge scores also leave the grid.
  // Keep the center on the same side of the divider as the real score.
  const low = Math.max(0, value - radius, value >= split ? split : 0);
  const high = Math.min(
    maximum,
    value + radius,
    value < split ? split : maximum
  );
  let seed = 2166136261;
  for (const character of `${sceneID}:${metric.key}`) {
    seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  }
  const fraction = createPlaygroundRandom(seed)();
  return low + fraction * (high - low);
}

export function positionPlaygroundPoints<P extends IPlaygroundChartPoint>(
  points: P[],
  width: number,
  height: number,
  xMax: number,
  yMax: number,
  spread?: IPlaygroundSpread,
  origin: IPlaygroundOrigin = playgroundZeroOrigin
) {
  const padding = playgroundPlotPadding;
  return points.map((point) => {
    const displayX = spread
      ? spreadPlaygroundCoordinate(
          point.x,
          xMax,
          spread.xSplit,
          spread.xMetric,
          spread.attempt ? `${point.id}:${spread.attempt}` : point.id
        )
      : point.x;
    const displayY = spread
      ? spreadPlaygroundCoordinate(
          point.y,
          yMax,
          spread.ySplit,
          spread.yMetric,
          spread.attempt ? `${point.id}:${spread.attempt}` : point.id
        )
      : point.y;
    return {
      ...point,
      displayX,
      displayY,
      cx:
        padding.left +
        ((displayX - origin.x) / (xMax - origin.x)) *
          (width - padding.left - padding.right),
      cy:
        height -
        padding.bottom -
        ((displayY - origin.y) / (yMax - origin.y)) *
          (height - padding.top - padding.bottom),
    };
  });
}

export function layoutPlaygroundPoints<P extends IPlaygroundChartPoint>(
  points: P[],
  width: number,
  height: number,
  xMax: number,
  yMax: number,
  spread?: IPlaygroundSpread,
  origin: IPlaygroundOrigin = playgroundZeroOrigin
) {
  const visible: ReturnType<typeof positionPlaygroundPoints<P>> = [];
  for (const point of positionPlaygroundPoints(
    points,
    width,
    height,
    xMax,
    yMax,
    spread,
    origin
  )) {
    // Try a few stable offsets; omit a dot when its neighborhood is full.
    // This adapts to mobile without altering scores or quadrant membership.
    for (let attempt = 0; attempt < (spread ? 24 : 1); attempt += 1) {
      const candidate =
        attempt > 0
          ? positionPlaygroundPoints(
              [point],
              width,
              height,
              xMax,
              yMax,
              { ...spread!, attempt },
              origin
            )[0]
          : point;
      if (
        visible.every(
          (other) =>
            (candidate.cx - other.cx) ** 2 + (candidate.cy - other.cy) ** 2 >=
            playgroundPointSpacing ** 2
        )
      ) {
        visible.push(candidate);
        break;
      }
    }
  }
  return visible;
}

export function hitTestPlaygroundPoints<
  P extends IPlaygroundChartPoint & { cx: number; cy: number },
>(points: P[], x: number, y: number) {
  // Select the displayed scene, including when several share exact scores.
  let nearest: P | undefined;
  let distance = 100;
  for (const point of points) {
    const candidate = (point.cx - x) ** 2 + (point.cy - y) ** 2;
    if (candidate < distance) {
      nearest = point;
      distance = candidate;
    }
  }
  return nearest ? [nearest] : [];
}

export function playgroundQuadrant(
  point: Pick<IPlaygroundChartPoint, "x" | "y">,
  xSplit: number,
  ySplit: number
) {
  return (point.x >= xSplit ? 1 : 0) + (point.y >= ySplit ? 2 : 0);
}

export const playgroundQuadrants = [
  {
    label: "Low X / Low Y",
    color: "#91a4ba",
    fill: "rgba(145, 164, 186, 0.06)",
  },
  {
    label: "High X / Low Y",
    color: "#e4ae72",
    fill: "rgba(228, 174, 114, 0.06)",
  },
  {
    label: "Low X / High Y",
    color: "#89b7ef",
    fill: "rgba(137, 183, 239, 0.06)",
  },
  {
    label: "High X / High Y",
    color: "#83d7b3",
    fill: "rgba(131, 215, 179, 0.06)",
  },
];
