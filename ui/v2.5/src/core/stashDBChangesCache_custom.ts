// CUSTOM: keeps the cached StashDB Changes report in step with applies.
import { ApolloCache } from "@apollo/client";
import * as GQL from "./generated-graphql";

type SceneEntry = GQL.StashDbSceneChangeDataFragment;
type PerformerEntry = GQL.StashDbPerformerChangeDataFragment;

// Replaces the applied entry. A changed entry with no fields left drops out,
// as it does on the backend.
export function replaceStashDBChangeCustom<
  T extends { stash_id: string; status: string; fields: readonly unknown[] }
>(entries: readonly T[], entry: T, entityID: (e: T) => string) {
  const same = (e: T) =>
    entityID(e) === entityID(entry) && e.stash_id === entry.stash_id;
  if (entry.status === "CHANGED" && entry.fields.length === 0) {
    return entries.filter((e) => !same(e));
  }
  return entries.map((e) => (same(e) ? entry : e));
}

export function updateStashDBChangesReportCustom(
  cache: ApolloCache<unknown>,
  entry: SceneEntry | PerformerEntry
) {
  cache.updateQuery<GQL.StashDbChangesReportQuery>(
    { query: GQL.StashDbChangesReportDocument },
    (data) => {
      if (!data) return data;
      const report = data.stashDBChangesReport;
      if ("scene" in entry) {
        return {
          stashDBChangesReport: {
            ...report,
            scenes: replaceStashDBChangeCustom(
              report.scenes,
              entry,
              (e) => e.scene.id
            ),
          },
        };
      }
      return {
        stashDBChangesReport: {
          ...report,
          performers: replaceStashDBChangeCustom(
            report.performers,
            entry,
            (e) => e.performer.id
          ),
        },
      };
    }
  );
}
