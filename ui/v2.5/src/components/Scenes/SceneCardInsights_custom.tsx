import React, { useMemo } from "react";
import { useConfigurationContext } from "src/hooks/Config";
import { HoverPopover } from "../Shared/HoverPopover";
import {
  getSceneCardInsightSets,
  type ISceneCardInsight,
  type SceneCardInsightPerformerRoleStats,
  type SceneCardInsightScene,
} from "./sceneCardInsightsData_custom";

interface ISceneCardInsightsProps {
  scene: SceneCardInsightScene;
  roleStatsByPerformer?: ReadonlyMap<
    string,
    SceneCardInsightPerformerRoleStats
  >;
  detailPage?: boolean;
}

interface ISceneCardInsightChipProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  label: string;
  tone: ISceneCardInsight["tone"];
  ariaLabel?: string;
  tabIndex?: number;
}

export const SceneCardInsightChip = React.forwardRef<
  HTMLSpanElement,
  ISceneCardInsightChipProps
>(({ label, tone, ariaLabel, tabIndex, className, ...triggerProps }, ref) => (
  <span
    {...triggerProps}
    ref={ref}
    className={`scene-card-insight scene-card-insight-${tone}${
      className ? ` ${className}` : ""
    }`}
    aria-label={ariaLabel}
    aria-hidden={ariaLabel ? undefined : true}
    tabIndex={tabIndex}
  >
    {label}
  </span>
));
SceneCardInsightChip.displayName = "SceneCardInsightChip";

export const SceneCardInsights: React.FC<ISceneCardInsightsProps> = ({
  scene,
  roleStatsByPerformer,
  detailPage,
}) => {
  const { configuration } = useConfigurationContext();
  const insightSets = useMemo(
    () =>
      getSceneCardInsightSets(
        scene,
        configuration?.ui?.roleTagIds,
        configuration?.ui?.sceneCardInsightThresholds,
        {
          overrideTagIds: configuration?.ui?.ratingCardOverrideTagIds,
          thresholds: configuration?.ui?.ratingCardThresholds,
        },
        roleStatsByPerformer
      ),
    [
      configuration?.ui?.ratingCardOverrideTagIds,
      configuration?.ui?.ratingCardThresholds,
      configuration?.ui?.roleTagIds,
      configuration?.ui?.sceneCardInsightThresholds,
      roleStatsByPerformer,
      scene,
    ]
  );

  if (insightSets.visible.length === 0) return null;

  const popup = (
    <div className="scene-card-insights-popup" aria-label="All scene insights">
      {insightSets.all.map((insight) => (
        <div className="scene-card-insights-popup-row" key={insight.key}>
          <SceneCardInsightChip label={insight.label} tone={insight.tone} />
          <span className="scene-card-insights-popup-detail">
            {insight.detail}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <HoverPopover
      className={`scene-card-insights-hover${
        detailPage ? " scene-card-insights-hover-detail" : ""
      }`}
      content={popup}
      estimatedContentHeight={Math.min(520, insightSets.all.length * 56 + 24)}
      placement="bottom"
      popoverClassName="scene-card-insights-popover"
    >
      <div
        className={`scene-card-insights${
          detailPage ? " scene-card-insights-detail" : ""
        }`}
        aria-label={`Scene insights. ${insightSets.all.length} total; hover to show all.`}
      >
        {insightSets.visible.map((insight) => {
          const ariaLabel = `${insight.label}: ${insight.detail}`;
          return (
            <SceneCardInsightChip
              key={insight.key}
              label={insight.label}
              tone={insight.tone}
              ariaLabel={ariaLabel}
              tabIndex={0}
            />
          );
        })}
      </div>
    </HoverPopover>
  );
};
