// CUSTOM: StashDB Changes report helpers.

export type StashDBChangesKindCustom = "scene" | "performer";

// Field keys match StashDBFieldChange.field; labels are locale IDs.
export const STASHDB_SCENE_FIELDS_CUSTOM: readonly [string, string][] = [
  ["title", "title"],
  ["code", "scene_code"],
  ["date", "date"],
  ["studio", "studio"],
  ["performers", "performers"],
  ["tags", "tags"],
  ["details", "details"],
  ["director", "director"],
  ["urls", "urls"],
];

export const STASHDB_PERFORMER_FIELDS_CUSTOM: readonly [string, string][] = [
  ["name", "name"],
  ["disambiguation", "disambiguation"],
  ["aliases", "aliases"],
  ["gender", "gender"],
  ["birthdate", "birthdate"],
  ["death_date", "death_date"],
  ["ethnicity", "ethnicity"],
  ["country", "country"],
  ["eye_color", "eye_color"],
  ["hair_color", "hair_color"],
  ["height", "height_cm"],
  ["measurements", "measurements"],
  ["fake_tits", "fake_tits"],
  ["career_start", "career_start"],
  ["career_end", "career_end"],
  ["tattoos", "tattoos"],
  ["piercings", "piercings"],
  ["urls", "urls"],
];

export function stashDBFieldsCustom(kind: StashDBChangesKindCustom) {
  return kind === "scene"
    ? STASHDB_SCENE_FIELDS_CUSTOM
    : STASHDB_PERFORMER_FIELDS_CUSTOM;
}

export interface IStashDBChangeEntryCustom {
  status: string;
  stash_id: string;
  fields: { field: string }[];
}

// Deleted, merged, and missing entries always show; changed entries only
// when a compared field differs.
export function visibleStashDBChangesCustom<
  T extends IStashDBChangeEntryCustom
>(entries: readonly T[], excluded: readonly string[]) {
  const gone: T[] = [];
  const changed: T[] = [];
  entries.forEach((entry) => {
    const fields = entry.fields.filter((f) => !excluded.includes(f.field));
    const visible = { ...entry, fields };
    if (entry.status !== "CHANGED") gone.push(visible);
    else if (fields.length > 0) changed.push(visible);
  });
  return { gone, changed };
}

// How many entries differ on each field, ignoring exclusions.
export function stashDBFieldCountsCustom(
  entries: readonly IStashDBChangeEntryCustom[]
) {
  const counts = new Map<string, number>();
  entries.forEach((entry) =>
    new Set(entry.fields.map((f) => f.field)).forEach((field) =>
      counts.set(field, (counts.get(field) ?? 0) + 1)
    )
  );
  return counts;
}

export interface IStashDBFieldChangeCustom {
  field: string;
  remote?: string | null;
  added: readonly string[];
}

// A field can take StashDB's value unless it only lists removed entries,
// which are never removed automatically.
export function stashDBApplicableCustom(f: IStashDBFieldChangeCustom) {
  return !!f.remote || f.added.length > 0;
}

// What an apply skipped for lack of a local studio, vato, or tag: whatever
// of the applied fields is still on StashDB but missing locally.
export function stashDBSkippedCustom(
  applied: readonly string[],
  left: readonly IStashDBFieldChangeCustom[]
) {
  return left
    .filter((f) => applied.includes(f.field))
    .flatMap((f) => (f.field === "studio" && f.remote ? [f.remote] : f.added));
}

export function toggleStashDBFieldCustom(
  excluded: readonly string[],
  field: string
) {
  return excluded.includes(field)
    ? excluded.filter((f) => f !== field)
    : [...excluded, field];
}

// Matches the job description set by the backend check.
export const STASHDB_CHANGES_JOB_DESCRIPTION_CUSTOM =
  "Checking StashDB Changes...";

const STASHDB_CHANGES_ACTIVE_JOB_STATUSES_CUSTOM = [
  "READY",
  "RUNNING",
  "STOPPING",
];

// A check queued anywhere (Settings > Tasks or another tab) that is still
// going, so the report can follow it.
export function activeStashDBChangesJobCustom(
  jobs: readonly { id: string; status: string; description: string }[]
) {
  return jobs.find(
    (j) =>
      j.description === STASHDB_CHANGES_JOB_DESCRIPTION_CUSTOM &&
      STASHDB_CHANGES_ACTIVE_JOB_STATUSES_CUSTOM.includes(j.status)
  )?.id;
}

export function stashDBEntryURLCustom(
  endpoint: string,
  kind: StashDBChangesKindCustom,
  stashID: string
) {
  return `${new URL(endpoint).origin}/${kind}s/${encodeURIComponent(stashID)}`;
}

// URLs read shorter without the scheme, "www.", and a trailing slash.
export function stashDBShortURLCustom(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
}

export const STASHDB_STATUS_LABELS_CUSTOM: Record<string, string> = {
  DELETED: "Deleted on StashDB",
  MERGED: "Merged on StashDB",
  NOT_FOUND: "Not on StashDB",
};
