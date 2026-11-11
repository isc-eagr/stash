import type * as GQL from "src/core/generated-graphql";

// Markers and skip ranges belong to a scene or to one of its releases. The
// marker tabs keep one set of tools and send each write to the owner's
// operation; these builders shape that operation's input.
export interface ISceneMarkerOwnerCustom {
  sceneId: string;
  releaseId?: string;
}

export interface ISceneMarkerOwnerValuesCustom {
  title: string;
  seconds: number;
  end_seconds?: number | null;
  primary_tag_id: string;
  tag_ids: string[];
  top_performer_ids: string[];
  bottom_performer_ids: string[];
}

export interface ISceneNegativeMarkerOwnerPatchCustom {
  name?: string;
  start_seconds?: number;
  end_seconds?: number;
}

type MarkerSourceCustom = Pick<
  GQL.SceneMarkerDataFragment,
  "title" | "seconds" | "end_seconds" | "primary_tag" | "tags"
> & {
  top_performers?: Array<{ id: string }> | null;
  bottom_performers?: Array<{ id: string }> | null;
};

type NegativeMarkerSourceCustom = Pick<
  GQL.SceneNegativeMarker,
  "name" | "start_seconds" | "end_seconds"
>;

export const SCENE_MARKER_PRIMARY_TAG_REQUIRED = "Choose a primary tag.";
export const SCENE_NEGATIVE_MARKER_RANGE_REQUIRED =
  "Enter a start and end time.";

export type SceneMarkerSaveRequestCustom =
  | { kind: "scene-create"; variables: GQL.SceneMarkerCreateMutationVariables }
  | { kind: "scene-update"; variables: GQL.SceneMarkerUpdateMutationVariables }
  | { kind: "release-save"; input: GQL.SceneReleaseMarkerInput };

export type SceneMarkerDestroyRequestCustom =
  | { kind: "scene"; variables: GQL.SceneMarkerDestroyMutationVariables }
  | {
      kind: "release";
      variables: GQL.SceneReleaseMarkerDestroyMutationVariables;
    };

export type SceneNegativeMarkerSaveRequestCustom =
  | { kind: "scene-create"; input: GQL.SceneNegativeMarkerCreateInput }
  | { kind: "scene-update"; input: GQL.SceneNegativeMarkerUpdateInput }
  | { kind: "release-save"; input: GQL.SceneReleaseNegativeMarkerInput };

export type SceneNegativeMarkerDestroyRequestCustom =
  | {
      kind: "scene";
      variables: GQL.SceneNegativeMarkerDestroyMutationVariables;
    }
  | {
      kind: "release";
      variables: GQL.SceneReleaseNegativeMarkerDestroyMutationVariables;
    };

// Copies a saved marker's fields so a split or gap fix can resave it.
export function sceneMarkerValuesFromMarkerCustom(
  marker: MarkerSourceCustom,
  overrides: Partial<ISceneMarkerOwnerValuesCustom> = {}
): ISceneMarkerOwnerValuesCustom {
  return {
    title: marker.title,
    seconds: marker.seconds,
    end_seconds: marker.end_seconds ?? null,
    primary_tag_id: marker.primary_tag.id,
    tag_ids: marker.tags.map((tag) => tag.id),
    top_performer_ids:
      marker.top_performers?.map((performer) => performer.id) ?? [],
    bottom_performer_ids:
      marker.bottom_performers?.map((performer) => performer.id) ?? [],
    ...overrides,
  };
}

export function buildSceneMarkerSaveCustom(
  owner: ISceneMarkerOwnerCustom,
  values: ISceneMarkerOwnerValuesCustom,
  id?: string
): SceneMarkerSaveRequestCustom {
  const fields = {
    title: values.title,
    seconds: values.seconds,
    end_seconds: values.end_seconds ?? null,
    primary_tag_id: values.primary_tag_id,
    tag_ids: values.tag_ids,
    top_performer_ids: values.top_performer_ids,
    bottom_performer_ids: values.bottom_performer_ids,
  };

  if (owner.releaseId) {
    if (!values.primary_tag_id) {
      throw new Error(SCENE_MARKER_PRIMARY_TAG_REQUIRED);
    }
    return {
      kind: "release-save",
      input: { release_id: owner.releaseId, id, ...fields },
    };
  }

  if (id) {
    return {
      kind: "scene-update",
      variables: { id, scene_id: owner.sceneId, ...fields },
    };
  }

  return {
    kind: "scene-create",
    variables: { scene_id: owner.sceneId, ...fields },
  };
}

export function buildSceneMarkerDestroyCustom(
  owner: ISceneMarkerOwnerCustom,
  id: string
): SceneMarkerDestroyRequestCustom {
  return owner.releaseId
    ? {
        kind: "release",
        variables: { release_id: owner.releaseId, marker_id: id },
      }
    : { kind: "scene", variables: { id } };
}

// Scene skip ranges accept partial updates; a release save needs every field,
// so a partial release update is completed from the saved range.
export function buildSceneNegativeMarkerSaveCustom(
  owner: ISceneMarkerOwnerCustom,
  patch: ISceneNegativeMarkerOwnerPatchCustom,
  target?: { id: string; existing?: NegativeMarkerSourceCustom }
): SceneNegativeMarkerSaveRequestCustom {
  if (!owner.releaseId && target) {
    return { kind: "scene-update", input: { id: target.id, ...patch } };
  }

  const merged = { ...target?.existing, ...patch };
  if (merged.start_seconds === undefined || merged.end_seconds === undefined) {
    throw new Error(SCENE_NEGATIVE_MARKER_RANGE_REQUIRED);
  }
  const fields = {
    name: merged.name ?? "",
    start_seconds: merged.start_seconds,
    end_seconds: merged.end_seconds,
  };

  if (owner.releaseId) {
    return {
      kind: "release-save",
      input: { release_id: owner.releaseId, id: target?.id, ...fields },
    };
  }

  return {
    kind: "scene-create",
    input: { scene_id: owner.sceneId, ...fields },
  };
}

export function buildSceneNegativeMarkerDestroyCustom(
  owner: ISceneMarkerOwnerCustom,
  id: string
): SceneNegativeMarkerDestroyRequestCustom {
  return owner.releaseId
    ? {
        kind: "release",
        variables: { release_id: owner.releaseId, marker_id: id },
      }
    : { kind: "scene", variables: { id } };
}
