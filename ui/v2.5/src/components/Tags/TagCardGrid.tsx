import React from "react";
import * as GQL from "src/core/generated-graphql";
import {
  useCardWidth,
  useContainerDimensions,
} from "../Shared/GridCard/GridCard";
import { TagCard } from "./TagCard";
import { PatchComponent } from "src/patch";
import { useCatalogSortMetricValuesCustom } from "../Shared/catalogSortMetricValues_custom"; // CUSTOM

interface ITagCardGrid {
  tags: (GQL.TagDataFragment | GQL.TagListDataFragment)[];
  selectedIds: Set<string>;
  zoomIndex: number;
  onSelectChange: (id: string, selected: boolean, shiftKey: boolean) => void;
  // CUSTOM: begin
  sceneCountOnly?: boolean;
  performerId?: string;
  performerName?: string;
  activeSortBy?: string;
  activeSortDirection?: GQL.SortDirectionEnum;
  // CUSTOM: end
}

const zoomWidths = [280, 340, 480, 640];

export const TagCardGrid: React.FC<ITagCardGrid> = PatchComponent(
  "TagCardGrid",
  ({
    tags,
    selectedIds,
    zoomIndex,
    onSelectChange,
    // CUSTOM: begin
    sceneCountOnly = false,
    performerId,
    performerName,
    activeSortBy,
    activeSortDirection,
    // CUSTOM: end
  }) => {
    const [componentRef, { width: containerWidth }] = useContainerDimensions();
    const cardWidth = useCardWidth(containerWidth, zoomIndex, zoomWidths);
    const sortDirection = activeSortDirection ?? GQL.SortDirectionEnum.Asc; // CUSTOM
    const activeSortValues = useCatalogSortMetricValuesCustom(
      "tag",
      tags.map((tag) => tag.id),
      activeSortBy,
      sortDirection
    ); // CUSTOM

    return (
      <div className="row justify-content-center" ref={componentRef}>
        {tags.map((tag) => (
          <TagCard
            key={tag.id}
            cardWidth={cardWidth}
            tag={tag}
            zoomIndex={zoomIndex}
            selecting={selectedIds.size > 0}
            selected={selectedIds.has(tag.id)}
            onSelectedChanged={(selected: boolean, shiftKey: boolean) =>
              onSelectChange(tag.id, selected, shiftKey)
            }
            sceneCountOnly={sceneCountOnly} // CUSTOM
            performerId={performerId} // CUSTOM
            performerName={performerName} // CUSTOM
            activeSortBy={activeSortBy} // CUSTOM
            activeSortDirection={sortDirection} // CUSTOM
            activeSortValue={activeSortValues.get(tag.id)} // CUSTOM
          />
        ))}
      </div>
    );
  }
);
