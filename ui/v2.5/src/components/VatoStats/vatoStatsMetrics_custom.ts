// A vato needs this many scenes before O's per scene ranks him, so one lucky
// scene cannot top the podium.
export const VATO_O_PER_SCENE_MIN_SCENES = 3;

export function vatoOPerScene(performer: {
  scene_o_count: number;
  scene_count: number;
}) {
  if (performer.scene_count < VATO_O_PER_SCENE_MIN_SCENES) return undefined;
  return performer.scene_o_count / performer.scene_count;
}

export type VatoAgeChartDatum = {
  key: string;
  label: string;
  count: number;
  sortValue: number;
};

// Counts distinct vatos who did at least one scene at each age. A vato with
// scenes at 24 and 25 appears in both bars; Unknown counts vatos with at least
// one scene whose age cannot be calculated.
export function buildVatoAgeChartData(
  performers: ReadonlyArray<{
    age_counts: ReadonlyArray<{ age_range: string; count: number }>;
    unknown_scene_age_count: number;
  }>
) {
  const counts = new Map<string, number>();
  let unknownCount = 0;
  performers.forEach((performer) => {
    new Set(
      performer.age_counts
        .filter((ageCount) => ageCount.count > 0)
        .map((ageCount) => ageCount.age_range)
    ).forEach((age) => counts.set(age, (counts.get(age) ?? 0) + 1));
    if (performer.unknown_scene_age_count > 0) unknownCount += 1;
  });

  const data: VatoAgeChartDatum[] = Array.from(counts, ([age, count]) => ({
    key: age,
    label: age,
    count,
    sortValue: Number(age),
  })).sort((a, b) => a.sortValue - b.sortValue);
  return { data, unknownCount };
}
