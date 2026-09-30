import React from "react";
import { Link } from "react-router-dom";
import {
  performerVersatility,
  versatilityRoleText,
  type VersatilityCategory,
} from "./versatilityScale_custom";

import "./versatilityScale_custom.scss";

// CUSTOM: one-line versatility strip used by performer cards in place of the
// sex/oral/facial role columns. Bottom partners on the left, top on the right.
export const PerformerCardVersatilityRow: React.FC<{
  category: VersatilityCategory;
  icon: React.ReactNode;
  toppedPartners: number;
  bottomedPartners: number;
  categoryUrl?: string;
  topUrl?: string;
  bottomUrl?: string;
  linkTarget?: React.HTMLAttributeAnchorTarget;
  highlighted?: boolean;
}> = ({
  category,
  icon,
  toppedPartners,
  bottomedPartners,
  categoryUrl,
  topUrl,
  bottomUrl,
  linkTarget,
  highlighted = false,
}) => {
  const versatility = performerVersatility(toppedPartners, bottomedPartners);
  const topText = versatilityRoleText(category, "top", toppedPartners);
  const bottomText = versatilityRoleText(category, "bottom", bottomedPartners);
  const summary = versatility
    ? `${versatility.label}. ${bottomText}. ${topText}.`
    : "No partners recorded";

  const count = (
    value: number,
    role: "top" | "bottom",
    url: string | undefined,
    text: string
  ) =>
    url && value > 0 ? (
      <Link
        className={`performer-card-versatility-count is-${role}`}
        target={linkTarget}
        title={text}
        to={url}
      >
        {value}
      </Link>
    ) : (
      <span
        className={`performer-card-versatility-count is-${role}`}
        title={text}
      >
        {value}
      </span>
    );

  return (
    <div
      className={`performer-card-versatility-row${
        highlighted ? " is-highlighted" : ""
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
      {count(bottomedPartners, "bottom", bottomUrl, bottomText)}
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
      {count(toppedPartners, "top", topUrl, topText)}
    </div>
  );
};
