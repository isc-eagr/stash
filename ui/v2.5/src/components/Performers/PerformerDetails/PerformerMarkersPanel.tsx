import React, { useCallback } from "react";
import * as GQL from "src/core/generated-graphql";
import { FilteredSceneMarkerList } from "src/components/Scenes/SceneMarkerList";
import { ListFilterModel } from "src/models/list-filter/filter";
import { MarkerPerformersCriterion } from "src/models/list-filter/criteria/marker-performers";
import { markerGroupsNameVatoCustom } from "src/models/list-filter/criteria/marker-group_custom";
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
          label: performer.name ?? `Vato ${performer.id}`,
        };

        let criterion = next.criteria.find(
          (c) => c.criterionOption.type === "marker_performers"
        ) as MarkerPerformersCriterion | undefined;

        // CUSTOM: keep a role filter that already names him, e.g. Vato
        // Detail facial, Nut, and Feet links.
        if (
          criterion &&
          markerGroupsNameVatoCustom(criterion.getGroups(), performer.id)
        ) {
          return next;
        }

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
      <FilteredSceneMarkerList
        filterHook={filterHook}
        alterQuery={active}
        view={View.PerformerMarkers}
      />
    );
  });
