import type * as GQL from "src/core/generated-graphql";

// "Copy from..." on the scene Edit tab. A scene and its releases are owners of
// the same family; these helpers pick the other owners, turn one into the
// scrape shape the Edit form already reviews, and build the immediate
// markers / skip ranges / loop presets copy.

export interface ISceneOwnerRefCustom {
  sceneId?: string;
  releaseId?: string;
}

export interface ISceneOwnerCopySourceCustom {
  key: string;
  label: string;
  owner: ISceneOwnerRefCustom;
}

export const sceneOwnerSceneKeyCustom = "scene";
export const untitledReleaseLabelCustom = "Untitled Release";

// Every owner except the one being edited. A scene lists its releases; a
// release lists the scene first, then its sibling releases.
export function sceneOwnerCopySourcesCustom(
  scene: {
    id: string;
    releases: { id: string; title?: string | null }[];
  },
  activeReleaseId?: string | null
): ISceneOwnerCopySourceCustom[] {
  const releases = scene.releases
    .filter((release) => release.id !== activeReleaseId)
    .map((release) => ({
      key: `release:${release.id}`,
      label: release.title?.trim() || untitledReleaseLabelCustom,
      owner: { releaseId: release.id },
    }));

  if (!activeReleaseId) return releases;
  return [
    {
      key: sceneOwnerSceneKeyCustom,
      label: "Scene",
      owner: { sceneId: scene.id },
    },
    ...releases,
  ];
}

// The scene-shaped view of one owner (the scene, or a release projected by
// getSceneReleasePlaybackContextCustom).
export interface ISceneOwnerCopyViewCustom {
  title?: string | null;
  code?: string | null;
  date?: string | null;
  production_date?: string | null;
  director?: string | null;
  details?: string | null;
  urls?: string[] | null;
  studio?: { id: string; name: string } | null;
  performers: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  groups: { group: { id: string; name: string } }[];
  scene_markers: unknown[];
  negative_markers: unknown[];
  multi_segment_loop_presets: unknown[];
  paths?: { screenshot?: string | null };
}

// Fills the existing scrape review. Only stored IDs are used, so every row
// compares against the form. Releases have no production date, and the rating
// is shared with the scene, so neither is carried. `image` is set by the
// caller from the source cover.
export function sceneOwnerToScrapedCustom(
  view: ISceneOwnerCopyViewCustom,
  targetIsRelease: boolean
): GQL.ScrapedScene {
  return {
    title: view.title || null,
    code: view.code || null,
    date: view.date || null,
    production_date: targetIsRelease ? null : view.production_date || null,
    director: view.director || null,
    details: view.details || null,
    urls: view.urls?.length ? [...view.urls] : null,
    studio: view.studio
      ? { stored_id: view.studio.id, name: view.studio.name }
      : null,
    performers: view.performers.map((p) => ({
      stored_id: p.id,
      name: p.name,
    })),
    tags: view.tags.map((t) => ({ stored_id: t.id, name: t.name })),
    groups: view.groups.map((g) => ({
      stored_id: g.group.id,
      name: g.group.name,
    })),
  } as GQL.ScrapedScene;
}

export interface ISceneOwnerCopyCountsCustom {
  markers: number;
  negative_markers: number;
  loop_presets: number;
}

export function sceneOwnerCopyCountsCustom(
  view: ISceneOwnerCopyViewCustom
): ISceneOwnerCopyCountsCustom {
  return {
    markers: view.scene_markers.length,
    negative_markers: view.negative_markers.length,
    loop_presets: view.multi_segment_loop_presets.length,
  };
}

export interface ISceneOwnerCopyKindsCustom {
  markers: boolean;
  negative_markers: boolean;
  loop_presets: boolean;
}

export function sceneOwnerCopyHasItemsCustom(
  kinds: ISceneOwnerCopyKindsCustom
): boolean {
  return kinds.markers || kinds.negative_markers || kinds.loop_presets;
}

// `from` and `to` each name exactly one owner. Scene owners use the scene ID
// (the family ID), release owners the release ID.
export function sceneOwnerCopyItemsInputCustom(
  sceneId: string,
  from: ISceneOwnerRefCustom,
  to: ISceneOwnerRefCustom,
  kinds: ISceneOwnerCopyKindsCustom
): GQL.SceneOwnerCopyItemsInput {
  return {
    ...(from.releaseId
      ? { from_release_id: from.releaseId }
      : { from_scene_id: from.sceneId ?? sceneId }),
    ...(to.releaseId
      ? { to_release_id: to.releaseId }
      : { to_scene_id: to.sceneId ?? sceneId }),
    markers: kinds.markers,
    negative_markers: kinds.negative_markers,
    loop_presets: kinds.loop_presets,
  };
}

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

export function sceneOwnerCopyToastCustom(
  counts: ISceneOwnerCopyCountsCustom
): string {
  const parts = [
    counts.markers > 0 && plural(counts.markers, "marker", "markers"),
    counts.negative_markers > 0 &&
      plural(counts.negative_markers, "skip range", "skip ranges"),
    counts.loop_presets > 0 &&
      plural(counts.loop_presets, "loop preset", "loop presets"),
  ].filter(Boolean);
  return parts.length ? `Copied ${parts.join(", ")}` : "Nothing new to copy";
}
