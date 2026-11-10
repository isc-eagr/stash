import { useMemo } from "react";
import * as GQL from "src/core/generated-graphql";
import { useConfigurationContext } from "src/hooks/Config";
import { IRoleTags } from "src/components/Studios/StudioCard";

/**
 * Shared hook to fetch role tag objects (sex, oral, solo, facial) from configuration.
 * Queries only the specific tag IDs needed (not all tags).
 * Apollo caches the result, so multiple callers won't trigger duplicate requests.
 */
export function useRoleTags(): IRoleTags {
  const { configuration } = useConfigurationContext();
  const { sexTagId, oralTagId, soloTagId, facialTagId } =
    configuration?.ui?.roleTagIds ?? {};

  const tagIdsToFetch = useMemo(() => {
    const ids: string[] = [];
    if (sexTagId) ids.push(sexTagId);
    if (oralTagId) ids.push(oralTagId);
    if (soloTagId) ids.push(soloTagId);
    if (facialTagId) ids.push(facialTagId);
    return ids;
  }, [sexTagId, oralTagId, soloTagId, facialTagId]);

  const { data: tagsData } = GQL.useFindTagsForSelectQuery({
    variables: { ids: tagIdsToFetch },
    skip: tagIdsToFetch.length === 0,
  });

  return useMemo(() => {
    const allTags = tagsData?.findTags?.tags ?? [];
    return {
      sexTag: allTags.find((t) => t.id === sexTagId) ?? null,
      oralTag: allTags.find((t) => t.id === oralTagId) ?? null,
      soloTag: allTags.find((t) => t.id === soloTagId) ?? null,
      facialTag: allTags.find((t) => t.id === facialTagId) ?? null,
    };
  }, [tagsData, sexTagId, oralTagId, soloTagId, facialTagId]);
}
