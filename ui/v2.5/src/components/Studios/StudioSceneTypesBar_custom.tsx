import React from "react";
import NavUtils from "src/utils/navigation";
import { SceneTypesBar } from "src/components/Shared/SceneTypesBar_custom";
import type { IStudioSceneTypeCountsCustom } from "./studioSceneTypes_custom";
import type { IRoleTags } from "./StudioCard";

interface IProps {
  counts?: IStudioSceneTypeCountsCustom | null;
  studio: { id: string; name: string };
  roleTags: IRoleTags;
  performerId?: string;
  includeChildStudios?: boolean;
  activeSortBy?: string;
  className?: string;
}

export const StudioSceneTypesBar: React.FC<IProps> = ({
  counts,
  studio,
  roleTags,
  performerId,
  activeSortBy,
  className,
  includeChildStudios = false,
}) => (
  <SceneTypesBar
    activeSortBy={activeSortBy}
    className={className}
    counts={counts}
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
);
