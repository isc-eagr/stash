// Retroactive O's have no date, so they count toward o_counter but are
// missing from o_history.
export function sceneRetroactiveOCountCustom(
  oCounter: number | null | undefined,
  datedCount: number
): number {
  return Math.max(0, (oCounter ?? 0) - datedCount);
}
