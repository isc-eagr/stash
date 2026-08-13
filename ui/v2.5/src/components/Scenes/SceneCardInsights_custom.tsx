import React, { useMemo } from "react";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import { useConfigurationContext } from "src/hooks/Config";
import {
  getSceneCardInsights,
  type ISceneCardInsight,
  type SceneCardInsightScene,
} from "./sceneCardInsightsData_custom";

interface ISceneCardInsightsProps {
  scene: SceneCardInsightScene;
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
}) => {
  const { configuration } = useConfigurationContext();
  const insights = useMemo(
    () =>
      getSceneCardInsights(
        scene,
        configuration?.ui?.roleTagIds,
        configuration?.ui?.sceneCardInsightThresholds
      ),
    [
      configuration?.ui?.roleTagIds,
      configuration?.ui?.sceneCardInsightThresholds,
      scene,
    ]
  );

  if (insights.length === 0) return null;

  return (
    <div className="scene-card-insights" aria-label="Scene insights">
      {insights.map((insight) => {
        const tooltipID = `scene-insight-${scene.id}-${insight.key}`;
        const ariaLabel = `${insight.label}: ${insight.detail}`;
        return (
          <OverlayTrigger
            key={insight.key}
            overlay={<Tooltip id={tooltipID}>{insight.detail}</Tooltip>}
            placement="bottom"
            trigger={["hover", "focus"]}
          >
            <SceneCardInsightChip
              label={insight.label}
              tone={insight.tone}
              ariaLabel={ariaLabel}
              tabIndex={0}
            />
          </OverlayTrigger>
        );
      })}
    </div>
  );
};
