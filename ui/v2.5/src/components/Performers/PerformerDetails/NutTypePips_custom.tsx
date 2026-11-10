import React from "react";
import cx from "classnames";
import { Link } from "react-router-dom";
import facialPng from "src/assets/facial.png";
import spermsSvg from "src/assets/sperms.svg";
import type * as GQL from "src/core/generated-graphql";
import type { NutQualityCustom, NutTypeRowCustom } from "./nutTypes_custom";

// CUSTOM: Vato and Studio Detail Nut tile: nuts (top row) and facials
// (bottom row), each plain, Really Hot, and GOAT, colored like the scene card
// nut report.

const rows = [
  { key: "nut", noun: "nut", icon: spermsSvg },
  { key: "facial", noun: "facial", icon: facialPng },
] as const;

const qualities = [
  { key: "plain", label: "", cls: "plain" },
  { key: "really_hot", label: "Really Hot ", cls: "really-hot" },
  { key: "goat", label: "GOAT ", cls: "goat" },
] as const;

export const NutTypePips: React.FC<{
  counts: Pick<GQL.NutTypeCounts, "nut" | "facial">;
  // Markers for one row and quality; zero counts never link.
  getUrl?: (row: NutTypeRowCustom, quality: NutQualityCustom) => string;
}> = ({ counts, getUrl }) => (
  <div className="scene-type-cast-split nut-type-pips">
    {rows.flatMap((row) =>
      qualities.map((quality) => {
        const n = counts[row.key][quality.key];
        const title = `${n} ${quality.label}${row.noun}${n !== 1 ? "s" : ""}`;
        const url = n > 0 ? getUrl?.(row.key, quality.key) : undefined;
        const className = cx(
          "scene-type-cast-split__item",
          `nut-type-pips__item--${quality.cls}`,
          { "scene-type-cast-split__item--zero": n === 0 }
        );
        const pip = (
          <>
            <span
              aria-hidden="true"
              className="nut-type-pips__icon"
              style={{
                // Quoted: production inlines small icons as data URLs.
                maskImage: `url("${row.icon}")`,
                WebkitMaskImage: `url("${row.icon}")`,
              }}
            />
            <span className="scene-type-cast-split__count">{n}</span>
          </>
        );
        const key = `${row.key}-${quality.key}`;
        return url && url !== "#" ? (
          <Link
            aria-label={title}
            className={className}
            key={key}
            title={title}
            to={url}
          >
            {pip}
          </Link>
        ) : (
          <span
            aria-label={title}
            className={className}
            key={key}
            title={title}
          >
            {pip}
          </span>
        );
      })
    )}
  </div>
);
