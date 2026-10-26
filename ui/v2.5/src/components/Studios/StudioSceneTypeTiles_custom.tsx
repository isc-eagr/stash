import React from "react";
import NavUtils from "src/utils/navigation";
import { SceneTypeTiles } from "src/components/Shared/SceneTypeTiles_custom";
import type { PerformerRoleTileSize } from "src/components/Performers/PerformerDetails/performerRoleTiles_custom";
import type { IStudioSceneTypeCountsCustom } from "./studioSceneTypes_custom";
import type { IRoleTags } from "./StudioCard";

interface IProps {
  counts?: IStudioSceneTypeCountsCustom | null;
  studio: { id: string; name: string };
  roleTags: IRoleTags;
  size: PerformerRoleTileSize;
  caption?: boolean;
  performerId?: string;
  includeChildStudios?: boolean;
  activeSortBy?: string;
  className?: string;
}

// Hidden when the studio has no Sex, Oral, or Solo scenes.
export const StudioSceneTypeTiles: React.FC<IProps> = ({
  counts,
  studio,
  roleTags,
  size,
  caption,
  performerId,
  activeSortBy,
  className,
  includeChildStudios = false,
}) =>
  counts &&
  counts.sex_scene_count + counts.oral_scene_count + counts.solo_scene_count >
    0 ? (
    <SceneTypeTiles
      activeSortBy={activeSortBy}
      caption={caption}
      className={className}
      counts={counts}
      size={size}
      getUrl={(key, label) => {
        const tag = roleTags[`${key}Tag`];
        if (!tag) return undefined;
        const excludeTags =
          key === "sex"
            ? []
            : [roleTags.sexTag, ...(key === "solo" ? [roleTags.oralTag] : [])]
                .filter((value): value is NonNullable<typeof value> => !!value)
                .map((value) => ({ id: value.id, label: value.name }));
        return performerId
          ? NavUtils.makePerformerStudioMarkerScenesUrl(
              performerId,
              studio,
              tag.id,
              label,
              excludeTags,
              key === "oral" ? -1 : 0
            )
          : NavUtils.makeStudioMarkerScenesUrl(
              studio,
              tag.id,
              label,
              excludeTags,
              key === "oral" ? -1 : 0,
              includeChildStudios ? -1 : 0
            );
      }}
    />
  ) : null;
