import * as GQL from "src/core/generated-graphql";
import { releaseMutationCacheRefreshCustom } from "src/core/sceneReleaseCache_custom";

// Release activity is stored independently. Refresh the scene detail after
// discrete history events so the returned timestamps and rating stay exact.
export const useSceneReleaseSaveActivityCustom = () =>
  GQL.useSceneReleaseSaveActivityMutation({
    update(cache, result, { variables }) {
      if (!result.data?.sceneReleaseSaveActivity || !variables) return;
      cache.modify({
        id: cache.identify({ __typename: "SceneRelease", id: variables.id }),
        fields: {
          resume_time(value) {
            return variables.resume_time ?? value;
          },
          play_duration(value) {
            return value + (variables.play_duration ?? 0);
          },
        },
      });
    },
  });

export const useSceneReleaseAddPlayCustom = () =>
  GQL.useSceneReleaseAddPlayMutation({
    ...releaseMutationCacheRefreshCustom,
  });

export const useSceneReleaseRecordOCustom = () =>
  GQL.useSceneReleaseRecordOAtTimestampMutation({
    ...releaseMutationCacheRefreshCustom,
  });

export const useSceneReleaseEditHistoryCustom = () =>
  GQL.useSceneReleaseEditHistoryMutation({
    ...releaseMutationCacheRefreshCustom,
  });

export const useSceneReleaseResetActivityCustom = () =>
  GQL.useSceneReleaseResetActivityMutation({
    ...releaseMutationCacheRefreshCustom,
  });
