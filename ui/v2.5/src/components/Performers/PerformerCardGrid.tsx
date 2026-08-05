import React from "react";
import { PerformerCard } from "./PerformerCard";
import type { IPerformerCardExtraCriteria } from "./PerformerCard";
import type { PerformerListData } from "./performerTypes_custom";
import { usePerformerCardRoleStats } from "./performerRoleStats_custom"; // CUSTOM
import {
  useCardWidth,
  useContainerDimensions,
} from "../Shared/GridCard/GridCard";
import { PatchComponent } from "src/patch";
import * as GQL from "src/core/generated-graphql"; // CUSTOM
import { useCatalogSortMetricValuesCustom } from "../Shared/catalogSortMetricValues_custom"; // CUSTOM

interface IPerformerCardGrid {
  performers: PerformerListData[];
  selectedIds: Set<string>;
  zoomIndex: number;
  onSelectChange: (id: string, selected: boolean, shiftKey: boolean) => void;
  extraCriteria?: IPerformerCardExtraCriteria;
  activeSortBy?: string;
  activeSortDirection?: GQL.SortDirectionEnum;
}

const zoomWidths = [240, 300, 375, 470];

export const PerformerCardGrid: React.FC<IPerformerCardGrid> = PatchComponent(
  "PerformerCardGrid",
  ({
    performers,
    selectedIds,
    zoomIndex,
    onSelectChange,
    extraCriteria,
    activeSortBy,
    activeSortDirection,
  }) => {
    const [componentRef, { width: containerWidth }] = useContainerDimensions();
    const cardWidth = useCardWidth(containerWidth, zoomIndex, zoomWidths);
    const roleStatsByPerformerID = usePerformerCardRoleStats(
      performers,
      !!extraCriteria?.studio
    ); // CUSTOM
    const sortDirection = activeSortDirection ?? GQL.SortDirectionEnum.Asc; // CUSTOM
    const activeSortValues = useCatalogSortMetricValuesCustom(
      "performer",
      performers.map((performer) => performer.id),
      activeSortBy,
      sortDirection
    ); // CUSTOM

    return (
      <div className="row justify-content-center" ref={componentRef}>
        {performers.map((p) => (
          <PerformerCard
            key={p.id}
            cardWidth={cardWidth}
            performer={p}
            zoomIndex={zoomIndex}
            selecting={selectedIds.size > 0}
            selected={selectedIds.has(p.id)}
            onSelectedChanged={(selected: boolean, shiftKey: boolean) =>
              onSelectChange(p.id, selected, shiftKey)
            }
            extraCriteria={extraCriteria}
            roleStats={roleStatsByPerformerID.get(p.id) ?? null}
            activeSortBy={activeSortBy}
            activeSortDirection={sortDirection}
            activeSortValue={activeSortValues.get(p.id)}
          />
        ))}
      </div>
    );
  }
);
