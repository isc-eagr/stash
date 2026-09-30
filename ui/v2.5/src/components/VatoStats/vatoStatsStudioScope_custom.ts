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
  estimatedLiters: number;
  totalPenisMeters: number;
}

// Computed from the loaded vato rows for every scope. The unscoped list
// includes zero-scene vatos, so it matches the old library-wide totals.
export function getVatoStatsSummary(
  performers: readonly IVatoStatsSummaryPerformer[],
  orgasmCount: number
): IVatoStatsSummary {
  return {
    estimatedLiters: (orgasmCount * 3) / 1000,
    totalPenisMeters:
      performers.reduce(
        (total, performer) => total + (performer.penis_length ?? 17),
        0
      ) / 100,
  };
}
