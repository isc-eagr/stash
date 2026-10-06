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

interface IStashDBMatchesStudioEntryCustom {
  scene: {
    studio?: { id: string; name: string } | null;
  };
}

// Group by ID so studios with the same name remain separate. Preserve row order.
export function groupStashDBMatchesByStudioCustom<
  T extends IStashDBMatchesStudioEntryCustom
>(entries: readonly T[]) {
  const groups = new Map<
    string | null,
    { id: string | null; name: string; entries: T[] }
  >();
  entries.forEach((entry) => {
    const { studio } = entry.scene;
    const id = studio?.id ?? null;
    const group = groups.get(id) ?? {
      id,
      name: studio?.name ?? "No studio",
      entries: [],
    };
    group.entries.push(entry);
    groups.set(id, group);
  });
  return Array.from(groups.values()).sort((a, b) => {
    if (a.id === null) return 1;
    if (b.id === null) return -1;
    return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
}

export function stashDBReportFingerprintsURLCustom(
  endpoint: string,
  stashID: string
) {
  return `${new URL(endpoint).origin}/scenes/${encodeURIComponent(
    stashID
  )}#fingerprints`;
}
