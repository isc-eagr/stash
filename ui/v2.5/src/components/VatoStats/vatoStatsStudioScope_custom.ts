export interface IVatoStatsStudioScope {
  id: string;
  name: string;
  depth: number;
}

export function getVatoStatsStudioScope(
  studio: { id: string; name?: string | null },
  includeChildStudios: boolean
): IVatoStatsStudioScope {
  return {
    id: studio.id,
    name: studio.name ?? `Studio ${studio.id}`,
    depth: includeChildStudios ? -1 : 0,
  };
}

export interface IVatoStatsSummaryPerformer {
  penis_length?: number | null;
}

export interface IVatoStatsSummary {
  totalPenisMeters: number;
  measuredCount: number;
  assumedCount: number;
}

// Computed from the loaded vato rows for every scope. The unscoped list
// includes zero-scene vatos, so it matches the old library-wide totals.
export function getVatoStatsSummary(
  performers: readonly IVatoStatsSummaryPerformer[]
): IVatoStatsSummary {
  const measured = performers.filter(
    (p) =>
      typeof p.penis_length === "number" &&
      Number.isFinite(p.penis_length) &&
      p.penis_length > 0
  );
  return {
    totalPenisMeters:
      (measured.reduce((total, p) => total + p.penis_length!, 0) +
        (performers.length - measured.length) * 17) /
      100,
    measuredCount: measured.length,
    assumedCount: performers.length - measured.length,
  };
}
