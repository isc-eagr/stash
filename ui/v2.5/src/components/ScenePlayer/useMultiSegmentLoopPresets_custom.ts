import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApolloCache, Reference } from "@apollo/client";
import * as GQL from "src/core/generated-graphql";
import type { ILoopSegmentInput } from "./multi-segment-loop";
import type { IMultiSegmentLoopController } from "./useMultiSegmentLoop_custom";
import { matchingLoopPresetName } from "./multiSegmentLoopState_custom";

// CUSTOM: begin - saved loop presets shared by the Loop tab, player menu, and viewer
export interface ILoopPreset {
  id?: string;
  name: string;
  enabled: boolean;
  currentSegmentIndex: number;
  segments: ILoopSegmentInput[];
}

interface ILoopPresetSource {
  id?: string | null;
  name: string;
  enabled?: boolean | null;
  current_segment_index?: number | null;
  segments?:
    | {
        start?: number | null;
        end?: number | null;
        title?: string | null;
      }[]
    | null;
}

export interface ILoopPresetOwner {
  sceneId?: string;
  releaseId?: string;
}

export interface IMultiSegmentLoopPresets {
  presets: ILoopPreset[];
  canSave: boolean;
  find: (name: string) => ILoopPreset | undefined;
  save: (name: string) => Promise<boolean>;
  load: (name: string) => boolean;
  remove: (name: string) => Promise<boolean>;
  /** The saved preset whose segments match the current loop. */
  matchingPresetName?: string;
  /** True when the current segments match no saved preset. */
  hasUnsavedSegments: boolean;
}

export function loopPresetsFromSource(
  presets: readonly ILoopPresetSource[] | null | undefined
): ILoopPreset[] {
  return (presets ?? []).map((preset) => ({
    id: preset.id ?? undefined,
    name: preset.name,
    enabled: preset.enabled ?? false,
    currentSegmentIndex: preset.current_segment_index ?? 0,
    segments: (preset.segments ?? []).map((segment) => ({
      start: segment.start ?? 0,
      end: segment.end ?? 0,
      title: segment.title || undefined,
    })),
  }));
}

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function upsertLoopPreset(list: ILoopPreset[], preset: ILoopPreset) {
  return [
    ...list.filter((item) => !sameName(item.name, preset.name)),
    preset,
  ].sort((a, b) => a.name.localeCompare(b.name));
}

function updateScenePresetCache(
  cache: ApolloCache<unknown>,
  sceneId: string,
  change: { saved?: { id: string; name: string }; deletedName?: string }
) {
  const id = cache.identify({ __typename: "Scene", id: sceneId });
  if (!id) return;
  cache.modify({
    id,
    fields: {
      multi_segment_loop_presets(value, { readField, toReference }) {
        const existing: readonly Reference[] = Array.isArray(value)
          ? value
          : [];
        const name = change.saved?.name ?? change.deletedName ?? "";
        const kept = existing.filter(
          (item) => !sameName(readField<string>("name", item) ?? "", name)
        );
        if (!change.saved) return kept;
        const ref = toReference({
          __typename: "MultiSegmentLoopPreset",
          id: change.saved.id,
        });
        if (!ref) return existing;
        return [...kept, ref].sort((a, b) =>
          (readField<string>("name", a) ?? "").localeCompare(
            readField<string>("name", b) ?? ""
          )
        );
      },
    },
  });
}

export function useMultiSegmentLoopPresets(
  owner: ILoopPresetOwner,
  sourcePresets: ILoopPreset[],
  loop: IMultiSegmentLoopController
): IMultiSegmentLoopPresets {
  const { sceneId, releaseId } = owner;
  const [presets, setPresets] = useState(sourcePresets);
  useEffect(() => setPresets(sourcePresets), [sourcePresets]);

  const [saveScenePreset] = GQL.useSaveSceneMultiSegmentLoopPresetMutation();
  const [deleteScenePreset] =
    GQL.useDeleteSceneMultiSegmentLoopPresetMutation();
  const [saveReleasePreset] = GQL.useSceneReleaseLoopPresetSaveMutation();
  const [deleteReleasePreset] = GQL.useSceneReleaseLoopPresetDestroyMutation();

  const find = useCallback(
    (name: string) => presets.find((preset) => sameName(preset.name, name)),
    [presets]
  );

  const { state } = loop;

  const save = useCallback(
    async (name: string) => {
      if (!state.segments.length || (!sceneId && !releaseId)) return false;
      const fields = {
        name,
        enabled: state.enabled,
        current_segment_index: state.currentSegmentIndex,
        segments: state.segments.map(({ start, end, title }) => ({
          start,
          end,
          title: title || undefined,
        })),
      };

      try {
        const saved = releaseId
          ? (
              await saveReleasePreset({
                variables: { input: { release_id: releaseId, ...fields } },
                refetchQueries: "active",
              })
            ).data?.sceneReleaseLoopPresetSave
          : (
              await saveScenePreset({
                variables: { input: { scene_id: sceneId!, ...fields } },
                update: (cache, { data }) => {
                  const result = data?.saveSceneMultiSegmentLoopPreset;
                  if (result) {
                    updateScenePresetCache(cache, sceneId!, { saved: result });
                  }
                },
              })
            ).data?.saveSceneMultiSegmentLoopPreset;
        if (!saved) return false;

        const [preset] = loopPresetsFromSource([saved]);
        setPresets((current) => upsertLoopPreset(current, preset));
        return true;
      } catch (error) {
        console.warn("Failed to save multi-segment loop preset", error);
        return false;
      }
    },
    [releaseId, saveReleasePreset, saveScenePreset, sceneId, state]
  );

  const remove = useCallback(
    async (name: string) => {
      const preset = find(name);
      if (!preset) return false;

      try {
        if (releaseId) {
          await deleteReleasePreset({
            variables: { release_id: releaseId, name: preset.name },
            refetchQueries: "active",
          });
        } else if (sceneId) {
          await deleteScenePreset({
            variables: { scene_id: sceneId, name: preset.name },
            update: (cache) =>
              updateScenePresetCache(cache, sceneId, {
                deletedName: preset.name,
              }),
          });
        } else {
          return false;
        }
        setPresets((current) =>
          current.filter((item) => !sameName(item.name, preset.name))
        );
        return true;
      } catch (error) {
        console.warn("Failed to delete multi-segment loop preset", error);
        return false;
      }
    },
    [deleteReleasePreset, deleteScenePreset, find, releaseId, sceneId]
  );

  const load = useCallback(
    (name: string) => {
      const preset = find(name);
      if (!preset || !loop.ready) return false;

      const loaded = loop.replaceSegments(preset.segments);
      if (preset.enabled && loaded.length) {
        loop.setEnabled(true);
        loop.jumpTo(Math.min(preset.currentSegmentIndex, loaded.length - 1));
      } else {
        loop.setEnabled(false);
      }
      return true;
    },
    [find, loop]
  );

  const matchingPresetName = useMemo(
    () => matchingLoopPresetName(state.segments, presets),
    [presets, state.segments]
  );
  const hasUnsavedSegments = state.segments.length > 0 && !matchingPresetName;

  return useMemo(
    () => ({
      presets,
      canSave: !!(sceneId || releaseId),
      find,
      save,
      load,
      remove,
      matchingPresetName,
      hasUnsavedSegments,
    }),
    [
      presets,
      sceneId,
      releaseId,
      find,
      save,
      load,
      remove,
      matchingPresetName,
      hasUnsavedSegments,
    ]
  );
}
// CUSTOM: end
