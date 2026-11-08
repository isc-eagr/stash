import React from "react";
import cx from "classnames";
import { Link } from "react-router-dom";
import { faHand } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import { RoleTileContent } from "src/components/Shared/RoleTileContent_custom";
import { catalogCardSortHighlightClassCustom } from "src/components/Shared/catalogCardSortHighlight_custom";
import gaySvg from "src/assets/gay.svg";
import mouthSvg from "src/assets/mouth.svg";
import {
  applySceneTypeCastSplitCustom,
  getStudioSceneTypesCustom,
  ISceneTypeCastSplitCustom,
  IStudioSceneTypeCountsCustom,
  sceneCastBucketsCustom,
} from "src/components/Studios/studioSceneTypes_custom";
import { withScenePerformerCountCustom } from "src/utils/navigation_custom";
import type { PerformerRoleTileSize } from "src/components/Performers/PerformerDetails/performerRoleTiles_custom";
import "src/components/Performers/PerformerDetails/performerRoleTiles_custom.scss";

export type SceneTypeKey = "sex" | "oral" | "solo";

interface IProps {
  counts?: IStudioSceneTypeCountsCustom | null;
  getUrl: (key: SceneTypeKey, label: string) => string | undefined;
  size: PerformerRoleTileSize;
  /** Shows the "Scene Types" label above the tiles. */
  caption?: boolean;
  /** Detail pages: Sex/Oral get Standard/Threesome/Group pips. */
  castSplit?: ISceneTypeCastSplitCustom | null;
  activeSortBy?: string;
  className?: string;
  linkTarget?: React.HTMLAttributeAnchorTarget;
}

const plural = (n: number) => `${n} scene${n !== 1 ? "s" : ""}`;

// Quoted: production builds inline small SVGs as data URLs with spaces and
// quotes, which an unquoted url() drops (the mask then paints a solid square).
const cssUrl = (src: string) => `url("${src.replace(/"/g, "%22")}")`;

// One dot per vato; Group shows four.
const CastPips: React.FC<{ vatos: number }> = ({ vatos }) => {
  const step = 6;
  const r = 2.2;
  return (
    <svg
      aria-hidden="true"
      className="scene-type-cast-split__pips"
      viewBox={`0 0 ${vatos * step} ${r * 2}`}
      width={vatos * step}
      height={r * 2}
    >
      {Array.from({ length: vatos }, (_, i) => (
        <circle
          key={i}
          cx={i * step + step / 2}
          cy={r}
          r={r}
          fill="currentColor"
        />
      ))}
    </svg>
  );
};

// Sex/Oral/Solo scene counts as tiles tinted with their scene-type colors;
// each tooltip carries the share. Performer totals and studios.
export const SceneTypeTiles: React.FC<IProps> = ({
  counts,
  getUrl,
  size,
  caption = false,
  castSplit,
  activeSortBy,
  className,
  linkTarget,
}) => {
  const rel = linkTarget === "_blank" ? "noopener noreferrer" : undefined;
  const shownCounts =
    counts && castSplit
      ? applySceneTypeCastSplitCustom(counts, castSplit)
      : counts;
  return (
    <div
      className={cx("scene-type-tiles", className, {
        "scene-type-tiles--cast-split": !!castSplit,
      })}
    >
      {caption && <div className="scene-type-tiles__label">Scene Types</div>}
      <div
        className={`performer-category-strip performer-role-badges performer-category-strip--tiles performer-category-strip--tiles-${size}`}
      >
        {getStudioSceneTypesCustom(shownCounts).map((row) => {
          const baseUrl =
            row.count > 0 ? getUrl(row.key, row.label) : undefined;
          const split = row.key !== "solo" ? castSplit?.[row.key] : undefined;
          // Split Sex/Oral totals leave out 1-vato scenes, so their links do too.
          const url = split
            ? withScenePerformerCountCustom(baseUrl, 2, true)
            : baseUrl;
          const content = (
            <RoleTileContent
              count={row.count}
              full={size === "full"}
              label={row.label}
              icon={
                row.key === "solo" ? (
                  <Icon icon={faHand} className="category-icon-fa" />
                ) : size === "full" ? (
                  // Full tiles draw the icon in its scene-type color.
                  <span
                    aria-hidden="true"
                    className="category-icon category-icon--tinted"
                    style={{
                      maskImage: cssUrl(row.key === "sex" ? gaySvg : mouthSvg),
                      WebkitMaskImage: cssUrl(
                        row.key === "sex" ? gaySvg : mouthSvg
                      ),
                    }}
                  />
                ) : (
                  <img
                    src={row.key === "sex" ? gaySvg : mouthSvg}
                    alt={row.label}
                    className="category-icon"
                  />
                )
              }
            />
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
                title={`${row.label}: ${plural(row.count)} (${Math.round(
                  row.percent
                )}%)`}
              >
                {url ? (
                  <Link
                    to={url}
                    className="role-badge-link"
                    target={linkTarget}
                    rel={rel}
                  >
                    {content}
                  </Link>
                ) : (
                  content
                )}
                {split && (
                  <div className="scene-type-cast-split">
                    {sceneCastBucketsCustom.map((bucket) => {
                      const n = split[bucket.key];
                      const title = `${
                        bucket.label
                      } ${row.label.toLowerCase()} (${bucket.vatos}${
                        bucket.key === "group" ? "+" : ""
                      } vatos): ${plural(n)}`;
                      const pip = (
                        <>
                          <CastPips vatos={bucket.vatos} />
                          <span className="scene-type-cast-split__count">
                            {n}
                          </span>
                        </>
                      );
                      const bucketUrl =
                        n > 0
                          ? withScenePerformerCountCustom(
                              baseUrl,
                              bucket.vatos,
                              bucket.key === "group"
                            )
                          : undefined;
                      return bucketUrl ? (
                        <Link
                          key={bucket.key}
                          to={bucketUrl}
                          className="scene-type-cast-split__item"
                          title={title}
                          aria-label={title}
                          target={linkTarget}
                          rel={rel}
                        >
                          {pip}
                        </Link>
                      ) : (
                        <span
                          key={bucket.key}
                          className="scene-type-cast-split__item scene-type-cast-split__item--zero"
                          title={title}
                        >
                          {pip}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
