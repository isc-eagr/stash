import React, { useCallback } from "react";
import * as GQL from "src/core/generated-graphql";
import { SceneMarkerList } from "src/components/Scenes/SceneMarkerList";
import { ListFilterModel } from "src/models/list-filter/filter";
import { MarkerPerformersCriterion } from "src/models/list-filter/criteria/marker-performers";
import { View } from "src/components/List/views";
import { PatchComponent } from "src/patch";

interface IPerformerMarkersPanelProps {
  active: boolean;
  performer: GQL.PerformerDataFragment;
}

export const PerformerMarkersPanel: React.FC<IPerformerMarkersPanelProps> =
  PatchComponent("PerformerMarkersPanel", ({ active, performer }) => {
    const filterHook = useCallback(
      (filter: ListFilterModel) => {
        const next = filter.clone();

        const performerValue = {
          id: performer.id,
          label: performer.name ?? `Performer ${performer.id}`,
        };

        let criterion = next.criteria.find(
          (c) => c.criterionOption.type === "marker_performers"
        ) as MarkerPerformersCriterion | undefined;

        if (!criterion) {
          criterion = next.makeCriterion(
            "marker_performers"
          ) as MarkerPerformersCriterion;
          next.criteria.push(criterion);
        }

        // Force this panel to only show markers directly assigned to this performer (top or bottom).
        criterion.modifier = GQL.CriterionModifier.Includes;
        criterion.value.performer_mode = "OR";
        criterion.value.top_performer_ids = [performerValue];
        criterion.value.bottom_performer_ids = [performerValue];

        return next;
      },
      [performer]
    );

    return (
      <SceneMarkerList
        filterHook={filterHook}
        alterQuery={active}
        view={View.PerformerMarkers}
      />
    );
  });
