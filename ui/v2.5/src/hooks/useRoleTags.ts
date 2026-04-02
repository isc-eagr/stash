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
  const roleTagIds = configuration?.ui?.roleTagIds ?? {};

  const tagIdsToFetch = useMemo(() => {
    const ids: string[] = [];
    if (roleTagIds.sexTagId) ids.push(roleTagIds.sexTagId);
    if (roleTagIds.oralTagId) ids.push(roleTagIds.oralTagId);
    if (roleTagIds.soloTagId) ids.push(roleTagIds.soloTagId);
    if (roleTagIds.facialTagId) ids.push(roleTagIds.facialTagId);
    return ids;
  }, [roleTagIds]);

  const { data: tagsData } = GQL.useFindTagsForSelectQuery({
    variables: { ids: tagIdsToFetch },
    skip: tagIdsToFetch.length === 0,
  });

  return useMemo(() => {
    const allTags = tagsData?.findTags?.tags ?? [];
    return {
      sexTag: allTags.find((t) => t.id === roleTagIds.sexTagId) ?? null,
      oralTag: allTags.find((t) => t.id === roleTagIds.oralTagId) ?? null,
      soloTag: allTags.find((t) => t.id === roleTagIds.soloTagId) ?? null,
      facialTag: allTags.find((t) => t.id === roleTagIds.facialTagId) ?? null,
    };
  }, [tagsData, roleTagIds]);
}
