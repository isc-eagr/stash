import { faStar, faUser } from "@fortawesome/free-solid-svg-icons";
import React, { useMemo } from "react";
import { Button } from "react-bootstrap";
import * as GQL from "src/core/generated-graphql";
import { sortPerformers } from "src/core/performers";
import { useConfigurationContext } from "src/hooks/Config";
import {
  getRatingCardClass,
  isRatingCardHomePage,
} from "src/utils/ratingCardStyles_custom";
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
import cx from "classnames";

interface IProps {
  scene: GQL.SlimSceneDataFragment;
  className?: string;
}

type SceneCardPerformerSummary = Omit<
  ISceneMarkerChronologyHighlightPerformer<
    GQL.SlimSceneDataFragment["scene_markers"][number]
  >,
  "performer"
> & {
  performer: GQL.SlimSceneDataFragment["performers"][number];
};

export const SceneCardPerformerPopover: React.FC<IProps> = ({
  scene,
  className,
}) => {
  const { configuration } = useConfigurationContext();
  const performers = useMemo(() => {
    const markerSummaries = getSceneMarkerPerformerTagSummaries(
      scene.scene_markers
    );
    const markerSummariesByPerformerID = new Map(
      markerSummaries.map((summary) => [summary.performer.id, summary])
    );

    return sortPerformers(scene.performers).map<SceneCardPerformerSummary>(
      (performer) => {
        const markerSummary = markerSummariesByPerformerID.get(performer.id);
        return markerSummary
          ? { ...markerSummary, performer }
          : {
              performer,
              topTags: [],
              bottomTags: [],
              topOverlapTagIDs: new Set<string>(),
              bottomOverlapTagIDs: new Set<string>(),
            };
      }
    );
  }, [scene.performers, scene.scene_markers]);

  const popoverContent = (
    <div className="scene-marker-highlight-popover-card">
      <div className="scene-marker-activity-config-performers">
        {performers.map((performer) => {
          const rating = performer.performer.rating100;
          const ratingClass = getRatingCardClass({
            rating,
            tags: performer.performer.rating_tier_tags,
            goatTagId: configuration?.ui.roleTagIds?.goatTagId,
            theme: configuration?.ui.ratingCardTheme,
            thresholds: configuration?.ui.ratingCardThresholds,
            overrideTagIds: configuration?.ui.ratingCardOverrideTagIds,
            thresholdEntity: "performer",
            disabled: isRatingCardHomePage(),
          });

          return (
            <ActivityTypePerformerTile
              key={performer.performer.id}
              performer={performer.performer}
              className="scene-marker-highlight-performer"
              imageClassName={
                ratingClass ? cx("performer-card", ratingClass) : undefined
              }
              imageAccessory={
                rating !== undefined && rating !== null ? (
                  <span
                    className="scene-card-performer-rating"
                    title={`Rating: ${rating}`}
                  >
                    <Icon icon={faStar} aria-hidden="true" />
                    <span className="sr-only">Rating </span>
                    <span>{rating}</span>
                  </span>
                ) : undefined
              }
            >
              <HighlightPerformerTagPills performer={performer} />
            </ActivityTypePerformerTile>
          );
        })}
      </div>
    </div>
  );

  return (
    <HoverPopover
      className={cx("performer-count", className)}
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
