import assert from "node:assert/strict";
import { ApolloLink, Observable, gql } from "@apollo/client";
import type { FetchResult } from "@apollo/client";
import {
  createTaskProgressMutationLink,
  subscribeTaskProgressChanges,
} from "../src/core/taskProgressMutationLink_custom.ts";

let refreshes = 0;
const unsubscribe = subscribeTaskProgressChanges(() => {
  refreshes++;
});
const send = async (
  query: ReturnType<typeof gql>,
  result: FetchResult = { data: { saved: true } }
) => {
  const link = ApolloLink.from([
    createTaskProgressMutationLink(),
    new ApolloLink(
      () =>
        new Observable((observer) => {
          observer.next(result);
          observer.complete();
        })
    ),
  ]);
  await new Promise<void>((resolve, reject) =>
    ApolloLink.execute(link, { query }).subscribe({
      complete: resolve,
      error: reject,
    })
  );
};

for (const field of [
  "sceneUpdate",
  "bulkSceneUpdate",
  "sceneMarkerUpdate",
  "sceneMarkersDestroy",
  "performerUpdate",
  "galleryDestroy",
  "galleriesUpdate",
  "imageUpdate",
  "studioUpdate",
  "groupUpdate",
  "tagDestroy",
  "taskProgressTrackerUpdate",
  "taskProgressMilestoneUpdate",
  "sceneReleaseMarkerSave",
  "sceneReleaseMarkerDestroy",
  "bulkMovieUpdate",
])
  await send(gql(`mutation CatalogWrite { alias: ${field} }`));
assert.equal(
  refreshes,
  16,
  "successful catalog writes refresh achievements from every section"
);
await send(
  gql`
    query ReadOnly {
      sceneUpdate
    }
  `
);
await send(
  gql`
    mutation FrequentPlayback {
      sceneSaveActivity
    }
  `
);
await send(
  gql`
    mutation OCount {
      sceneAddO
    }
  `
);
assert.equal(
  refreshes,
  16,
  "queries and frequent playback/O writes do not query progress"
);
await send(
  gql`
    mutation FailedWrite {
      sceneUpdate
    }
  `,
  { data: { saved: false } }
);
await send(
  gql`
    mutation EmptyWrite {
      sceneUpdate
    }
  `,
  { data: null }
);
await send(
  gql`
    mutation GraphQLError {
      sceneUpdate
    }
  `,
  {
    data: { saved: true },
    errors: [{ message: "failed" }],
  }
);
assert.equal(
  refreshes,
  16,
  "failed and empty results never announce optimistic achievements"
);
unsubscribe();
await send(
  gql`
    mutation AfterUnmount {
      sceneUpdate
    }
  `
);
assert.equal(refreshes, 16, "unmount removes the mutation observer");
