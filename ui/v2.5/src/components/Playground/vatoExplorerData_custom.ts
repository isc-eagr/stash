// CUSTOM: Playground > Vato Explorer. A scatter of vatos on any two of their
// advisor criteria, rating, counts and measurements.
import { PerformerRatingCriteriaCriterionOption } from "src/models/list-filter/criteria/rating-criteria_custom";
import type { IPlaygroundChartPoint } from "./playgroundChart_custom";
import {
  playgroundAxisValue,
  type IPlaygroundMetric,
} from "./playgroundData_custom";
import {
  vatoTierFilterValue,
  type IVatoTierFilters,
} from "./vatoTiersData_custom";

export interface IVatoExplorerVato {
  id: string;
  name: string;
  image_path?: string | null;
  ethnicity?: string | null;
  country?: string | null;
  rating100?: number | null;
  birthdate?: string | null;
  death_date?: string | null;
  height_cm?: number | null;
  penis_length?: number | null;
  scene_count: number;
  o_counter?: number | null;
  rating_scores: { section: string; key: string; raw_value: number }[];
}

// Bounded pages, like the other Playground scans, outside the Apollo cache.
export const VATO_EXPLORER_QUERY = `
  query PlaygroundVatoExplorer($page: Int!) {
    findPerformers(
      filter: { page: $page, per_page: 200, sort: "id", direction: ASC }
    ) {
      count
      performers {
        id name image_path ethnicity country rating100
        birthdate death_date height_cm penis_length
        scene_count o_counter
        rating_scores { section key raw_value }
      }
    }
  }
`;

export interface IVatoExplorerPage {
  findPerformers: { count: number; performers: IVatoExplorerVato[] };
}

export async function loadExplorerVatos(
  request: (page: number) => Promise<IVatoExplorerPage>,
  signal: AbortSignal,
  progress: (loaded: number, total: number) => void
) {
  const vatos: IVatoExplorerVato[] = [];
  const seen = new Set<string>();
  let total: number | undefined;
  for (let page = 1; ; page += 1) {
    if (signal.aborted) throw new Error("Loading cancelled.");
    const { findPerformers: batch } = await request(page);
    if (signal.aborted) throw new Error("Loading cancelled.");
    if (total !== undefined && total !== batch.count)
      throw new Error("The library changed. Reload vatos to retry.");
    total = batch.count;
    for (const vato of batch.performers) {
      if (seen.has(vato.id))
        throw new Error("Vato pages changed. Reload vatos to retry.");
      seen.add(vato.id);
      vatos.push(vato);
    }
    progress(vatos.length, total);
    if (vatos.length === total) return vatos;
    if (!batch.performers.length || vatos.length > total)
      throw new Error("Incomplete vato data. Reload vatos to retry.");
  }
}

// Whole years from the birthdate to today, or to the day he died.
export function vatoExplorerAge(
  vato: Pick<IVatoExplorerVato, "birthdate" | "death_date">,
  today = new Date()
) {
  const parse = (value?: string | null) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
    return match ? match.slice(1).map(Number) : undefined;
  };
  const born = parse(vato.birthdate);
  if (!born) return undefined;
  const until = parse(vato.death_date) ?? [
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate(),
  ];
  const hadBirthday =
    until[1] > born[1] || (until[1] === born[1] && until[2] >= born[2]);
  const age = until[0] - born[0] - (hadBirthday ? 0 : 1);
  return age >= 0 ? age : undefined;
}

// Measurements of zero are missing values, not real zeros.
const positive = (value?: number | null) =>
  value && value > 0 ? value : undefined;

const vatoExplorerValues: Record<
  string,
  (vato: IVatoExplorerVato, today: Date) => number | null | undefined
> = {
  rating100: (vato) => vato.rating100,
  o_count: (vato) => vato.o_counter ?? 0,
  scene_count: (vato) => vato.scene_count,
  age: (vato, today) => vatoExplorerAge(vato, today),
  height: (vato) => positive(vato.height_cm),
  verga: (vato) => positive(vato.penis_length),
};

export function vatoExplorerMetrics(): IPlaygroundMetric[] {
  return [
    ...PerformerRatingCriteriaCriterionOption.criteria.map((criterion) => ({
      key: criterion.key,
      label: criterion.label,
      choices: criterion.choices,
      max: Math.max(...criterion.choices.map((choice) => choice.value)),
    })),
    { key: "rating100", label: "Vato Overall Rating", max: 100 },
    { key: "o_count", label: "O Count", max: 5, open: true },
    { key: "scene_count", label: "Scenes", max: 5, open: true },
    { key: "age", label: "Age", min: 18, max: 40, open: true },
    { key: "height", label: "Height (cm)", min: 150, max: 200, open: true },
    { key: "verga", label: "Verga (cm)", min: 10, max: 25, open: true },
  ];
}

export function vatoExplorerMetricValue(
  vato: IVatoExplorerVato,
  metric: IPlaygroundMetric,
  today = new Date()
) {
  const value = vatoExplorerValues[metric.key];
  return playgroundAxisValue(
    value
      ? value(vato, today)
      : vato.rating_scores.find(
          (score) => score.section === "criterion" && score.key === metric.key
        )?.raw_value,
    metric
  );
}

export interface IVatoExplorerPoint extends IPlaygroundChartPoint {
  vato: IVatoExplorerVato;
}

export function getVatoExplorerPoints(
  vatos: readonly IVatoExplorerVato[],
  xMetric: IPlaygroundMetric,
  yMetric: IPlaygroundMetric,
  today = new Date()
): IVatoExplorerPoint[] {
  return vatos.flatMap((vato) => {
    const x = vatoExplorerMetricValue(vato, xMetric, today);
    const y = vatoExplorerMetricValue(vato, yMetric, today);
    return x === undefined || y === undefined
      ? []
      : [{ id: vato.id, vato, x, y }];
  });
}

// Same Ethnicity and Country values as Vato Tiers: OR inside a filter, AND
// between them.
export function filterExplorerVatos(
  vatos: readonly IVatoExplorerVato[],
  filters: IVatoTierFilters
) {
  return vatos.filter((vato) =>
    (["ethnicity", "country"] as const).every(
      (dimension) =>
        !filters[dimension].length ||
        filters[dimension].includes(vatoTierFilterValue(vato, dimension))
    )
  );
}
