import React, { useMemo, useState } from "react";
import { Overlay, OverlayTrigger, Popover, Tooltip } from "react-bootstrap";
import { useConfigurationContext } from "src/hooks/Config";
import { HoverPopover } from "../Shared/HoverPopover";
import {
  getSceneCardChipInsightSets,
  type ISceneCardInsight,
  type SceneCardInsightPerformerRoleStats,
  type SceneCardInsightScene,
} from "./sceneCardInsightsData_custom";
import type { SceneCardInsightEvent } from "./sceneCardInsightTypes_custom";
import { hasSceneCardInsightOverflow } from "./sceneCardInsightSelection_custom";
import { ActivityTypePerformerTile } from "./SceneDetails/sceneMarkerHoverPopover_custom";

const insightPopoverHeightAllowance = 180;

export function getSceneCardInsightsPopoverPlacement(
  triggerBottom: number,
  viewportHeight: number
) {
  return triggerBottom + insightPopoverHeightAllowance > viewportHeight
    ? "top"
    : "bottom";
}

interface ISceneCardInsightsProps {
  scene: SceneCardInsightScene;
  roleStatsByPerformer?: ReadonlyMap<
    string,
    SceneCardInsightPerformerRoleStats
  >;
  // CUSTOM: hold the strip until history-backed chips can join it, so cards
  // do not reflow when performer role stats arrive.
  roleStatsPending?: boolean;
  detailPage?: boolean;
}

interface ISceneCardInsightChipProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  label: React.ReactNode;
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

function SceneCardInsightDetail({ detail }: Pick<ISceneCardInsight, "detail">) {
  // CUSTOM: Render each middle-dot separated part as its own readable line.
  const parts = detail.split(/\s*·\s*/);

  return (
    <>
      {parts.map((part, index) => (
        <React.Fragment key={`${part}-${index}`}>
          {index > 0 && <br />}
          {part}
        </React.Fragment>
      ))}
    </>
  );
}

export function SceneCardOrgasmFacialPopover({
  events,
}: {
  events: SceneCardInsightEvent[];
}) {
  const eventNumbers: Record<"orgasm" | "facial", number> = {
    orgasm: 0,
    facial: 0,
  };

  return (
    <div className="scene-card-orgasm-facial-events">
      {events.map((event) => {
        eventNumbers[event.category] += 1;
        const isFacial = event.category === "facial";
        const hasPerformers =
          event.topPerformers.length > 0 || event.bottomPerformers.length > 0;
        const qualityModifier =
          event.quality === "GOAT"
            ? "goat"
            : event.quality === "Really Hot"
            ? "really-hot"
            : undefined;

        return (
          <section
            className={`scene-card-orgasm-facial-event${
              isFacial ? " scene-card-orgasm-facial-event--facial" : ""
            }${
              qualityModifier
                ? ` scene-card-orgasm-facial-event--${qualityModifier}`
                : ""
            }`}
            key={event.id}
          >
            <div className="scene-card-orgasm-facial-event-heading">
              <h4>
                <span>
                  {isFacial ? "Facial" : "Orgasm"}{" "}
                  {eventNumbers[event.category]}
                </span>
                {event.quality && (
                  <span
                    className={`scene-card-event-quality-pill scene-card-event-quality-pill--${qualityModifier}`}
                  >
                    {event.quality}
                  </span>
                )}
              </h4>
            </div>
            <div className="scene-marker-activity-config-performers">
              {event.topPerformers.map((performer) => (
                <ActivityTypePerformerTile
                  key={`${event.id}-top-${performer.id}`}
                  performer={performer}
                  role={isFacial ? "Top" : undefined}
                  detailLink={`/performers/${performer.id}`}
                  title={`${isFacial ? "Top" : "Orgasm"}: ${performer.name}`}
                />
              ))}
              {isFacial &&
                event.bottomPerformers.map((performer) => (
                  <ActivityTypePerformerTile
                    key={`${event.id}-bottom-${performer.id}`}
                    performer={performer}
                    role="Bottom"
                    detailLink={`/performers/${performer.id}`}
                    title={`Bottom: ${performer.name}`}
                  />
                ))}
              {!hasPerformers && (
                <div className="scene-marker-activity-config-empty">
                  No performers assigned
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SceneCardInsightPerformersPopover({
  performers,
}: {
  performers: NonNullable<ISceneCardInsight["performerPreviews"]>;
}) {
  return (
    <div
      className="scene-marker-highlight-popover-card scene-card-insight-performer-preview"
      data-hover-popover-measure="true"
    >
      <div className="scene-marker-activity-config-performers">
        {performers.map((performer) => (
          <ActivityTypePerformerTile
            key={performer.id}
            performer={performer}
            detailLink={`/performers/${performer.id}`}
            title={performer.name}
          />
        ))}
      </div>
    </div>
  );
}

export const SceneCardInsights: React.FC<ISceneCardInsightsProps> = ({
  scene,
  roleStatsByPerformer,
  roleStatsPending,
  detailPage,
}) => {
  const { configuration } = useConfigurationContext();
  const [showAllInsights, setShowAllInsights] = useState(false);
  const [allInsightsTarget, setAllInsightsTarget] =
    useState<HTMLElement | null>(null);
  const [allInsightsPlacement, setAllInsightsPlacement] = useState<
    "top" | "bottom"
  >("bottom");
  // CUSTOM: scene cards and scene details show the same chip families.
  const insightSets = useMemo(
    () =>
      getSceneCardChipInsightSets(
        scene,
        configuration?.ui?.roleTagIds,
        configuration?.ui?.sceneCardInsightThresholds,
        roleStatsByPerformer
      ),
    [
      configuration?.ui?.roleTagIds,
      configuration?.ui?.sceneCardInsightThresholds,
      roleStatsByPerformer,
      scene,
    ]
  );
  if (roleStatsPending || insightSets.visible.length === 0) return null;
  const hasOverflow = hasSceneCardInsightOverflow(
    insightSets.all.length,
    insightSets.visible.length
  );

  const renderInsightChip = (insight: ISceneCardInsight) => {
    const chip = (
      <SceneCardInsightChip
        ariaLabel={`${insight.label}: ${insight.detail}`}
        label={insight.label}
        tabIndex={0}
        tone={insight.tone}
      />
    );

    const { performerPreviews } = insight;
    if (performerPreviews) {
      return (
        <HoverPopover
          key={insight.key}
          className="scene-card-insight-hover-popover"
          content={
            <SceneCardInsightPerformersPopover performers={performerPreviews} />
          }
          estimatedContentHeight={420}
          placement="bottom"
          popoverClassName="scene-marker-highlight-popover scene-card-insight-performer-popover"
        >
          {chip}
        </HoverPopover>
      );
    }

    return (
      <OverlayTrigger
        key={insight.key}
        overlay={
          <Tooltip id={`scene-insight-${scene.id}-${insight.key}`}>
            <span className="scene-card-insight-tooltip-detail">
              <SceneCardInsightDetail detail={insight.detail} />
            </span>
          </Tooltip>
        }
        placement="bottom"
      >
        {chip}
      </OverlayTrigger>
    );
  };

  const popup = (
    <div className="scene-card-insights-popup" aria-label="All scene insights">
      {insightSets.all.map(renderInsightChip)}
    </div>
  );

  return (
    <>
      <div
        className={`scene-card-insights${
          detailPage ? " scene-card-insights-detail" : ""
        }`}
        aria-label={`Scene insights. ${insightSets.visible.length} shown.`}
      >
        {insightSets.visible.map(renderInsightChip)}
        {hasOverflow && (
          <button
            aria-label={`Show all ${insightSets.all.length} scene insights`}
            className="scene-card-insights-more"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setAllInsightsPlacement(
                getSceneCardInsightsPopoverPlacement(
                  event.currentTarget.getBoundingClientRect().bottom,
                  window.innerHeight
                )
              );
              setAllInsightsTarget(event.currentTarget);
              setShowAllInsights(true);
            }}
            type="button"
          >
            +
          </button>
        )}
      </div>
      <Overlay
        target={allInsightsTarget}
        show={showAllInsights}
        placement={allInsightsPlacement}
        rootClose
        onHide={() => setShowAllInsights(false)}
      >
        <Popover
          className="scene-card-insights-popover"
          id={`scene-insights-${scene.id}`}
        >
          <Popover.Content>{popup}</Popover.Content>
        </Popover>
      </Overlay>
    </>
  );
};
