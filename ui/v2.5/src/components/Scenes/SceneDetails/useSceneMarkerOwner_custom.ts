import { useMemo } from "react";
import * as GQL from "src/core/generated-graphql";
import {
  useFindScene,
  useSceneMarkerCreate,
  useSceneMarkerDestroy,
  useSceneMarkerUpdate,
  useSceneNegativeMarkerCreate,
  useSceneNegativeMarkerDestroy,
  useSceneNegativeMarkerUpdate,
} from "src/core/StashService";
import { releaseMutationCacheRefreshCustom } from "src/core/sceneReleaseCache_custom";
import { getSceneReleasePlaybackContextCustom } from "./sceneReleasePlaybackContext_custom";
import {
  buildSceneMarkerDestroyCustom,
  buildSceneMarkerSaveCustom,
  buildSceneNegativeMarkerDestroyCustom,
  buildSceneNegativeMarkerSaveCustom,
  type ISceneMarkerOwnerCustom,
  type ISceneMarkerOwnerValuesCustom,
  type ISceneNegativeMarkerOwnerPatchCustom,
} from "./sceneMarkerOwner_custom";

interface ISaveOptionsCustom {
  // Skips the refresh for an intermediate write; the last write refreshes.
  deferRefresh?: boolean;
}

const deferredRefreshCustom = (options?: ISaveOptionsCustom) =>
  options?.deferRefresh ? { refetchQueries: [] } : {};

// The scene, or its release projected into the scene shape, so marker tools
// read the owner's markers, skip ranges, cast, and file.
export function useSceneMarkerOwnerSceneCustom(
  owner: ISceneMarkerOwnerCustom
): GQL.SceneDataFragment | undefined {
  const { data } = useFindScene(owner.sceneId);
  const scene = data?.findScene ?? undefined;
  const { releaseId } = owner;

  return useMemo(() => {
    if (!scene || !releaseId) return scene;
    return getSceneReleasePlaybackContextCustom(scene, releaseId)?.scene;
  }, [scene, releaseId]);
}

export function useSceneMarkerOwnerTagsCustom(owner: ISceneMarkerOwnerCustom) {
  const sceneResult = GQL.useFindSceneMarkerTagsQuery({
    variables: { id: owner.sceneId },
    skip: !!owner.releaseId,
  });
  const releaseResult = GQL.useFindSceneReleaseMarkerTagsQuery({
    variables: { release_id: owner.releaseId ?? "" },
    skip: !owner.releaseId,
  });

  return owner.releaseId
    ? {
        markerTags: releaseResult.data?.sceneReleaseMarkerTags,
        loading: releaseResult.loading,
      }
    : {
        markerTags: sceneResult.data?.sceneMarkerTags,
        loading: sceneResult.loading,
      };
}

// Marker and skip-range writes for either owner. Saves resolve to the saved
// row's id; release writes refresh mounted queries like other release edits.
export function useSceneMarkerOwnerMutationsCustom(
  owner: ISceneMarkerOwnerCustom
) {
  const [sceneMarkerCreate] = useSceneMarkerCreate();
  const [sceneMarkerUpdate] = useSceneMarkerUpdate();
  const [sceneMarkerDestroy] = useSceneMarkerDestroy(owner.sceneId);
  const [sceneNegativeMarkerCreate] = useSceneNegativeMarkerCreate();
  const [sceneNegativeMarkerUpdate] = useSceneNegativeMarkerUpdate();
  const [sceneNegativeMarkerDestroy] = useSceneNegativeMarkerDestroy(
    owner.sceneId
  );
  const [releaseMarkerSave] = GQL.useSceneReleaseMarkerSaveMutation(
    releaseMutationCacheRefreshCustom
  );
  const [releaseMarkerDestroy] = GQL.useSceneReleaseMarkerDestroyMutation(
    releaseMutationCacheRefreshCustom
  );
  const [releaseNegativeMarkerSave] =
    GQL.useSceneReleaseNegativeMarkerSaveMutation(
      releaseMutationCacheRefreshCustom
    );
  const [releaseNegativeMarkerDestroy] =
    GQL.useSceneReleaseNegativeMarkerDestroyMutation(
      releaseMutationCacheRefreshCustom
    );
  const { sceneId, releaseId } = owner;

  return useMemo(() => {
    const target = { sceneId, releaseId };

    return {
      async saveMarker(
        values: ISceneMarkerOwnerValuesCustom,
        options?: ISaveOptionsCustom & { id?: string }
      ): Promise<string | undefined> {
        const request = buildSceneMarkerSaveCustom(target, values, options?.id);
        const refresh = deferredRefreshCustom(options);
        if (request.kind === "release-save") {
          const result = await releaseMarkerSave({
            ...refresh,
            variables: { input: request.input },
          });
          return result.data?.sceneReleaseMarkerSave.id;
        }
        if (request.kind === "scene-update") {
          const result = await sceneMarkerUpdate({
            ...refresh,
            variables: request.variables,
          });
          return result.data?.sceneMarkerUpdate?.id;
        }
        const result = await sceneMarkerCreate({
          ...refresh,
          variables: request.variables,
        });
        return result.data?.sceneMarkerCreate?.id;
      },

      async destroyMarker(id: string) {
        const request = buildSceneMarkerDestroyCustom(target, id);
        if (request.kind === "release") {
          await releaseMarkerDestroy({ variables: request.variables });
        } else {
          await sceneMarkerDestroy({ variables: request.variables });
        }
      },

      async saveNegativeMarker(
        patch: ISceneNegativeMarkerOwnerPatchCustom,
        options?: ISaveOptionsCustom & {
          id?: string;
          existing?: Pick<
            GQL.SceneNegativeMarker,
            "name" | "start_seconds" | "end_seconds"
          >;
        }
      ): Promise<string | undefined> {
        const request = buildSceneNegativeMarkerSaveCustom(
          target,
          patch,
          options?.id
            ? { id: options.id, existing: options.existing }
            : undefined
        );
        const refresh = deferredRefreshCustom(options);
        if (request.kind === "release-save") {
          const result = await releaseNegativeMarkerSave({
            ...refresh,
            variables: { input: request.input },
          });
          return result.data?.sceneReleaseNegativeMarkerSave.id;
        }
        if (request.kind === "scene-update") {
          const result = await sceneNegativeMarkerUpdate({
            ...refresh,
            variables: { input: request.input },
          });
          return result.data?.sceneNegativeMarkerUpdate?.id;
        }
        const result = await sceneNegativeMarkerCreate({
          ...refresh,
          variables: { input: request.input },
        });
        return result.data?.sceneNegativeMarkerCreate?.id;
      },

      async destroyNegativeMarker(id: string) {
        const request = buildSceneNegativeMarkerDestroyCustom(target, id);
        if (request.kind === "release") {
          await releaseNegativeMarkerDestroy({ variables: request.variables });
        } else {
          await sceneNegativeMarkerDestroy({ variables: request.variables });
        }
      },
    };
  }, [
    releaseId,
    releaseMarkerDestroy,
    releaseMarkerSave,
    releaseNegativeMarkerDestroy,
    releaseNegativeMarkerSave,
    sceneId,
    sceneMarkerCreate,
    sceneMarkerDestroy,
    sceneMarkerUpdate,
    sceneNegativeMarkerCreate,
    sceneNegativeMarkerDestroy,
    sceneNegativeMarkerUpdate,
  ]);
}
