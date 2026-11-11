import * as GQL from "src/core/generated-graphql";
import { getClient } from "src/core/StashService";

// queryScrapeScene for a release: stash-box matches the release's file
// fingerprints and scrapers read the release's own metadata.
export const queryScrapeSceneReleaseCustom = (
  source: GQL.ScraperSourceInput,
  releaseId: string
) =>
  getClient().query<GQL.ScrapeSingleSceneQuery>({
    query: GQL.ScrapeSingleSceneDocument,
    variables: {
      source,
      input: {
        release_id: releaseId,
      },
    },
    fetchPolicy: "network-only",
  });
