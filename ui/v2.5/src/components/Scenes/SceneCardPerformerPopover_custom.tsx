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
import { ActivityTypePerformerTile } from "./SceneDetails/sceneMarkerHoverPopover_custom";
import { PerformerCategoryStrip } from "../Performers/PerformerDetails/PerformerCategoryStrip";
import { getSceneCardPerformerMarkerRoles } from "./sceneCardPerformerRoles_custom";
import cx from "classnames";

interface IProps {
  scene: GQL.SlimSceneDataFragment;
  className?: string;
}

export const SceneCardPerformerPopover: React.FC<IProps> = ({
  scene,
  className,
}) => {
  const { configuration } = useConfigurationContext();
  const performers = useMemo(() => {
    const markerRolesByPerformerID = getSceneCardPerformerMarkerRoles(
      scene,
      configuration?.ui.roleTagIds
    );

    return sortPerformers(scene.performers).map((performer) => ({
      performer,
      markerRoles: markerRolesByPerformerID.get(performer.id) ?? [],
    }));
  }, [configuration?.ui.roleTagIds, scene]);

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
              detailLink={`/performers/${performer.performer.id}`}
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
              <div className="scene-card-performer-role-strip">
                <PerformerCategoryStrip
                  performer={performer.performer}
                  sceneId={scene.id}
                  markerRoles={performer.markerRoles}
                  scenePerformerCount={scene.performers.length}
                  scenePartnerPerformers={scene.performers}
                  flushMargins
                />
              </div>
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
      popoverClassName="scene-marker-highlight-popover scene-card-performer-popover"
      estimatedContentHeight={390}
      content={popoverContent}
    >
      <Button className="minimal">
        <Icon icon={faUser} />
        <span>{scene.performers.length}</span>
      </Button>
    </HoverPopover>
  );
};
