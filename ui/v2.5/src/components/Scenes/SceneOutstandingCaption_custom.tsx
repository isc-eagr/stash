import React, { useMemo } from "react";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import cx from "classnames";
import { useConfigurationContext } from "src/hooks/Config";
import TextUtils from "src/utils/text";
import {
  getSceneOutstandingCaptionCustom,
  type ISceneOutstandingCaptionItemCustom,
} from "./sceneCardInsightsData_custom";
import type { SceneCardInsightScene } from "./sceneCardInsightTypes_custom";

const captionLimit = 3;

function itemAmount({
  duration,
  markerCount,
}: ISceneOutstandingCaptionItemCustom) {
  return duration > 0
    ? TextUtils.secondsToTimestamp(duration)
    : `×${markerCount}`;
}

// CUSTOM: the scene's outstanding activity at a glance, bottom-left of the
// thumbnail; hover lists every tag with its time.
export const SceneOutstandingCaption: React.FC<{
  scene: SceneCardInsightScene & { interactive_speed?: number | null };
}> = ({ scene }) => {
  const { configuration } = useConfigurationContext();
  const roleTagIds = configuration?.ui?.roleTagIds;
  const items = useMemo(
    () => getSceneOutstandingCaptionCustom(scene, roleTagIds),
    [scene, roleTagIds]
  );
  if (items.length === 0) return null;

  const names = items.slice(0, captionLimit).map((item) => item.name);
  const extra = items.length - names.length;

  return (
    <OverlayTrigger
      placement="top"
      overlay={
        <Tooltip id={`scene-outstanding-caption-${scene.id}`}>
          <ul className="scene-outstanding-caption__list">
            {items.map((item) => (
              <li key={item.id}>
                <span>{item.name}</span>
                <span>{itemAmount(item)}</span>
              </li>
            ))}
          </ul>
        </Tooltip>
      }
    >
      <div
        aria-label={`Outstanding activity: ${items
          .map((item) => item.name)
          .join(", ")}`}
        className={cx(
          "scene-outstanding-caption",
          !!scene.interactive_speed && "scene-outstanding-caption--raised"
        )}
      >
        <span className="scene-outstanding-caption__names">
          {names.join(" · ")}
        </span>
        {extra > 0 && (
          <span className="scene-outstanding-caption__more">+{extra}</span>
        )}
      </div>
    </OverlayTrigger>
  );
};
