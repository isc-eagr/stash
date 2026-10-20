import React from "react";
import cx from "classnames";
import { Link } from "react-router-dom";
import { faHand } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import { ACTIVITY_PIE_COLORS } from "src/components/Shared/activityColors_custom";
import { catalogCardSortHighlightClassCustom } from "src/components/Shared/catalogCardSortHighlight_custom";
import gaySvg from "src/assets/gay.svg";
import mouthSvg from "src/assets/mouth.svg";
import {
  getStudioSceneTypesCustom,
  IStudioSceneTypeCountsCustom,
} from "src/components/Studios/studioSceneTypes_custom";

export type SceneTypeKey = "sex" | "oral" | "solo";

interface IProps {
  counts?: IStudioSceneTypeCountsCustom | null;
  getUrl: (key: SceneTypeKey, label: string) => string | undefined;
  activeSortBy?: string;
  className?: string;
  linkTarget?: React.HTMLAttributeAnchorTarget;
  /** Keep an empty track when every count is zero. */
  showEmpty?: boolean;
  /** Content on the right of the "Scene Types" label. */
  headerAside?: React.ReactNode;
}

// Sex/Oral/Solo scene split: studio cards and headers, performer totals.
export const SceneTypesBar: React.FC<IProps> = ({
  counts,
  getUrl,
  activeSortBy,
  className,
  linkTarget,
  showEmpty = false,
  headerAside,
}) => {
  const rows = getStudioSceneTypesCustom(counts);
  if (!showEmpty && !rows.some((row) => row.count > 0)) return null;

  return (
    <div
      className={cx(
        "scene-types-bar scene-activity-metrics scene-activity-metrics--compact",
        className
      )}
    >
      <div className="scene-activity-metrics__group scene-activity-metrics__group--composition">
        {headerAside ? (
          <div className="scene-types-bar__head">
            <div className="scene-activity-metrics__group-label">
              Scene Types
            </div>
            {headerAside}
          </div>
        ) : (
          <div className="scene-activity-metrics__group-label">Scene Types</div>
        )}
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
            const url = row.count > 0 ? getUrl(row.key, row.label) : undefined;
            const summary = `${row.label}: ${row.count} scenes (${Math.round(
              row.percent
            )}%)`;
            const content = (
              <>
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
              </>
            );
            const metricClassName = cx(
              "scene-activity-metric scene-activity-metric--compact",
              `scene-activity-metric--${row.key}`,
              { "scene-activity-metric--zero": row.count === 0 },
              catalogCardSortHighlightClassCustom(
                activeSortBy,
                `${row.key}_scenes_count`
              )
            );
            return url ? (
              <Link
                key={row.key}
                to={url}
                className={metricClassName}
                title={summary}
                aria-label={summary}
                target={linkTarget}
                rel={
                  linkTarget === "_blank" ? "noopener noreferrer" : undefined
                }
              >
                {content}
              </Link>
            ) : (
              <span
                key={row.key}
                className={metricClassName}
                title={summary}
                aria-label={summary}
              >
                {content}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};
