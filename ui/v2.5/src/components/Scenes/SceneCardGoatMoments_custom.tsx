import React from "react";
import { faCrown } from "@fortawesome/free-solid-svg-icons";
import { HoverPopover } from "../Shared/HoverPopover";
import { Icon } from "../Shared/Icon";
import TextUtils from "src/utils/text";
import type { ISceneGoatMomentCustom } from "./sceneCardInsightsData_custom";
import { ActivityTypePerformerTile } from "./SceneDetails/sceneMarkerHoverPopover_custom";

function momentTime({ seconds, endSeconds }: ISceneGoatMomentCustom) {
  const start = TextUtils.secondsToTimestamp(seconds);
  return endSeconds === undefined
    ? start
    : `${start}–${TextUtils.secondsToTimestamp(endSeconds)}`;
}

// CUSTOM: a gold crown with the combined time of the scene's GOAT moments
// (orgasms and facials stay in the orgasm report); hover lists each one.
export const SceneCardGoatMoments: React.FC<{
  duration: number;
  moments: ISceneGoatMomentCustom[];
}> = ({ duration, moments }) => {
  if (moments.length === 0) return null;
  const time = duration > 0 ? TextUtils.secondsToTimestamp(duration) : "";

  return (
    <HoverPopover
      className="scene-card-goat-moments-hover"
      content={
        <div
          className="scene-marker-highlight-popover-card"
          data-hover-popover-measure="true"
        >
          <div className="scene-card-orgasm-facial-events">
            {moments.map((moment) => {
              const roles = moment.bottomPerformers.length > 0;
              return (
                <section
                  className="scene-card-orgasm-facial-event scene-card-orgasm-facial-event--goat"
                  key={moment.id}
                >
                  <div className="scene-card-orgasm-facial-event-heading">
                    <h4>
                      <span>{moment.label}</span>
                      <span className="scene-card-goat-moment-time">
                        {momentTime(moment)}
                      </span>
                    </h4>
                  </div>
                  <div className="scene-marker-activity-config-performers">
                    {moment.topPerformers.map((performer) => (
                      <ActivityTypePerformerTile
                        key={`top-${performer.id}`}
                        performer={performer}
                        role={roles ? "Top" : undefined}
                        detailLink={`/performers/${performer.id}`}
                        title={performer.name}
                      />
                    ))}
                    {moment.bottomPerformers.map((performer) => (
                      <ActivityTypePerformerTile
                        key={`bottom-${performer.id}`}
                        performer={performer}
                        role="Bottom"
                        detailLink={`/performers/${performer.id}`}
                        title={performer.name}
                      />
                    ))}
                    {!moment.topPerformers.length && !roles && (
                      <div className="scene-marker-activity-config-empty">
                        No performers assigned
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      }
      estimatedContentHeight={520}
      placement="bottom"
      popoverClassName={`scene-marker-highlight-popover scene-card-performer-popover scene-card-insight-event-popover scene-card-insight-event-popover-${
        moments.length === 1
          ? "single"
          : moments.length === 2
          ? "double"
          : "multiple"
      }`}
    >
      <span
        aria-label={`GOAT moments: ${moments.length}${
          time ? `, ${time} in total` : ""
        }`}
        className="scene-card-goat-moments"
        role="img"
      >
        <Icon icon={faCrown} />
        {time && <strong>{time}</strong>}
      </span>
    </HoverPopover>
  );
};
