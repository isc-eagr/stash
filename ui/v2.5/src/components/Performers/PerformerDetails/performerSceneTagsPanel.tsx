import React, { useCallback } from "react";
import * as GQL from "src/core/generated-graphql";
import { PatchComponent } from "src/patch";
import { TagList } from "src/components/Tags/TagList";
import {
  PerformerSceneTagsCriterionOption,
  TagsCriterion,
} from "src/models/list-filter/criteria/tags";
import { useApolloClient } from "@apollo/client";
import gql from "graphql-tag";

interface IPerformerDetailsProps {
  active: boolean;
  performer: GQL.PerformerDataFragment;
}

// Render the canonical TagList (same UI as /tags) for the Scene Tags tab.
// The user requested the Scene Tags tab to show the global tags exactly like the
// /tags path — so we render TagList directly. We keep the PatchComponent wrapper
// for consistency with other components.
export const PerformerSceneTagsPanel: React.FC<IPerformerDetailsProps> =
  PatchComponent("PerformerSceneTagsPanel", ({ active, performer }) => {
    if (!active) return null;

    // filterHook: restrict TagList to tags that appear in scenes for this
    // performer. We use the existing PerformerTags criterion option which
    // maps to the `performer_tags` field in the generated tag_filter input.
    const filterHook = (filter: any) => {
      try {
  // construct a tags criterion but use the PerformerSceneTagsCriterionOption
  // so the generated filter key will be `performer_scene_tags`.
  const crit = PerformerSceneTagsCriterionOption.makeCriterion() as TagsCriterion;

        // IHierarchicalLabeledIdCriterion expects a value of shape { items: ILabeledId[], excluded: [], depth }
        // We populate items with the current performer id/label so the tag query
        // returns tags associated with scenes containing this performer.
        crit.value.items = [{ id: performer.id as string, label: performer.name ?? "" }];

  // Use the exact field name added to the GraphQL TagFilterType
  // as requested by the user: `performer_scene_tags`.
  return filter.replaceCriteria("performer_scene_tags", [crit]);
      } catch (e) {
        // In case of any runtime issue, return the unmodified filter so the
        // TagList doesn't break the UI.
        return filter;
      }
    };

    const client = useApolloClient();

    const PERFORMER_TAG_SCENE_COUNTS = gql`
      query PerformerTagSceneCounts($performer_id: ID!, $tag_ids: [ID!]!) {
        performerTagSceneCounts(performer_id: $performer_id, tag_ids: $tag_ids) {
          tag_id
          count
        }
      }
    `;

    const onTags = useCallback(
      async (tags: GQL.TagDataFragment[]) => {
        try {
          if (!tags || tags.length === 0) return;
          const tagIds = tags.map((t) => t.id);
          const { data } = await client.query({
            query: PERFORMER_TAG_SCENE_COUNTS,
            variables: { performer_id: performer.id, tag_ids: tagIds },
            fetchPolicy: "network-only",
          });

          const counts: Record<string, number> = {};
          if (data?.performerTagSceneCounts) {
            for (const row of data.performerTagSceneCounts) {
              counts[row.tag_id] = row.count;
            }
          }

          // write counts into Apollo cache so TagList/TagCard read the updated scene_count
          for (const t of tags) {
            const cid = client.cache.identify({ __typename: "Tag", id: t.id });
            client.cache.writeFragment({
              id: cid as string,
              fragment: gql`fragment TagSceneCount on Tag { scene_count }`,
              data: { scene_count: counts[t.id] ?? 0 },
            });
          }
        } catch (e) {
          // ignore errors to avoid breaking the panel UI
        }
      },
      [client, performer.id]
    );

    return (
      <div className="performer-scene-tags-panel p-3">
        <TagList
          filterHook={filterHook}
          alterQuery={false}
          sceneCountOnly={true}
          onTags={onTags}
          performerId={performer.id}
          performerName={performer.name}
        />
      </div>
    );
  });
