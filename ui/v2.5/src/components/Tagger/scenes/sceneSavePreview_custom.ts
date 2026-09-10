import type {
  SceneUpdateInput,
  SlimSceneDataFragment,
  ScrapedScene,
} from "src/core/generated-graphql";

export type SceneSaveField = "title" | "details" | "date" | "code" | "director";
export type SceneClearFields = Partial<Record<SceneSaveField, boolean>>;

export interface ISceneSaveOptions {
  local: SlimSceneDataFragment;
  remote: ScrapedScene;
  excluded: Record<string, boolean>;
  performerIDs: (string | undefined)[];
  studioID?: string;
  tagIDs: string[];
  endpoint?: string | null;
  organized?: boolean;
  clearMissingFields?: SceneClearFields;
}

// Shared by the preview and Save so exclusion and merge behavior cannot drift.
export function buildSceneSaveInput(
  options: ISceneSaveOptions
): SceneUpdateInput {
  const { local, remote, excluded, performerIDs, studioID, tagIDs, endpoint } =
    options;
  const field = (key: SceneSaveField) => {
    if (excluded[key]) return local[key];
    if (remote[key] == null) {
      return local[key] && options.clearMissingFields?.[key]
        ? null
        : local[key];
    }
    return remote[key];
  };
  const input: SceneUpdateInput = {
    id: local.id,
    title: field("title"),
    details: field("details"),
    date: field("date"),
    code: field("code"),
    director: field("director"),
    performer_ids: [
      ...new Set([
        ...local.performers.map((p) => p.id),
        ...performerIDs.filter((id): id is string => id !== undefined),
      ]),
    ],
    studio_id: studioID,
    tag_ids: tagIDs,
    urls:
      excluded.url || !remote.urls
        ? local.urls
        : [...new Set([...local.urls, ...remote.urls])],
    organized: options.organized || undefined,
  };
  if (!excluded.stash_ids && endpoint && remote.remote_site_id) {
    input.stash_ids = [
      ...local.stash_ids
        .filter((s) => s.endpoint !== endpoint)
        .map(({ endpoint: source, stash_id, updated_at }) => ({
          endpoint: source,
          stash_id,
          updated_at,
        })),
      {
        endpoint,
        stash_id: remote.remote_site_id,
        updated_at: new Date().toISOString(),
      },
    ];
  }
  return input;
}

export interface ISceneSaveChange {
  key: string;
  label: string;
  before: string[];
  after: string[];
  status: "Added" | "Removed" | "Changed" | "Unchanged" | "Kept locally";
  remoteMissingField?: SceneSaveField;
}

export function getSceneSaveChanges(
  local: SlimSceneDataFragment,
  input: SceneUpdateInput,
  remote?: ScrapedScene
): ISceneSaveChange[] {
  const changes: ISceneSaveChange[] = [];
  function add(key: string, label: string, before: string[], after: string[]) {
    const same =
      JSON.stringify([...new Set(before)].sort()) ===
      JSON.stringify([...new Set(after)].sort());
    changes.push({
      key,
      label,
      before,
      after,
      status: same
        ? "Unchanged"
        : !before.length
        ? "Added"
        : !after.length
        ? "Removed"
        : "Changed",
    });
  }
  const value = (v?: string | null) => (v ? [v] : []);
  const scalars = {
    title: "Title",
    code: "Studio code",
    date: "Date",
    director: "Director",
    details: "Details",
  } as const;
  Object.entries(scalars).forEach(([key, label]) => {
    const field = key as keyof typeof scalars;
    add(
      key,
      label,
      value(local[field]),
      value(input[field] === undefined ? local[field] : input[field])
    );
    if (remote && local[field] && remote[field] == null) {
      const change = changes[changes.length - 1];
      change.remoteMissingField = field;
      if (change.status === "Unchanged") change.status = "Kept locally";
    }
  });
  add(
    "studio",
    "Studio",
    value(local.studio?.id),
    value(input.studio_id === undefined ? local.studio?.id : input.studio_id)
  );
  add(
    "performers",
    "Performers",
    local.performers.map((p) => p.id),
    input.performer_ids ?? local.performers.map((p) => p.id)
  );
  add(
    "tags",
    "Tags",
    local.tags.map((t) => t.id),
    input.tag_ids ?? local.tags.map((t) => t.id)
  );
  add("urls", "URLs", local.urls, input.urls ?? local.urls);
  const stashIDs = (ids: { endpoint: string; stash_id: string }[]) =>
    ids.map((s) => `${s.endpoint} · ${s.stash_id}`);
  add(
    "stash_ids",
    "Stash IDs",
    stashIDs(local.stash_ids),
    stashIDs(input.stash_ids ?? local.stash_ids)
  );
  add(
    "organized",
    "Organized",
    [local.organized ? "Yes" : "No"],
    [input.organized ?? local.organized ? "Yes" : "No"]
  );
  return changes;
}
