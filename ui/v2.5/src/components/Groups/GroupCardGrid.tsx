import React from "react";
import * as GQL from "src/core/generated-graphql";
import { GroupCard } from "./GroupCard";
import {
  useCardWidth,
  useContainerDimensions,
} from "../Shared/GridCard/GridCard";
import { PatchComponent } from "src/patch";
import { useCatalogSortMetricValuesCustom } from "../Shared/catalogSortMetricValues_custom"; // CUSTOM

interface IGroupCardGrid {
  groups: GQL.ListGroupDataFragment[];
  selectedIds: Set<string>;
  zoomIndex: number;
  onSelectChange: (id: string, selected: boolean, shiftKey: boolean) => void;
  fromGroupId?: string;
  onMove?: (srcIds: string[], targetId: string, after: boolean) => void;
  activeSortBy?: string; // CUSTOM
  activeSortDirection?: GQL.SortDirectionEnum; // CUSTOM
}

const zoomWidths = [210, 250, 300, 375];

export const GroupCardGrid: React.FC<IGroupCardGrid> = PatchComponent(
  "GroupCardGrid",
  ({
    groups,
    selectedIds,
    zoomIndex,
    onSelectChange,
    fromGroupId,
    onMove,
    activeSortBy,
    activeSortDirection,
  }) => {
    const [componentRef, { width: containerWidth }] = useContainerDimensions();
    const cardWidth = useCardWidth(containerWidth, zoomIndex, zoomWidths);
    const sortDirection = activeSortDirection ?? GQL.SortDirectionEnum.Asc; // CUSTOM
    const activeSortValues = useCatalogSortMetricValuesCustom(
      "group",
      groups.map((group) => group.id),
      activeSortBy,
      sortDirection,
      fromGroupId
    ); // CUSTOM

    return (
      <div className="row justify-content-center" ref={componentRef}>
        {groups.map((p) => (
          <GroupCard
            key={p.id}
            cardWidth={cardWidth}
            group={p}
            zoomIndex={zoomIndex}
            selecting={selectedIds.size > 0}
            selected={selectedIds.has(p.id)}
            onSelectedChanged={(selected: boolean, shiftKey: boolean) =>
              onSelectChange(p.id, selected, shiftKey)
            }
            fromGroupId={fromGroupId}
            onMove={onMove}
            activeSortBy={activeSortBy} // CUSTOM
            activeSortDirection={sortDirection} // CUSTOM
            activeSortValue={activeSortValues.get(p.id)} // CUSTOM
          />
        ))}
      </div>
    );
  }
);
