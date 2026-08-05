export interface IVatoStatsStudioPerformer {
  penis_length?: number | null;
  scene_count: number;
  sex_top_count: number;
  sex_bottom_count: number;
  oral_top_count: number;
  oral_bottom_count: number;
  solo_scene_count: number;
  facial_given_count: number;
  facial_received_count: number;
  ethnicity?: string | null;
  metallic_rating?: string | null;
}

export interface IVatoStatsStudioSummary {
  estimatedLiters: number;
  totalPenisMeters: number;
  performersSexGivenCount: number;
  performersSexReceivedCount: number;
  performersOralGivenCount: number;
  performersOralReceivedCount: number;
  performersFacialGivenCount: number;
  performersFacialReceivedCount: number;
  performersSoloOnlyCount: number;
  performersOneSceneCount: number;
}

export interface IVatoStatsStudioRoleCounts {
  strictTop: number;
  lenientTop: number;
  strictBottom: number;
  lenientBottom: number;
}

export interface IVatoStatsStudioTierRow {
  ethnicity: string;
  bronze: number;
  silver: number;
  gold: number;
  royal_sapphire: number;
}

export function getVatoStatsStudioSummary(
  performers: readonly IVatoStatsStudioPerformer[],
  orgasmCount: number
): IVatoStatsStudioSummary {
  return {
    estimatedLiters: (orgasmCount * 3) / 1000,
    totalPenisMeters:
      performers.reduce(
        (total, performer) => total + (performer.penis_length ?? 17),
        0
      ) / 100,
    performersSexGivenCount: performers.filter(
      (performer) => performer.sex_top_count > 0
    ).length,
    performersSexReceivedCount: performers.filter(
      (performer) => performer.sex_bottom_count > 0
    ).length,
    performersOralGivenCount: performers.filter(
      (performer) => performer.oral_top_count > 0
    ).length,
    performersOralReceivedCount: performers.filter(
      (performer) => performer.oral_bottom_count > 0
    ).length,
    performersFacialGivenCount: performers.filter(
      (performer) => performer.facial_given_count > 0
    ).length,
    performersFacialReceivedCount: performers.filter(
      (performer) => performer.facial_received_count > 0
    ).length,
    performersSoloOnlyCount: performers.filter(
      (performer) =>
        performer.solo_scene_count > 0 &&
        performer.sex_top_count + performer.sex_bottom_count === 0 &&
        performer.oral_top_count + performer.oral_bottom_count === 0
    ).length,
    performersOneSceneCount: performers.filter(
      (performer) => performer.scene_count === 1
    ).length,
  };
}

export function getVatoStatsStudioRoleCounts(
  performers: readonly IVatoStatsStudioPerformer[]
): IVatoStatsStudioRoleCounts {
  return performers.reduce<IVatoStatsStudioRoleCounts>(
    (counts, performer) => {
      const nonSexBottomCount =
        performer.oral_bottom_count + performer.facial_received_count;
      const nonSexTopCount =
        performer.oral_top_count + performer.facial_given_count;

      if (performer.sex_top_count > 0 && performer.sex_bottom_count === 0) {
        if (nonSexBottomCount === 0) counts.strictTop += 1;
        else counts.lenientTop += 1;
      }
      if (performer.sex_bottom_count > 0 && performer.sex_top_count === 0) {
        if (nonSexTopCount === 0) counts.strictBottom += 1;
        else counts.lenientBottom += 1;
      }
      return counts;
    },
    { strictTop: 0, lenientTop: 0, strictBottom: 0, lenientBottom: 0 }
  );
}

export function getVatoStatsStudioTierRows(
  performers: readonly IVatoStatsStudioPerformer[]
): IVatoStatsStudioTierRow[] {
  const rows = new Map<string, IVatoStatsStudioTierRow>();
  performers.forEach((performer) => {
    const ethnicity = performer.ethnicity?.trim();
    const tier = performer.metallic_rating;
    if (
      !ethnicity ||
      (tier !== "bronze" &&
        tier !== "silver" &&
        tier !== "gold" &&
        tier !== "royal_sapphire")
    ) {
      return;
    }

    const row = rows.get(ethnicity) ?? {
      ethnicity,
      bronze: 0,
      silver: 0,
      gold: 0,
      royal_sapphire: 0,
    };
    row[tier] += 1;
    rows.set(ethnicity, row);
  });

  return Array.from(rows.values()).sort(
    (left, right) =>
      right.bronze +
        right.silver +
        right.gold +
        right.royal_sapphire -
        (left.bronze + left.silver + left.gold + left.royal_sapphire) ||
      left.ethnicity.localeCompare(right.ethnicity)
  );
}
