import { gql, useQuery } from "@apollo/client";
import * as GQL from "src/core/generated-graphql";

// Fetch only the IDs needed to recognize descendant orgasm marker tags.
// FindTags includes recursive count fields that are expensive on every scene list load.
const OrgasmTagDescendantIdsQuery = gql`
  query OrgasmTagDescendantIds(
    $filter: FindFilterType
    $tag_filter: TagFilterType
  ) {
    findTags(filter: $filter, tag_filter: $tag_filter) {
      tags {
        id
      }
    }
  }
`;

interface IOrgasmTagDescendantIdsData {
  findTags: {
    tags: Array<{ id: string }>;
  };
}

interface IOrgasmTagDescendantIdsVariables {
  filter: GQL.FindFilterType;
  tag_filter: GQL.TagFilterType;
}

export function useOrgasmTagDescendantIds(
  orgasmTagId: string | undefined,
  skip: boolean
) {
  return useQuery<
    IOrgasmTagDescendantIdsData,
    IOrgasmTagDescendantIdsVariables
  >(OrgasmTagDescendantIdsQuery, {
    variables: {
      filter: { per_page: 5000 },
      tag_filter: {
        parents: {
          modifier: GQL.CriterionModifier.Includes,
          value: orgasmTagId ? [orgasmTagId] : [],
          depth: -1,
        },
      },
    },
    skip: skip || !orgasmTagId,
  });
}
