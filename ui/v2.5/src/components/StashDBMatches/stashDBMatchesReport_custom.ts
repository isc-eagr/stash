export interface IStashDBMatchesChangeCustom {
  previous?: number | null;
  current: number;
}

// First-time counts have no previous value; they rank by their full count.
export function stashDBMatchesDeltaCustom(change: IStashDBMatchesChangeCustom) {
  return change.current - (change.previous ?? 0);
}

export function stashDBMatchesDeltaLabelCustom(
  change: IStashDBMatchesChangeCustom
) {
  if (change.previous == null) return "New";
  const delta = stashDBMatchesDeltaCustom(change);
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}

// Biggest increases first; ties by current count.
export function sortStashDBMatchesChangesCustom<
  T extends IStashDBMatchesChangeCustom
>(changes: T[]) {
  return [...changes].sort(
    (a, b) =>
      stashDBMatchesDeltaCustom(b) - stashDBMatchesDeltaCustom(a) ||
      b.current - a.current
  );
}
