import cx from "classnames";
import React from "react";
import TextUtils from "src/utils/text";
import {
  performerVersatility,
  versatilityRoleText,
  versatilityRoleTimeText,
  type VersatilityCategory,
  type VersatilityTimeCategory,
} from "./versatilityScale_custom";

import "./versatilityScale_custom.scss";

interface IScale {
  category: VersatilityCategory | VersatilityTimeCategory;
  title: string;
  // Unique partners or role seconds; only the ratio matters.
  top: number;
  bottom: number;
  topText: string;
  bottomText: string;
}

const VersatilityScale: React.FC<IScale> = ({
  title,
  top,
  bottom,
  topText,
  bottomText,
}) => {
  const versatility = performerVersatility(top, bottom);

  if (!versatility) {
    return null;
  }

  const { bottomPercent, topPercent } = versatility;
  const summary = `${title} versatility: ${versatility.label}. ${bottomText} (${bottomPercent}%). ${topText} (${topPercent}%).`;

  return (
    <div className="performer-versatility-scale">
      <div className="performer-versatility-heading">
        <h3>{title}</h3>
        <span
          className="performer-versatility-chip"
          style={{
            backgroundColor: versatility.color,
            color: versatility.textColor,
          }}
        >
          {versatility.label}
        </span>
      </div>
      <div className="performer-versatility-meter">
        <span className="performer-versatility-percent is-bottom">
          {bottomPercent}%
        </span>
        <div
          aria-label={summary}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={topPercent}
          aria-valuetext={versatility.label}
          className="performer-versatility-track"
          role="meter"
          title={summary}
        >
          <span
            className="performer-versatility-marker"
            style={{
              // Bottom on the left, top on the right.
              left: `${versatility.topShare * 100}%`,
              backgroundColor: versatility.color,
            }}
          />
        </div>
        <span className="performer-versatility-percent is-top">
          {topPercent}%
        </span>
      </div>
      <div className="performer-versatility-ends">
        <span>{bottomText}</span>
        <span>{topText}</span>
      </div>
    </div>
  );
};

const VersatilitySection: React.FC<{
  title: string;
  scales: IScale[];
  className?: string;
  // Off when an outer heading already names the section.
  showTitle?: boolean;
}> = ({ title, scales, className, showTitle = true }) => {
  if (scales.every((scale) => scale.top + scale.bottom <= 0)) {
    return null;
  }

  return (
    <section
      className={cx("performer-versatility", className)}
      aria-label={title}
    >
      {showTitle && <h3 className="performer-versatility-title">{title}</h3>}
      <div className="performer-versatility-scales">
        {scales.map((scale) => (
          <VersatilityScale {...scale} key={scale.category} />
        ))}
      </div>
    </section>
  );
};

function partnerScale(
  category: VersatilityCategory,
  title: string,
  toppedPartners: number,
  bottomedPartners: number
): IScale {
  return {
    category,
    title,
    top: toppedPartners,
    bottom: bottomedPartners,
    topText: versatilityRoleText(category, "top", toppedPartners),
    bottomText: versatilityRoleText(category, "bottom", bottomedPartners),
  };
}

function timeScale(
  category: VersatilityTimeCategory,
  title: string,
  topSeconds: number,
  bottomSeconds: number
): IScale {
  return {
    category,
    title,
    top: topSeconds,
    bottom: bottomSeconds,
    topText: versatilityRoleTimeText(
      category,
      "top",
      TextUtils.secondsToTimestamp(topSeconds)
    ),
    bottomText: versatilityRoleTimeText(
      category,
      "bottom",
      TextUtils.secondsToTimestamp(bottomSeconds)
    ),
  };
}

// CUSTOM: sex, oral, and facial versatility from how many unique partners he topped vs
// bottomed for, the same counts as the header role strip. Shown beside Activity
// Time in the performer header and below it in the scene Vato Overview drawer.
export const PerformerVersatility: React.FC<{
  sexToppedPartners: number;
  sexBottomedPartners: number;
  oralToppedPartners: number;
  oralBottomedPartners: number;
  facialToppedPartners: number;
  facialBottomedPartners: number;
  className?: string;
}> = ({
  sexToppedPartners,
  sexBottomedPartners,
  oralToppedPartners,
  oralBottomedPartners,
  facialToppedPartners,
  facialBottomedPartners,
  className,
}) => (
  <VersatilitySection
    className={className}
    scales={[
      partnerScale("sex", "Sex", sexToppedPartners, sexBottomedPartners),
      partnerScale("oral", "Oral", oralToppedPartners, oralBottomedPartners),
      partnerScale(
        "facial",
        "Facial",
        facialToppedPartners,
        facialBottomedPartners
      ),
    ]}
    title="Versatility by Partners"
  />
);

// CUSTOM: overall, sex, and oral versatility from top vs bottom time; Overall
// adds sex and oral role seconds like the scene stats. Used by the performer
// Stats tab and, per vato, the scene stats Performer Explorer.
export const PerformerVersatilityByTime: React.FC<{
  sexTopSeconds: number;
  sexBottomSeconds: number;
  oralTopSeconds: number;
  oralBottomSeconds: number;
  className?: string;
  showTitle?: boolean;
}> = ({
  sexTopSeconds,
  sexBottomSeconds,
  oralTopSeconds,
  oralBottomSeconds,
  className,
  showTitle,
}) => (
  <VersatilitySection
    className={className}
    showTitle={showTitle}
    scales={[
      timeScale(
        "overall",
        "Overall",
        sexTopSeconds + oralTopSeconds,
        sexBottomSeconds + oralBottomSeconds
      ),
      timeScale("sex", "Sex", sexTopSeconds, sexBottomSeconds),
      timeScale("oral", "Oral", oralTopSeconds, oralBottomSeconds),
    ]}
    title="Versatility by Time"
  />
);
