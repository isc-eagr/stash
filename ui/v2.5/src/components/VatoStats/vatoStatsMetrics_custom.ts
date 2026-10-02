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
