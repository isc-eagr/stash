import cx from "classnames";
import React from "react";
import {
  performerVersatility,
  versatilityRoleText,
  type VersatilityCategory,
} from "./versatilityScale_custom";

import "./versatilityScale_custom.scss";

interface IScale {
  category: VersatilityCategory;
  title: string;
  toppedPartners: number;
  bottomedPartners: number;
}

const VersatilityScale: React.FC<IScale> = ({
  category,
  title,
  toppedPartners,
  bottomedPartners,
}) => {
  const versatility = performerVersatility(toppedPartners, bottomedPartners);

  if (!versatility) {
    return (
      <div className="performer-versatility-scale">
        <div className="performer-versatility-heading">
          <h3>{title}</h3>
          <span className="performer-versatility-empty">No roles recorded</span>
        </div>
      </div>
    );
  }

  const topPercent = Math.round(versatility.topShare * 100);
  const topText = versatilityRoleText(category, "top", toppedPartners);
  const bottomText = versatilityRoleText(category, "bottom", bottomedPartners);
  const summary = `${title} versatility: ${versatility.label}. ${bottomText}. ${topText}.`;

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
      <div className="performer-versatility-ends">
        <span>{bottomText}</span>
        <span>{topText}</span>
      </div>
    </div>
  );
};

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
}) => {
  const scales: IScale[] = [
    {
      category: "sex",
      title: "Sex",
      toppedPartners: sexToppedPartners,
      bottomedPartners: sexBottomedPartners,
    },
    {
      category: "oral",
      title: "Oral",
      toppedPartners: oralToppedPartners,
      bottomedPartners: oralBottomedPartners,
    },
    {
      category: "facial",
      title: "Facial",
      toppedPartners: facialToppedPartners,
      bottomedPartners: facialBottomedPartners,
    },
  ];

  if (
    scales.every((scale) => scale.toppedPartners + scale.bottomedPartners <= 0)
  ) {
    return null;
  }

  return (
    <section
      className={cx("performer-versatility", className)}
      aria-label="Versatility"
    >
      <h3 className="performer-versatility-title">Versatility</h3>
      <div className="performer-versatility-scales">
        {scales.map((scale) => (
          <VersatilityScale {...scale} key={scale.category} />
        ))}
      </div>
    </section>
  );
};
