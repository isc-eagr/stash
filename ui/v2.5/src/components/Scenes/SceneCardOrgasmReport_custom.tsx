import React from "react";
import cx from "classnames";
import facialPng from "src/assets/facial.png";
import spermsSvg from "src/assets/sperms.svg";
import { HoverPopover } from "../Shared/HoverPopover";
import { SceneCardOrgasmFacialPopover } from "./SceneCardInsights_custom";
import type { SceneCardInsightEvent } from "./sceneCardInsightTypes_custom";
import {
  getSceneCardOrgasmReportGroupsCustom,
  sceneCardOrgasmReportGroupLabelCustom,
} from "./sceneCardOrgasmReportData_custom";

// CUSTOM: the Orgasm/Facial report chip as icons on scene cards. Sperm icons count
// regular orgasms and the facial icon counts facials; Really Hot and GOAT
// events get their own groups. An empty list shows a crossed-out sperm icon.
const ReportIcon: React.FC<{ category: SceneCardInsightEvent["category"] }> = ({
  category,
}) => {
  const asset = category === "facial" ? facialPng : spermsSvg;
  return (
    <span
      aria-hidden="true"
      className="scene-card-orgasm-report__icon"
      style={{
        // Quote URLs so Vite's inline SVG data URLs remain valid CSS.
        maskImage: `url("${asset}")`,
        WebkitMaskImage: `url("${asset}")`,
      }}
    />
  );
};

export const SceneCardOrgasmReport: React.FC<{
  events: SceneCardInsightEvent[];
}> = ({ events }) => {
  const groups = getSceneCardOrgasmReportGroupsCustom(events);

  if (groups.length === 0) {
    return (
      <span
        aria-label="No orgasms"
        className="scene-card-orgasm-report is-none"
        role="img"
        title="No orgasm or facial markers"
      >
        <span className="scene-card-orgasm-report__group">
          <ReportIcon category="orgasm" />
        </span>
      </span>
    );
  }

  return (
    <HoverPopover
      className="scene-card-orgasm-report-hover"
      content={
        <div
          className="scene-marker-highlight-popover-card"
          data-hover-popover-measure="true"
        >
          <SceneCardOrgasmFacialPopover events={events} />
        </div>
      }
      estimatedContentHeight={520}
      placement="bottom"
      popoverClassName={`scene-marker-highlight-popover scene-card-performer-popover scene-card-insight-event-popover scene-card-insight-event-popover-${
        events.length === 1
          ? "single"
          : events.length === 2
          ? "double"
          : "multiple"
      }`}
    >
      <span
        aria-label={`Orgasm report: ${groups
          .map(sceneCardOrgasmReportGroupLabelCustom)
          .join(", ")}`}
        className="scene-card-orgasm-report"
        role="img"
      >
        {groups.map((group) => (
          <span
            className={cx(
              "scene-card-orgasm-report__group",
              group.quality === "GOAT" && "is-goat",
              group.quality === "Really Hot" && "is-really-hot"
            )}
            key={`${group.category}-${group.quality ?? "plain"}`}
          >
            <ReportIcon category={group.category} />
            <strong>{group.count}</strong>
          </span>
        ))}
      </span>
    </HoverPopover>
  );
};
