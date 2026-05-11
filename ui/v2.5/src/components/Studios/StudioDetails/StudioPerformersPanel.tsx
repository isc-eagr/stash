import React from "react";
import * as GQL from "src/core/generated-graphql";
import { useStudioFilterHook } from "src/core/studios";
import { FilteredPerformerList } from "src/components/Performers/PerformerList";
import { StudiosCriterion } from "src/models/list-filter/criteria/studios";
import { View } from "src/components/List/views";

interface IStudioPerformersPanel {
  active: boolean;
  studio: GQL.StudioDataFragment;
  showChildStudioContent?: boolean;
}

export const StudioPerformersPanel: React.FC<IStudioPerformersPanel> = ({
  active,
  studio,
  showChildStudioContent,
}) => {
  const studioDepth = showChildStudioContent ? -1 : 0;
  const studioCriterion = new StudiosCriterion();
  studioCriterion.value = {
    items: [{ id: studio.id!, label: studio.name || `Studio ${studio.id}` }],
    excluded: [],
    depth: studioDepth,
  };

  const extraCriteria = {
    scenes: [studioCriterion],
    images: [studioCriterion],
    galleries: [studioCriterion],
    groups: [studioCriterion],
    studio: {
      id: studio.id,
      label: studio.name || `Studio ${studio.id}`,
      depth: studioDepth,
    },
  };

  const filterHook = useStudioFilterHook(studio, showChildStudioContent);

  return (
    <FilteredPerformerList
      filterHook={filterHook}
      extraCriteria={extraCriteria}
      alterQuery={active}
      view={View.StudioPerformers}
    />
  );
};
