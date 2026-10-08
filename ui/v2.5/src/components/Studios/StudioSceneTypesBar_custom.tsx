import React from "react";
import cx from "classnames";
import { faHand } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import { ACTIVITY_PIE_COLORS } from "src/components/Shared/activityColors_custom";
import { catalogCardSortHighlightClassCustom } from "src/components/Shared/catalogCardSortHighlight_custom";
import NavUtils from "src/utils/navigation";
import gaySvg from "src/assets/gay.svg";
import mouthSvg from "src/assets/mouth.svg";
import {
  getStudioSceneTypesCustom,
  IStudioSceneTypeCountsCustom,
} from "./studioSceneTypes_custom";
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
}) => {
  const rows = getStudioSceneTypesCustom(counts);
  if (!rows.some((row) => row.count > 0)) return null;

  return (
    <div
      className={cx(
        "studio-scene-types-bar scene-activity-metrics scene-activity-metrics--compact",
        className
      )}
    >
      <div className="scene-activity-metrics__group scene-activity-metrics__group--composition">
        <div className="scene-activity-metrics__group-label">Scene Types</div>
        <div
          className="scene-activity-metrics__distribution"
          role="img"
          aria-label={
            "Scene Types: " +
            rows
              .map(
                (row) =>
                  `${row.label} ${row.count} (${Math.round(row.percent)}%)`
              )
              .join(", ")
          }
        >
          {rows
            .filter((row) => row.count > 0)
            .map((row) => (
              <span
                key={row.key}
                className={`scene-activity-metrics__segment scene-activity-metrics__segment--${row.key}`}
                style={{
                  backgroundColor: ACTIVITY_PIE_COLORS[row.key],
                  width: `${row.percent}%`,
                }}
                title={`${row.label}: ${row.count} scenes (${Math.round(
                  row.percent
                )}%)`}
              />
            ))}
        </div>
        <div className="scene-activity-metrics__row scene-activity-metrics__row--composition">
          {rows.map((row) => {
            const tag = roleTags[`${row.key}Tag`];
            const excludeTags =
              row.key === "sex"
                ? []
                : [
                    roleTags.sexTag,
                    ...(row.key === "solo" ? [roleTags.oralTag] : []),
                  ]
                    .filter(
                      (value): value is NonNullable<typeof value> => !!value
                    )
                    .map((value) => ({ id: value.id, label: value.name }));
            const url =
              tag &&
              (performerId
                ? NavUtils.makePerformerStudioMarkerScenesUrl(
                    performerId,
                    studio,
                    tag.id,
                    row.label,
                    excludeTags,
                    row.key === "oral" ? -1 : 0
                  )
                : NavUtils.makeStudioMarkerScenesUrl(
                    studio,
                    tag.id,
                    row.label,
                    excludeTags,
                    row.key === "oral" ? -1 : 0,
                    includeChildStudios ? -1 : 0
                  ));
            return (
              <a
                key={row.key}
                href={row.count > 0 && url ? url : undefined}
                className={cx(
                  "scene-activity-metric scene-activity-metric--compact",
                  `scene-activity-metric--${row.key}`,
                  catalogCardSortHighlightClassCustom(
                    activeSortBy,
                    `${row.key}_scenes_count`
                  )
                )}
                title={`${row.label}: ${row.count} scenes (${Math.round(
                  row.percent
                )}%)`}
                aria-label={`${row.label}: ${row.count} scenes (${Math.round(
                  row.percent
                )}%)`}
              >
                <span
                  className="scene-activity-metric__swatch"
                  aria-hidden="true"
                  style={{ backgroundColor: ACTIVITY_PIE_COLORS[row.key] }}
                />
                <span
                  className="scene-activity-metric__icon"
                  aria-hidden="true"
                >
                  {row.key === "solo" ? (
                    <Icon icon={faHand} />
                  ) : (
                    <img
                      className="scene-activity-metric__svg"
                      src={row.key === "sex" ? gaySvg : mouthSvg}
                      alt=""
                    />
                  )}
                </span>
                <span className="scene-activity-metric__copy">
                  <strong>
                    {row.count} <small>({Math.round(row.percent)}%)</small>
                  </strong>
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
};
