import { faUser } from "@fortawesome/free-solid-svg-icons";
import React, { useMemo } from "react";
import { Button } from "react-bootstrap";
import * as GQL from "src/core/generated-graphql";
import { sortPerformers } from "src/core/performers";
import { HoverPopover } from "../Shared/HoverPopover";
import { Icon } from "../Shared/Icon";
import {
  ActivityTypePerformerTile,
  HighlightPerformerTagPills,
} from "./SceneDetails/sceneMarkerHoverPopover_custom";
import {
  getSceneMarkerPerformerTagSummaries,
  type ISceneMarkerChronologyHighlightPerformer,
} from "./SceneDetails/sceneMarkerChronologySearch_custom";

interface IProps {
  scene: GQL.SlimSceneDataFragment;
}

export const SceneCardPerformerPopover: React.FC<IProps> = ({ scene }) => {
  const performers = useMemo(() => {
    const markerSummaries = getSceneMarkerPerformerTagSummaries(
      scene.scene_markers
    );
    const markerSummariesByPerformerID = new Map(
      markerSummaries.map((summary) => [summary.performer.id, summary])
    );

    return sortPerformers(scene.performers).map(
      (performer) =>
        markerSummariesByPerformerID.get(performer.id) ??
        ({
          performer,
          topTags: [],
          bottomTags: [],
          topOverlapTagIDs: new Set(),
          bottomOverlapTagIDs: new Set(),
        } as ISceneMarkerChronologyHighlightPerformer<
          GQL.SlimSceneDataFragment["scene_markers"][number]
        >)
    );
  }, [scene.performers, scene.scene_markers]);

  const popoverContent = (
    <div className="scene-marker-highlight-popover-card">
      <div className="scene-marker-activity-config-performers">
        {performers.map((performer) => (
          <ActivityTypePerformerTile
            key={performer.performer.id}
            performer={performer.performer}
            className="scene-marker-highlight-performer"
          >
            <HighlightPerformerTagPills performer={performer} />
          </ActivityTypePerformerTile>
        ))}
      </div>
    </div>
  );

  return (
    <HoverPopover
      className="performer-count"
      placement="bottom"
      popoverClassName="scene-marker-highlight-popover"
      content={popoverContent}
    >
      <Button className="minimal">
        <Icon icon={faUser} />
        <span>{scene.performers.length}</span>
      </Button>
    </HoverPopover>
  );
};
