import React from "react";
import * as GQL from "src/core/generated-graphql";
import {
  useCardWidth,
  useContainerDimensions,
} from "../Shared/GridCard/GridCard";
import { StudioCard } from "./StudioCard";
import { PatchComponent } from "src/patch";
import { useRoleTags } from "src/hooks/useRoleTags"; // CUSTOM

interface IStudioCardGrid {
  studios: GQL.StudioListDataFragment[]; // CUSTOM
  statsByStudioID: ReadonlyMap<string, GQL.StudioListStatsDataFragment>; // CUSTOM
  fromParent: boolean | undefined;
  selectedIds: Set<string>;
  zoomIndex: number;
  onSelectChange: (id: string, selected: boolean, shiftKey: boolean) => void;
  performerId?: string; // CUSTOM
}

const zoomWidths = [280, 340, 420, 560];

export const StudioCardGrid: React.FC<IStudioCardGrid> = PatchComponent(
  "StudioCardGrid",
  ({
    studios,
    statsByStudioID, // CUSTOM
    fromParent,
    selectedIds,
    zoomIndex,
    onSelectChange,
    performerId, // CUSTOM
  }) => {
    const [componentRef, { width: containerWidth }] = useContainerDimensions();
    const cardWidth = useCardWidth(containerWidth, zoomIndex, zoomWidths);

    // CUSTOM: Single query for just the role tags (shared hook, Apollo-cached)
    const roleTags = useRoleTags(); // CUSTOM

    return (
      <div className="row justify-content-center" ref={componentRef}>
        {studios.map((studio) => (
          <StudioCard
            key={studio.id}
            cardWidth={cardWidth}
            studio={studio}
            stats={statsByStudioID.get(studio.id)} // CUSTOM
            zoomIndex={zoomIndex}
            hideParent={fromParent}
            selecting={selectedIds.size > 0}
            selected={selectedIds.has(studio.id)}
            onSelectedChanged={(selected: boolean, shiftKey: boolean) =>
              onSelectChange(studio.id, selected, shiftKey)
            }
            performerId={performerId} // CUSTOM
            roleTags={roleTags} // CUSTOM
          />
        ))}
      </div>
    );
  }
);
