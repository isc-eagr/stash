import React from "react";
import * as GQL from "src/core/generated-graphql";
import { PatchComponent } from "src/patch";
import { FilteredStudioList } from "src/components/Studios/StudioList";
import { ListFilterModel } from "src/models/list-filter/filter";
import { CriterionModifier } from "src/core/generated-graphql";

interface IPerformerDetailsProps {
  active: boolean;
  performer: GQL.PerformerDataFragment;
}

// Panel showing studios that the performer has scenes in
export const PerformerStudiosPanel: React.FC<IPerformerDetailsProps> =
  PatchComponent("PerformerStudiosPanel", ({ active, performer }) => {
    if (!active) return null;

    // filterHook: restrict StudioList to studios that have scenes with this performer
    // StudioFilterType uses scenes_filter (nested SceneFilterType) to filter by performer
    const filterHook = (filter: ListFilterModel) => {
      filter.currentPage = 1;

      // Set scenes_filter directly on the filter's customCriteria or extraCriteria
      // We use the overrideFilter to inject the scenes_filter with performer criterion
      const originalMakeFilter = filter.makeFilter.bind(filter);
      filter.makeFilter = () => {
        const baseFilter = originalMakeFilter();
        return {
          ...baseFilter,
          scenes_filter: {
            performers: {
              value: [performer.id],
              modifier: CriterionModifier.Includes,
            },
          },
        };
      };

      return filter;
    };

    return (
      <div className="performer-studios-panel">
        <FilteredStudioList filterHook={filterHook} performerId={performer.id} />
      </div>
    );
  });
