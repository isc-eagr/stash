import React from "react";
import cx from "classnames";
import { Link } from "react-router-dom";
import { faHand } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import { catalogCardSortHighlightClassCustom } from "src/components/Shared/catalogCardSortHighlight_custom";
import gaySvg from "src/assets/gay.svg";
import mouthSvg from "src/assets/mouth.svg";
import {
  getStudioSceneTypesCustom,
  IStudioSceneTypeCountsCustom,
} from "src/components/Studios/studioSceneTypes_custom";
import type { PerformerRoleTileSize } from "src/components/Performers/PerformerDetails/performerRoleTiles_custom";
import "src/components/Performers/PerformerDetails/performerRoleTiles_custom.scss";

export type SceneTypeKey = "sex" | "oral" | "solo";

interface IProps {
  counts?: IStudioSceneTypeCountsCustom | null;
  getUrl: (key: SceneTypeKey, label: string) => string | undefined;
  size: PerformerRoleTileSize;
  /** Shows the "Scene Types" label above the tiles. */
  caption?: boolean;
  activeSortBy?: string;
  className?: string;
  linkTarget?: React.HTMLAttributeAnchorTarget;
}

// Sex/Oral/Solo scene counts as tiles tinted with their scene-type colors;
// each tooltip carries the share. Performer totals and studios.
export const SceneTypeTiles: React.FC<IProps> = ({
  counts,
  getUrl,
  size,
  caption = false,
  activeSortBy,
  className,
  linkTarget,
}) => (
  <div className={cx("scene-type-tiles", className)}>
    {caption && <div className="scene-type-tiles__label">Scene Types</div>}
    <div
      className={`performer-category-strip performer-role-badges performer-category-strip--tiles performer-category-strip--tiles-${size}`}
    >
      {getStudioSceneTypesCustom(counts).map((row) => {
        const url = row.count > 0 ? getUrl(row.key, row.label) : undefined;
        const content = (
          <>
            {row.key === "solo" ? (
              <Icon icon={faHand} className="category-icon-fa" />
            ) : (
              <img
                src={row.key === "sex" ? gaySvg : mouthSvg}
                alt={row.label}
                className="category-icon"
              />
            )}
            <span className="role-total-count">{row.count}</span>
            {size === "full" && (
              <span className="role-tile-label">{row.label}</span>
            )}
          </>
        );
        return (
          <div
            key={row.key}
            className={cx(
              "role-badge-item role-badge-item--scene-type",
              `role-badge-item--${row.key}`,
              { "role-badge-item--zero": row.count === 0 }
            )}
          >
            <div
              className={cx(
                "category-icon-container",
                catalogCardSortHighlightClassCustom(
                  activeSortBy,
                  `${row.key}_scenes_count`
                )
              )}
              title={`${row.label}: ${row.count} scene${
                row.count !== 1 ? "s" : ""
              } (${Math.round(row.percent)}%)`}
            >
              {url ? (
                <Link
                  to={url}
                  className="role-badge-link"
                  target={linkTarget}
                  rel={
                    linkTarget === "_blank" ? "noopener noreferrer" : undefined
                  }
                >
                  {content}
                </Link>
              ) : (
                content
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);
