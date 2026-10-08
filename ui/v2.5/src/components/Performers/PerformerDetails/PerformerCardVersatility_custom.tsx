import React from "react";
import cx from "classnames";
import { Link } from "react-router-dom";
import { HoverPopover } from "src/components/Shared/HoverPopover";
import { catalogCardSortHighlightClassCustom } from "src/components/Shared/catalogCardSortHighlight_custom";
import TextUtils from "src/utils/text";
import {
  performerVersatility,
  versatilityRoleText,
  versatilityRoleTimeText,
  type VersatilityCategory,
} from "./versatilityScale_custom";

import "./versatilityScale_custom.scss";

// CUSTOM: one-line versatility strip used by performer cards in place of the
// sex/oral/facial role columns. Bottom partners on the left, top on the right.
// Scene cards pass partner portraits to show when hovering a count.
export const PerformerCardVersatilityRow: React.FC<{
  category: VersatilityCategory;
  icon: React.ReactNode;
  toppedPartners: number;
  bottomedPartners: number;
  categoryUrl?: string;
  topUrl?: string;
  bottomUrl?: string;
  linkTarget?: React.HTMLAttributeAnchorTarget;
  activeSortBy?: string;
  topPartners?: JSX.Element;
  bottomPartners?: JSX.Element;
  showPercentages?: boolean;
}> = ({
  category,
  icon,
  toppedPartners,
  bottomedPartners,
  categoryUrl,
  topUrl,
  bottomUrl,
  linkTarget,
  activeSortBy,
  topPartners,
  bottomPartners,
  showPercentages = false,
}) => {
  const versatility = performerVersatility(toppedPartners, bottomedPartners);
  const topText = versatilityRoleText(category, "top", toppedPartners);
  const bottomText = versatilityRoleText(category, "bottom", bottomedPartners);
  const summary = versatility
    ? `${versatility.label}. ${bottomText} (${versatility.bottomPercent}%). ${topText} (${versatility.topPercent}%).`
    : "No partners recorded";

  const countElement = (
    value: number,
    role: "top" | "bottom",
    url: string | undefined,
    text: string | undefined
  ) => {
    const className = cx(
      "performer-card-versatility-count",
      `is-${role}`,
      catalogCardSortHighlightClassCustom(
        activeSortBy,
        `${category}_${role === "top" ? "topped" : "bottomed"}_partners`
      )
    );
    return url && value > 0 ? (
      <Link className={className} target={linkTarget} title={text} to={url}>
        {value}
      </Link>
    ) : (
      <span className={className} title={text}>
        {value}
      </span>
    );
  };

  const count = (
    value: number,
    role: "top" | "bottom",
    url: string | undefined,
    text: string,
    partners: JSX.Element | undefined
  ) => {
    // The partner popover replaces the plain tooltip.
    const element = countElement(value, role, url, partners ? undefined : text);
    return partners ? (
      <HoverPopover
        content={partners}
        placement="bottom"
        popoverClassName="performer-partner-hover-popover"
      >
        {element}
      </HoverPopover>
    ) : (
      element
    );
  };

  return (
    <div
      data-category={category}
      className={`performer-card-versatility-row${
        showPercentages && versatility ? " has-percentages" : ""
      }`}
    >
      {categoryUrl ? (
        <Link
          className="performer-card-versatility-icon"
          target={linkTarget}
          title={`${category} scenes`}
          to={categoryUrl}
        >
          {icon}
        </Link>
      ) : (
        <span className="performer-card-versatility-icon">{icon}</span>
      )}
      {count(bottomedPartners, "bottom", bottomUrl, bottomText, bottomPartners)}
      {showPercentages && versatility && (
        <span className="performer-versatility-percent is-bottom">
          {versatility.bottomPercent}%
        </span>
      )}
      <span
        aria-label={`${category}: ${summary}`}
        className="performer-card-versatility-track"
        role="img"
        title={summary}
      >
        {versatility && (
          <span
            className="performer-versatility-marker"
            style={{
              left: `${versatility.topShare * 100}%`,
              backgroundColor: versatility.color,
            }}
          />
        )}
      </span>
      {showPercentages && versatility && (
        <span className="performer-versatility-percent is-top">
          {versatility.topPercent}%
        </span>
      )}
      {count(toppedPartners, "top", topUrl, topText, topPartners)}
    </div>
  );
};

// CUSTOM: compact Versatility by Time strip for scene-card vato hovers:
// percentages beside the track, exact times only in the tooltip.
export const PerformerCardVersatilityTimeRow: React.FC<{
  category: "sex" | "oral";
  icon: React.ReactNode;
  topSeconds: number;
  bottomSeconds: number;
}> = ({ category, icon, topSeconds, bottomSeconds }) => {
  const versatility = performerVersatility(topSeconds, bottomSeconds);
  if (!versatility) return null;

  const summary = `${versatility.label}. ${versatilityRoleTimeText(
    category,
    "bottom",
    TextUtils.secondsToTimestamp(bottomSeconds)
  )} (${versatility.bottomPercent}%). ${versatilityRoleTimeText(
    category,
    "top",
    TextUtils.secondsToTimestamp(topSeconds)
  )} (${versatility.topPercent}%).`;

  return (
    <div
      data-category={category}
      aria-label={`${category}: ${summary}`}
      className="performer-card-versatility-row is-time"
      role="img"
      title={summary}
    >
      <span className="performer-card-versatility-icon">{icon}</span>
      <span className="performer-versatility-percent is-bottom">
        {versatility.bottomPercent}%
      </span>
      <span className="performer-card-versatility-track">
        <span
          className="performer-versatility-marker"
          style={{
            left: `${versatility.topShare * 100}%`,
            backgroundColor: versatility.color,
          }}
        />
      </span>
      <span className="performer-versatility-percent is-top">
        {versatility.topPercent}%
      </span>
    </div>
  );
};
