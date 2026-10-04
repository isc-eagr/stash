import { ApolloLink } from "@apollo/client";
import { getMainDefinition } from "@apollo/client/utilities";

const listeners = new Set<() => void>();
const catalogMutation =
  /^(?:bulk)?(?:scene(?:Marker)?|image|gallery|gallerie|performer|studio|group|movie|tag)s?(?:Create|Update|Destroy|Merge)$/i;
const customMutation =
  /^(?:taskProgress(?:Tracker|Milestone)|sceneReleaseMarker(?:Save|Destroy))/i;

export function subscribeTaskProgressChanges(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Observe committed writes regardless of which catalog or mutation hook made them. */
export function createTaskProgressMutationLink() {
  return new ApolloLink((operation, forward) => {
    const definition = getMainDefinition(operation.query);
    const affectsProgress =
      definition.kind === "OperationDefinition" &&
      definition.operation === "mutation" &&
      definition.selectionSet.selections.some(
        (field) =>
          field.kind === "Field" &&
          (catalogMutation.test(field.name.value) ||
            customMutation.test(field.name.value))
      );

    return forward(operation).map((result) => {
      if (
        affectsProgress &&
        !result.errors?.length &&
        result.data &&
        Object.values(result.data).some(
          (value) => value != null && value !== false
        )
      ) {
        listeners.forEach((listener) => listener());
      }
      return result;
    });
  });
}
