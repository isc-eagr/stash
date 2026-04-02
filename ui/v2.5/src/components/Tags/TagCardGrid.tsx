import React from "react";
import * as GQL from "src/core/generated-graphql";
import {
  useCardWidth,
  useContainerDimensions,
} from "../Shared/GridCard/GridCard";
import { TagCard } from "./TagCard";
import { PatchComponent } from "src/patch";

interface ITagCardGrid {
  tags: (GQL.TagDataFragment | GQL.TagListDataFragment)[];
  selectedIds: Set<string>;
  zoomIndex: number;
  onSelectChange: (id: string, selected: boolean, shiftKey: boolean) => void;
  sceneCountOnly?: boolean;
  performerId?: string;
  performerName?: string;
}

const zoomWidths = [280, 340, 480, 640];

export const TagCardGrid: React.FC<ITagCardGrid> = PatchComponent(
  "TagCardGrid",
  ({
    tags,
    selectedIds,
    zoomIndex,
    onSelectChange,
    sceneCountOnly = false,
    performerId,
    performerName,
  }) => {
    const [componentRef, { width: containerWidth }] = useContainerDimensions();
    const cardWidth = useCardWidth(containerWidth, zoomIndex, zoomWidths);

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
            sceneCountOnly={sceneCountOnly}
            performerId={performerId}
            performerName={performerName}
          />
        ))}
      </div>
    );
  }
);
