import React from "react";
import * as GQL from "src/core/generated-graphql";
import { FilteredSceneList } from "src/components/Scenes/SceneList";
import { useTagFilterHook } from "src/core/tags";
import { View } from "src/components/List/views";
import TextUtils from "src/utils/text"; // CUSTOM

interface ITagScenesPanel {
  active: boolean;
  tag: GQL.TagDataFragment;
  showSubTagContent?: boolean;
}

export const TagScenesPanel: React.FC<ITagScenesPanel> = ({
  active,
  tag,
  showSubTagContent,
}) => {
  const filterHook = useTagFilterHook(tag, showSubTagContent);
  // CUSTOM: show marker time beside the existing scene time/size totals.
  const { data: markerDurationData } = GQL.useTagMarkerDurationQuery({
    variables: { id: tag.id },
    skip: !active,
  });
  const markerDurationTag = markerDurationData?.findTag;
  const markerDuration = showSubTagContent
    ? markerDurationTag?.scene_marker_duration_all
    : markerDurationTag?.scene_marker_duration;
  const markerDurationByline =
    markerDuration === undefined ? undefined : (
      <span className="scene-markers-duration" key="marker-duration">
        {TextUtils.secondsAsTimeString(markerDuration, 3)} markers
      </span>
    );

  return (
    <FilteredSceneList
      additionalMetadataByline={markerDurationByline}
      filterHook={filterHook}
      alterQuery={active}
      view={View.TagScenes}
    />
  );
};
