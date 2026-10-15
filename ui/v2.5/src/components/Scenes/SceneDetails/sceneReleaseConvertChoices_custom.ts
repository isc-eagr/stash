// CUSTOM: defaults for the Convert to Release dialog. The source's data always
// moves to the new release; these choose what the target scene also takes.
// Cast and tags describe the shared content, so they merge. Fields that
// identify the source release only fill blanks, and Stash IDs stay put because
// they point at the source's StashDB scene.

interface INamed {
  id: string;
}

export interface IConvertChoiceScene {
  title?: string | null;
  code?: string | null;
  date?: string | null;
  director?: string | null;
  details?: string | null;
  urls: readonly string[];
  studio?: INamed | null;
  performers: readonly INamed[];
  tags: readonly INamed[];
  groups: readonly { group: INamed }[];
  galleries: readonly INamed[];
}

export type ConvertSourceDefaults = Record<
  | "title"
  | "code"
  | "date"
  | "director"
  | "details"
  | "urls"
  | "studio"
  | "performers"
  | "tags"
  | "groups"
  | "galleries",
  boolean
>;

const fillsBlank = (dest?: string | null, source?: string | null) =>
  !dest && !!source;

const addsItems = (dest: readonly INamed[], source: readonly INamed[]) => {
  const ids = new Set(dest.map((i) => i.id));
  return source.some((i) => !ids.has(i.id));
};

export function convertSourceDefaults(
  dest: IConvertChoiceScene,
  source: IConvertChoiceScene
): ConvertSourceDefaults {
  return {
    title: fillsBlank(dest.title, source.title),
    code: fillsBlank(dest.code, source.code),
    date: fillsBlank(dest.date, source.date),
    director: fillsBlank(dest.director, source.director),
    details: fillsBlank(dest.details, source.details),
    urls: !dest.urls.length && source.urls.length > 0,
    studio: !dest.studio && !!source.studio,
    performers: addsItems(dest.performers, source.performers),
    tags: addsItems(dest.tags, source.tags),
    groups: !dest.groups.length && source.groups.length > 0,
    galleries: !dest.galleries.length && source.galleries.length > 0,
  };
}

interface IStashIDChoice {
  endpoint: string;
  stash_id: string;
}

const stashDBIDCustom = (ids: readonly IStashIDChoice[]) =>
  ids.find((s) => {
    try {
      const host = new URL(s.endpoint).hostname.toLowerCase();
      return host === "stashdb.org" || host.endsWith(".stashdb.org");
    } catch {
      return false;
    }
  })?.stash_id;

// The target takes the source's StashDB count only together with the source's
// StashDB link; any other Stash ID choice leaves the target's count alone.
export function convertStashDBMatchesCustom(
  dest: { stash_ids: readonly IStashIDChoice[] },
  source: {
    stash_ids: readonly IStashIDChoice[];
    stashdb_matches?: number | null;
  },
  chosenStashIDs?: readonly IStashIDChoice[]
) {
  if (!chosenStashIDs || source.stashdb_matches == null) return undefined;
  const chosen = stashDBIDCustom(chosenStashIDs);
  return chosen &&
    chosen === stashDBIDCustom(source.stash_ids) &&
    chosen !== stashDBIDCustom(dest.stash_ids)
    ? source.stashdb_matches
    : undefined;
}
